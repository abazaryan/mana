/**
 * The database side of sync (stage 6a.3, R39): the send queue, the outcome of a push, a received
 * page. Each step is one transaction: received records and the cursor are stored together; the
 * send status of a record lives only in `outbox`.
 */
import Dexie from 'dexie';
import type { FSRS } from 'ts-fsrs';
import { rebuildCards } from '../core/cards';
import { reviveRecord } from '../core/journalRecord';
import type { LogRecord, MetaRow, OutboxRow, SettingsRow, SyncState } from '../core/model';
import { batchLength, hasNewerRules, mergeSettings, settingsToSend, touchedCards, type SyncedValues } from '../core/sync';
import { SYNCED_SETTINGS, type PullResponse, type PushResponse, type ServerSettings, type SettingChange } from '../core/syncProtocol';
import type { ManaDb } from './db';
import { rebuildCardKeys } from './repo';
import { notifyQueued } from './syncEvents';

const EMPTY: SyncState = { cursor: 0, settingsRev: {}, dirty: [] };

export const syncOf = (meta: MetaRow): SyncState => meta.sync ?? EMPTY;

const valuesOf = (s: SettingsRow): SyncedValues => ({ uiLang: s.uiLang, meaningLang: s.meaningLang, newPerDay: s.newPerDay });

async function deviceRow(db: ManaDb): Promise<MetaRow> {
  const meta = await db.meta.get('device');
  if (!meta) throw new Error('sync: no device row');
  return meta;
}

const pendingRows = (db: ManaDb) => db.outbox.where('[status+queuedAt]').between(['pending', Dexie.minKey], ['pending', Dexie.maxKey]);

/** Waiting to be sent, and refused by the server (for the account section). */
export async function queueCounts(db: ManaDb): Promise<{ pending: number; notAccepted: number }> {
  const [pending, all] = await Promise.all([pendingRows(db).count(), db.outbox.count()]);
  return { pending, notAccepted: all - pending };
}

export interface Batch {
  /** Records in this push, in queue order. */
  ids: string[];
  settings: SettingChange[];
  /** The push body as JSON text: `{"records":[…],"settings":[…]}`. */
  body: string;
}

/**
 * The next push: pending records in queue order (each as JSON.stringify writes it — the same
 * text every time), at most `maxCount` and `maxBytes`; with them the settings to send. Null —
 * nothing to send. `withSettings` false: records only (the push while the page goes away).
 */
export async function nextBatch(db: ManaDb, maxCount: number, maxBytes: number, withSettings = true): Promise<Batch | null> {
  const meta = await deviceRow(db);
  if (!meta.account) return null;
  const sync = syncOf(meta);
  const local = withSettings ? await db.settings.get(meta.userId) : undefined;
  const settings = local ? settingsToSend(valuesOf(local), sync.settingsRev, sync.dirty) : [];
  const settingsJson = settings.length > 0 ? `,"settings":${JSON.stringify(settings)}` : '';
  const rows = await pendingRows(db).limit(maxCount).toArray();
  const records = await db.log.bulkGet(rows.map((r) => r.id));
  const texts: string[] = [];
  const ids: string[] = [];
  records.forEach((r, i) => {
    if (!r) return;
    texts.push(JSON.stringify(r));
    ids.push(rows[i]!.id);
  });
  const n = batchLength(texts, maxCount, maxBytes, new TextEncoder().encode(settingsJson).byteLength);
  if (n === 0 && settings.length === 0) return null;
  return { ids: ids.slice(0, n), settings, body: `{"records":[${texts.slice(0, n).join(',')}]${settingsJson}}` };
}

/**
 * The outcome of a push: stored and duplicate records leave the queue; refused and conflicting
 * ones stay with their reason and are not sent again by themselves. The account's settings
 * from the answer are applied. Returns whether settings on this device changed.
 */
export async function applyPushResult(db: ManaDb, batch: Batch, res: PushResponse, now = new Date()): Promise<boolean> {
  return db.transaction('rw', [db.outbox, db.meta, db.settings], async () => {
    const sent = new Set(batch.ids);
    const mine = (id: string | null): id is string => id !== null && sent.has(id);
    await db.outbox.bulkDelete([...res.stored, ...res.duplicate].filter(mine));
    const refused: [string, string][] = [
      ...res.conflict.filter(mine).map((id): [string, string] => [id, 'conflict']),
      ...res.rejected.filter((r) => mine(r.id)).map((r): [string, string] => [r.id!, r.reason]),
    ];
    for (const [id, reason] of refused) {
      await db.outbox.update(id, { status: reason === 'conflict' ? 'conflict' : 'rejected', reason } satisfies Partial<OutboxRow>);
    }
    return takeSettings(db, res.settings, batch.settings, res.settingsRejected, now);
  });
}

/** The account's settings into this device (inside the caller's transaction); true — a value changed. */
async function takeSettings(db: ManaDb, server: ServerSettings, sent: readonly SettingChange[], rejected: readonly string[], now: Date, extra: Partial<SyncState> = {}): Promise<boolean> {
  const meta = await deviceRow(db);
  const sync = syncOf(meta);
  const local = await db.settings.get(meta.userId);
  let changed = false;
  let next: SyncState = { ...sync, ...extra };
  if (local) {
    const merged = mergeSettings(valuesOf(local), sync.settingsRev, sync.dirty, server, sent, rejected);
    next = { ...next, settingsRev: merged.rev, dirty: merged.dirty };
    if (Object.keys(merged.values).length > 0) {
      await db.settings.put({ ...local, ...merged.values, updatedAt: now } as SettingsRow);
      changed = true;
    }
  }
  await db.meta.put({ ...meta, sync: next });
  return changed;
}

