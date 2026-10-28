/**
 * Pure rules of the device's side of sync (stage 6a.3, R39; STAGE6_RESEARCH 5.4–5.6): when to
 * send, how much, how to back off and split, what a received page asks for. No browser, no
 * database — the engine (platform/syncClient.ts) applies them.
 */
import type { Skill } from './kinds.ts';
import { RULES_VERSION } from './scheduler';
import { SYNCED_SETTINGS, validSetting, type ServerSettings, type SettingChange, type SyncedSetting } from './syncProtocol.ts';

/**
 * Records in one push, and its body at most (the server takes more: PUSH_MAX_RECORDS, 1 MiB).
 * 25 from 27.10.2026 (step "CPU of sign-in routes": ≈ 1 ms + 0.15 ms per record of CPU).
 */
export const PUSH_BATCH = 25;
export const PUSH_BATCH_BYTES = 512 * 1024;
/** A failing push is halved down to this many records, then the engine waits. */
export const MIN_BATCH = 10;
/** A failing pull page is halved down to this many records, then the engine waits. */
export const MIN_PULL = 50;
/**
 * The body of a push sent while the page goes to the background (fetch keepalive): the Fetch
 * standard allows 64 KiB for all keepalive requests in flight together; leave room.
 */
export const KEEPALIVE_BYTES = 60 * 1024;
/** Pauses after failures: 5 s, 30 s, 2 min, then 10 min. */
export const BACKOFF_MS = [5_000, 30_000, 120_000, 600_000] as const;
/** Between two pushes of one run. */
export const BATCH_GAP_MS = 2_000;
/** Send this long after the last answer… */
export const SEND_DELAY_MS = 8_000;
/** …but at least this often while answers keep coming (R39)… */
export const SEND_MAX_WAIT_MS = 60_000;
/** …and at once when this many records wait. */
export const SEND_NOW_QUEUE = 20;
/** Back on the screen: pull again if the last exchange is older than this. */
export const PULL_AGAIN_MS = 30_000;
/** The page reloads by itself for a new version at most once per this (sessionStorage mark). */
export const RELOAD_GUARD_MS = 10 * 60_000;

export const backoffDelay = (failures: number): number => BACKOFF_MS[Math.min(Math.max(failures, 1), BACKOFF_MS.length) - 1]!;

/** After a 5xx, a network error or 413: half the batch, down to MIN_BATCH; null — already there, wait. */
export function smallerBatch(size: number): number | null {
  return size <= MIN_BATCH ? null : Math.max(MIN_BATCH, Math.ceil(size / 2));
}

/** The same for a pull page: half, down to MIN_PULL; null — already there, wait. */
export function smallerPage(size: number): number | null {
  return size <= MIN_PULL ? null : Math.max(MIN_PULL, Math.ceil(size / 2));
}

/** A failure a smaller request may get past: no answer, a 5xx (a 1102 too) or 413. */
export const worthSplitting = (status: number): boolean => status === 0 || status >= 500 || status === 413;

/**
 * One page of a paged read — the pull and the account's copy (R43 item 3): asked at `full`, halved
 * down to MIN_PULL while `splits` says a failure is worth it. The answer that ended it comes back:
 * the page, or the failure at the smallest size.
 */
export async function askPage<R extends { ok: boolean }>(full: number, ask: (limit: number) => Promise<R>, splits: (failed: R) => boolean): Promise<R> {
  let limit = full;
  for (;;) {
    const answer = await ask(limit);
    const smaller = !answer.ok && splits(answer) ? smallerPage(limit) : null;
    if (smaller === null) return answer;
    limit = smaller;
  }
}

/**
 * How many of the records (each already as JSON text) go into one push body
 * `{"records":[…]}` of at most `maxBytes` (UTF-8) and `maxCount` records.
 */
export function batchLength(jsonTexts: readonly string[], maxCount: number, maxBytes: number, extraBytes = 0): number {
  const encoder = new TextEncoder();
  let bytes = '{"records":[]}'.length + extraBytes;
  let n = 0;
  for (const text of jsonTexts) {
    if (n >= maxCount) break;
    const size = encoder.encode(text).byteLength + (n > 0 ? 1 : 0);
    if (bytes + size > maxBytes) break;
    bytes += size;
    n++;
  }
  return n;
}

