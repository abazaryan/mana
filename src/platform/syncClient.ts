/**
 * The sync engine of a signed-in device (stage 6a.3, R39; STAGE6_RESEARCH 5.1, 5.4). One run:
 * send the queue in batches, then take everything after the cursor. One run at a time, across
 * the windows of the app too (Web Locks: the installed app and a Chrome tab share the database).
 *
 * When: SEND_DELAY_MS after an answer (at least every SEND_MAX_WAIT_MS, at once at
 * SEND_NOW_QUEUE records), at start, when the network comes back, back on the screen; when the
 * page goes to the background, a part of the queue goes with fetch keepalive. Failures back off
 * 5 s → 30 s → 2 min → 10 min; a 5xx or a network error first halves the batch (down to 10).
 */
import type { FSRS } from 'ts-fsrs';
import { BATCH_GAP_MS, KEEPALIVE_BYTES, PULL_AGAIN_MS, PUSH_BATCH, PUSH_BATCH_BYTES, SendTimer, backoffDelay, smallerBatch } from '../core/sync';
import { NOTICE_VERSION } from '../core/notice';
import { PULL_MAX } from '../core/syncProtocol';
import type { ApiResult, SyncTransport } from './api';
import type { ManaDb } from './db';
import { notifySyncChanged, onQueued } from './syncEvents';
import { applyPull, applyPushResult, markNeedsConsent, markNeedsUpdate, markSynced, nextBatch, syncOf } from './syncStore';

export interface SyncEnv {
  db: ManaDb;
  scheduler: FSRS;
  transport: SyncTransport;
  /** This build (src/core/build.ts): kept with a "needs update" mark. */
  build: number;
  /** Web Locks of the browser; null — none (one run per window only). */
  locks?: LockManager | null;
  online?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  /** This version is older than the account's data: show the update screen. */
  onNeedsUpdate?: () => void;
}

export type RunResult = 'ok' | 'offline' | 'failed' | 'unauthorized' | 'update' | 'consent' | 'busy' | 'signedOut';

const LOCK = 'mana-sync';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** What a failed request means for the run. */
function failure(res: Extract<ApiResult<unknown>, { ok: false }>, online: boolean): 'unauthorized' | 'update' | 'consent' | 'offline' | 'retry' | 'failed' {
  if (res.status === 401) return 'unauthorized';
  if (res.status === 426) return 'update';
  // No consent to the current notice (R39): wait for it — no retries, the queue stays.
  if (res.status === 403 && res.error === 'consent_required') return 'consent';
  if (res.status === 0 && !online) return 'offline';
  if (res.status === 0 || res.status >= 500 || res.status === 413) return 'retry';
  return 'failed';
}

async function run(env: SyncEnv): Promise<RunResult> {
  const { db, transport } = env;
  const online = env.online ?? (() => true);
  const sleep = env.sleep ?? wait;
  const meta = await db.meta.get('device');
  if (!meta?.account) return 'signedOut';
  if (meta.sync?.needsUpdate) return 'update';
  let changed = false;

  // Send the queue: settings with the first batch only (a refused key must not loop).
  let size = PUSH_BATCH;
  let withSettings = true;
  let first = true;
  for (;;) {
    const batch = await nextBatch(db, size, PUSH_BATCH_BYTES, withSettings);
    if (!batch) break;
    if (!first) await sleep(BATCH_GAP_MS);
    first = false;
    const res = await transport.push(batch.body, false);
    if (res.ok) {
      withSettings = false;
      if (await applyPushResult(db, batch, res.data)) changed = true;
      continue;
    }
    const what = failure(res, online());
    if (what === 'update') {
      await markNeedsUpdate(db, 'client', env.build);
      env.onNeedsUpdate?.();
      return 'update';
    }
    if (what === 'consent') {
      await markNeedsConsent(db, NOTICE_VERSION);
      return 'consent';
    }
    if (what === 'retry') {
      const smaller = smallerBatch(batch.ids.length);
      if (smaller !== null) {
        size = smaller;
        continue;
      }
      return 'failed';
    }
    return what;
  }

  // Take everything after the cursor.
  for (;;) {
    const now = await db.meta.get('device');
    if (!now?.account) return 'signedOut';
    const res = await transport.pull(syncOf(now).cursor, PULL_MAX);
    if (!res.ok) {
      const what = failure(res, online());
      if (what === 'update') {
        await markNeedsUpdate(db, 'client', env.build);
        env.onNeedsUpdate?.();
        return 'update';
      }
      if (what === 'consent') await markNeedsConsent(db, NOTICE_VERSION);
      if (changed) notifySyncChanged();
      return what === 'retry' ? 'failed' : what;
    }
    const out = await applyPull(db, env.scheduler, res.data, env.build);
    if (out.added > 0 || out.settingsChanged) changed = true;
    if (out.newerRules) {
      notifySyncChanged();
      env.onNeedsUpdate?.();
      return 'update';
    }
    if (!out.more) break;
  }
  await markSynced(db);
  if (changed) notifySyncChanged();
  return 'ok';
}