export interface PullOutcome {
  added: number;
  more: boolean;
  /** Settings on this device changed. */
  settingsChanged: boolean;
  /** Records with newer scheduling rules came: saved, cards not rebuilt, the app must update. */
  newerRules: boolean;
}

/**
 * A received page in one transaction: new records (those already here — this device's own too —
 * are skipped), the cursor, the touched cards rebuilt from their whole history, the settings.
 * With records of newer rules: everything is saved, but the cards are left for after the update.
 * A record this version cannot read stops the page: nothing is stored, the cursor stays.
 */
export async function applyPull(db: ManaDb, scheduler: FSRS, res: PullResponse, build: number, now = new Date()): Promise<PullOutcome> {
  return db.transaction('rw', [db.meta, db.log, db.cards, db.settings], async () => {
    const meta = await deviceRow(db);
    const records = res.records.map((r) => {
      const rec = reviveRecord(r, meta.userId);
      if (!rec) throw new Error('sync: a received record does not read');
      return rec;
    });
    const known = await db.log.bulkGet(records.map((r) => String(r.id)));
    const fresh = records.filter((_, i) => !known[i]);
    if (fresh.length > 0) await db.log.bulkAdd(fresh as unknown as LogRecord[]);
    const sync = syncOf(meta);
    const newerRules = hasNewerRules(fresh) || sync.needsRebuild === true;
    const extra: Partial<SyncState> = { cursor: res.next };
    if (newerRules) {
      extra.needsRebuild = true;
      if (hasNewerRules(fresh)) extra.needsUpdate = { reason: 'rules', build, at: now };
    } else {
      await rebuildCardKeys(db, scheduler, meta.userId, touchedCards(fresh));
    }
    const settingsChanged = await takeSettings(db, res.settings, [], [], now, extra);
    return { added: fresh.length, more: res.more, settingsChanged, newerRules: hasNewerRules(fresh) };
  });
}

/** This version is older than the account's data (426, or newer rules): no exchange until it updates. */
export async function markNeedsUpdate(db: ManaDb, reason: 'client' | 'rules', build: number, now = new Date()): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    const meta = await deviceRow(db);
    await db.meta.put({ ...meta, sync: { ...syncOf(meta), needsUpdate: { reason, build, at: now } } });
  });
}

/** The last exchange went through to the end (so the account has the consent it needs). */
export async function markSynced(db: ManaDb, now = new Date()): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    const meta = await deviceRow(db);
    const { needsConsent: _given, ...sync } = syncOf(meta);
    await db.meta.put({ ...meta, sync: { ...sync, lastOkAt: now } });
  });
}

/**
 * The server wants the account's consent to notice `version` first (403 consent_required, R39):
 * no exchange in this run; the queue stays and goes after the consent. The screen for a new
 * consent comes with stage 6a.5; until then the device does not sync, without retries.
 */
export async function markNeedsConsent(db: ManaDb, version: number, now = new Date()): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    const meta = await deviceRow(db);
    await db.meta.put({ ...meta, sync: { ...syncOf(meta), needsConsent: { version, at: now } } });
  });
}

/**
 * At start, after the app was updated: the mark of an older version goes, and cards left
 * unbuilt because of newer rules are rebuilt once this version knows those rules. True — the
 * mark still holds (this is not a newer version yet).
 */
export async function settleUpdate(db: ManaDb, scheduler: FSRS, build: number, rulesVersion: number): Promise<boolean> {
  return db.transaction('rw', [db.meta, db.log, db.cards], async () => {
    const meta = await deviceRow(db);
    const sync = meta.sync;
    if (!sync) return false;
    let next = sync;
    if (sync.needsUpdate && build > sync.needsUpdate.build) {
      const { needsUpdate: _gone, ...rest } = next;
      next = rest;
    }
    if (next.needsRebuild && !next.needsUpdate) {
      const newest = await db.log
        .where('[userId+at]')
        .between([meta.userId, Dexie.minKey], [meta.userId, Dexie.maxKey])
        .filter((r) => r.type === 'review' && typeof r.rules === 'number' && r.rules > rulesVersion)
        .first();
      if (newest) {
        next = { ...next, needsUpdate: { reason: 'rules', build, at: new Date() } };
      } else {
        const log = await db.log.where('[userId+at]').between([meta.userId, Dexie.minKey], [meta.userId, Dexie.maxKey]).toArray();
        await db.cards.where('[userId+deckId]').between([meta.userId, Dexie.minKey], [meta.userId, Dexie.maxKey]).delete();
        await db.cards.bulkPut(rebuildCards(scheduler, log, meta.userId));
        const { needsRebuild: _done, ...rest } = next;
        next = rest;
      }
    }
    if (next !== sync) await db.meta.put({ ...meta, sync: next });
    return next.needsUpdate !== undefined;
  });
}

/**
 * Settings saved on this device. A synced key that changed is pending for the server — only
 * while signed in; the first exchange after sign-in sends every key anyway. True — it changed.
 */
export async function saveSettings(db: ManaDb, row: SettingsRow): Promise<boolean> {
  const queued = await db.transaction('rw', [db.settings, db.meta], async () => {
    const before = await db.settings.get(row.userId);
    await db.settings.put(row);
    const meta = await deviceRow(db);
    const keys = before ? SYNCED_SETTINGS.filter((k) => before[k] !== row[k]) : [];
    if (!meta.account || meta.account.userId !== row.userId || keys.length === 0) return false;
    const sync = syncOf(meta);
    await db.meta.put({ ...meta, sync: { ...sync, dirty: [...new Set([...sync.dirty, ...keys])] } });
    return true;
  });
  if (queued) notifyQueued();
  return queued;
}