/**
 * When to send while answers come in: SEND_DELAY_MS after the last one, but not later than
 * SEND_MAX_WAIT_MS after the first unsent one, and at once at SEND_NOW_QUEUE records.
 */
export class SendTimer {
  private first: number | null = null;
  private last = 0;
  private waiting = 0;

  /** A record was queued at `now`. */
  queued(now: number): void {
    this.first ??= now;
    this.last = now;
    this.waiting++;
  }

  /** A send started: the records queued so far go with it. */
  sent(): void {
    this.first = null;
    this.waiting = 0;
  }

  /** Time of the next send, or null — nothing waits. */
  dueAt(): number | null {
    if (this.first === null) return null;
    if (this.waiting >= SEND_NOW_QUEUE) return this.last;
    return Math.min(this.last + SEND_DELAY_MS, this.first + SEND_MAX_WAIT_MS);
  }
}

type Json = Record<string, unknown>;

/** A received answer made with scheduling rules newer than this version knows (STAGE6_RESEARCH 5.5). */
export function hasNewerRules(records: readonly Json[], rulesVersion = RULES_VERSION): boolean {
  return records.some((r) => r.type === 'review' && typeof r.rules === 'number' && r.rules > rulesVersion);
}

/** The cards (user, deck, entry, skill) that received answers touch. */
export function touchedCards(records: readonly Json[]): [string, string, string, Skill][] {
  const keys = new Map<string, [string, string, string, Skill]>();
  for (const r of records) {
    if (r.type !== 'review') continue;
    const key: [string, string, string, Skill] = [String(r.userId), String(r.deckId), String(r.entryId), r.skill as Skill];
    keys.set(key.join('\u0000'), key);
  }
  return [...keys.values()];
}

/** The synced settings as the device keeps them (part of SettingsRow). */
export type SyncedValues = Record<SyncedSetting, unknown>;

/**
 * The settings to send: a key changed here — `set` (it wins on the server); a key this device
 * never got from the server (the first exchange after sign-in) — `init` (kept only if the
 * account has none, so the server's value is taken).
 */
export function settingsToSend(local: SyncedValues, rev: Partial<Record<string, number>>, dirty: readonly string[]): SettingChange[] {
  const out: SettingChange[] = [];
  for (const key of SYNCED_SETTINGS) {
    if (dirty.includes(key)) out.push({ key, value: local[key], mode: 'set' });
    else if (rev[key] === undefined) out.push({ key, value: local[key], mode: 'init' });
  }
  return out;
}

/**
 * The account's settings from the server applied to the device: a key changed here and not
 * yet accepted stays as it is (it is sent and wins); every other key takes the server's value
 * when its change number is newer than the one last taken. `sent` / `rejected` — of the push
 * this answer belongs to: an accepted change is no longer pending (unless it changed again
 * since), a refused one is dropped.
 */
export function mergeSettings(
  local: SyncedValues,
  rev: Partial<Record<string, number>>,
  dirty: readonly string[],
  server: ServerSettings,
  sent: readonly SettingChange[] = [],
  rejected: readonly string[] = [],
): { values: Partial<SyncedValues>; rev: Partial<Record<string, number>>; dirty: string[] } {
  const stillDirty = dirty.filter((key) => {
    if (rejected.includes(key)) return false;
    const s = sent.find((c) => c.key === key && c.mode === 'set');
    return !(s && s.value === local[key as SyncedSetting]);
  });
  const values: Partial<SyncedValues> = {};
  const nextRev = { ...rev };
  for (const key of SYNCED_SETTINGS) {
    const remote = server[key];
    if (!remote || stillDirty.includes(key)) continue;
    if (nextRev[key] !== undefined && remote.rev <= nextRev[key]!) continue;
    nextRev[key] = remote.rev;
    if (validSetting(key, remote.value) && remote.value !== local[key]) values[key] = remote.value;
  }
  return { values, rev: nextRev, dirty: stillDirty };
}