/** Databases with a run in progress in this window. */
const inWindow = new WeakSet<ManaDb>();

/** One run, if no other run (in this window or another) is in progress ('busy'). */
export async function syncOnce(env: SyncEnv): Promise<RunResult> {
  if (inWindow.has(env.db)) return 'busy';
  inWindow.add(env.db);
  try {
    const locks = env.locks === undefined ? (typeof navigator !== 'undefined' ? navigator.locks : undefined) : env.locks;
    if (!locks) return await run(env);
    return (await locks.request(LOCK, { ifAvailable: true }, async (lock) => (lock ? run(env) : 'busy'))) as RunResult;
  } finally {
    inWindow.delete(env.db);
  }
}

/**
 * The part of the queue that fits a keepalive request, sent as the page goes to the background.
 * Its answer may never reach the page: the records then go again at the next start, as
 * duplicates. No lock (the page may be frozen any moment); a repeat is safe.
 */
export async function sendBeforeLeaving(env: SyncEnv): Promise<void> {
  const batch = await nextBatch(env.db, PUSH_BATCH, KEEPALIVE_BYTES, false);
  if (!batch || batch.ids.length === 0) return;
  const res = await env.transport.push(batch.body, true);
  if (res.ok) await applyPushResult(env.db, batch, res.data);
}

/** Runs the engine for a signed-in device: timers and browser events. */
export class SyncEngine {
  private readonly timer = new SendTimer();
  private handle: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private retryAt: number | null = null;
  private running = false;
  private again = false;
  private stopped = false;
  private readonly off: (() => void)[] = [];

  constructor(private readonly env: SyncEnv) {}

  start(): void {
    this.off.push(onQueued(() => this.queued()));
    if (typeof window !== 'undefined') {
      const online = () => {
        this.failures = 0;
        this.retryAt = null;
        this.kick();
      };
      const visibility = () => {
        if (document.visibilityState === 'hidden') void sendBeforeLeaving(this.env);
        else void this.backOnScreen();
      };
      window.addEventListener('online', online);
      document.addEventListener('visibilitychange', visibility);
      this.off.push(() => window.removeEventListener('online', online), () => document.removeEventListener('visibilitychange', visibility));
    }
    this.kick();
  }

  stop(): void {
    this.stopped = true;
    if (this.handle) clearTimeout(this.handle);
    for (const f of this.off.splice(0)) f();
  }

  /** A record was queued. */
  queued(): void {
    this.timer.queued(Date.now());
    this.schedule();
  }

  /** A run now (or right after the one in progress). */
  kick(): void {
    if (this.stopped) return;
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    this.timer.sent();
    void syncOnce(this.env)
      .then((result) => {
        if (result === 'ok') {
          this.failures = 0;
          this.retryAt = null;
        } else if (result === 'failed' || result === 'busy') {
          this.failures++;
          this.retryAt = Date.now() + backoffDelay(this.failures);
        } else if (result === 'unauthorized' || result === 'update' || result === 'consent' || result === 'signedOut') {
          this.stop();
        }
      })
      .catch(() => {
        this.failures++;
        this.retryAt = Date.now() + backoffDelay(this.failures);
      })
      .finally(() => {
        this.running = false;
        if (this.again) {
          this.again = false;
          this.kick();
        } else {
          this.schedule();
        }
      });
  }

  private async backOnScreen(): Promise<void> {
    const meta = await this.env.db.meta.get('device');
    const last = meta?.sync?.lastOkAt?.getTime() ?? 0;
    if (Date.now() - last >= PULL_AGAIN_MS) this.kick();
  }

  private schedule(): void {
    if (this.stopped || this.running) return;
    if (this.handle) clearTimeout(this.handle);
    this.handle = null;
    const due = [this.timer.dueAt(), this.retryAt].filter((t): t is number => t !== null);
    if (due.length === 0) return;
    this.handle = setTimeout(() => {
      this.handle = null;
      this.retryAt = null;
      this.kick();
    }, Math.max(0, Math.min(...due) - Date.now()));
  }
}
