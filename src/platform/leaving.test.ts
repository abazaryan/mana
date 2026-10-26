/**
 * Leaving on the device (stage 6a.5b, R42): clearing the data (databases, keys, a page closed
 * midway, another window holding the database), the device after the account is deleted, the
 * marks of a pending deletion and of consent, and collecting the account's copy across failures.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { ExportHead, ExportJournalPage } from '../core/accountRows';
import { parseBackup } from '../core/backup';
import { serializeAccountExport } from '../core/accountExport';
import type { LogRecord } from '../core/model';
import { WIPE_PENDING_KEY } from '../core/wipe';
import { collectCopy, emptyCopy } from './accountCopy';
import type { ApiResult } from './api';
import { ManaDb } from './db';
import { clearPendingDeletion, ensureDevice, finishAccountDeletion, forgetDeleteNotDone, markPendingDeletion, markSignedIn, setAccountState } from './repo';
import { finishPendingWipe, wipeDevice } from './wipe';

function memoryStore(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}

const names = async () => (await indexedDB.databases()).map((d) => d.name);

const open: ManaDb[] = [];
afterEach(async () => {
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});
let n = 0;
function freshDb(): ManaDb {
  const db = new ManaDb(`leaving-${++n}-${Date.now()}`);
  open.push(db);
  return db;
}

describe('clearing the data on this device (platform/wipe.ts)', () => {
  it('deletes mana and mana-lab, the keys of the app and the prototype; other databases and keys stay', async () => {
    const db = new ManaDb('mana');
    await ensureDevice(db);
    const lab = new ManaDb('mana-lab');
    await lab.open();
    lab.close();
    const other = new ManaDb('someone-else');
    await other.open();
    other.close();
    const local = memoryStore({ 'mana.labDbRemoved': '1', 'sluh.log': '[]', 'sluh.settings': '{}', 'other.key': 'x' });
    const session = memoryStore({ 'mana.updateReloadAt': '1' });

    await wipeDevice({ local, session, close: () => db.close() });

    expect(await names()).not.toContain('mana');
    expect(await names()).not.toContain('mana-lab');
    expect(await names()).toContain('someone-else');
    expect([...local.data.keys()]).toEqual(['other.key']);
    expect(session.data.size).toBe(0);
    await new ManaDb('someone-else').delete();
  });

  it('another window holding the database: blocked is said, the delete finishes once it lets go', async () => {
    const holder = new ManaDb('mana');
    await ensureDevice(holder);
    // Dexie closes on versionchange by itself; a raw connection that ignores it holds the database.
    const raw = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('mana');
      req.onsuccess = () => resolve(req.result);
    });
    holder.close();
    let blocked = false;
    const done = wipeDevice({
      local: memoryStore(),
      session: memoryStore(),
      onBlocked: () => {
        blocked = true;
        raw.close();
      },
    });
    await done;
    expect(blocked).toBe(true);
    expect(await names()).not.toContain('mana');
  });

  it('a page closed midway: the mark stays, the next start finishes the wipe; without the mark nothing happens', async () => {
    const db = new ManaDb('mana');
    await ensureDevice(db);
    db.close();
    const local = memoryStore({ [WIPE_PENDING_KEY]: '1', 'mana.labDbRemoved': '1', 'keep.me': 'x' });
    expect(await finishPendingWipe({ local, session: memoryStore() })).toBe(true);
    expect(await names()).not.toContain('mana');
    expect([...local.data.keys()]).toEqual(['keep.me']);

    const again = new ManaDb('mana');
    await ensureDevice(again);
    again.close();
    expect(await finishPendingWipe({ local, session: memoryStore() })).toBe(false);
    expect(await names()).toContain('mana');
    await new ManaDb('mana').delete();
  });
});

const ACCOUNT = '11111111-2222-4333-8444-555555555555';
const NOW = new Date(Date.UTC(2026, 9, 26, 12));

describe('the device and the account being deleted (repo)', () => {
  it('pending mark; not done — the Account section line; finished — only the ties to the account go', async () => {
    const db = freshDb();
    await ensureDevice(db);
    await markSignedIn(db, ACCOUNT, 'Laptop', NOW, ['22222222-2222-4333-8444-555555555555']);
    const meta = await db.meta.get('device');
    await db.log.add({ id: crypto.randomUUID(), type: 'intro', userId: ACCOUNT, deviceId: meta!.deviceId, at: NOW } as unknown as LogRecord);
    await db.outbox.add({ id: 'r1', status: 'pending', queuedAt: 1 });
    await db.outbox.add({ id: 'r2', status: 'rejected', reason: 'future', queuedAt: 2 });

    expect((await markPendingDeletion(db, NOW)).pendingDeletion).toEqual({ userId: ACCOUNT, at: NOW });
    const notDone = await clearPendingDeletion(db, true, NOW);
    expect(notDone.pendingDeletion).toBeUndefined();
    expect(notDone.deleteNotDone).toEqual(NOW);
    expect((await forgetDeleteNotDone(db)).deleteNotDone).toBeUndefined();
    // A new deletion forgets an old "not done".
    await clearPendingDeletion(db, true, NOW);
    expect((await markPendingDeletion(db, NOW)).deleteNotDone).toBeUndefined();

    const after = await finishAccountDeletion(db);
    expect(after.account).toBeUndefined();
    expect(after.sync).toBeUndefined();
    expect(after.formerUserIds).toBeUndefined();
    expect(after.pendingDeletion).toBeUndefined();
    expect(after.userId).toBe(ACCOUNT);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.log.count()).toBe(1);
  });

  it('what me says: under 16 and the need of consent are kept, a consent given clears the need', async () => {
    const db = freshDb();
    await ensureDevice(db);
    await markSignedIn(db, ACCOUNT, 'Laptop', NOW);
    const needs = await setAccountState(db, { minor: true, needsConsent: true }, 3, NOW);
    expect(needs.account?.minor).toBe(true);
    expect(needs.sync?.needsConsent).toEqual({ version: 3, at: NOW });
    const given = await setAccountState(db, { minor: true, needsConsent: false }, 3, NOW);
    expect(given.sync?.needsConsent).toBeUndefined();
    expect(given.sync).toMatchObject({ cursor: 0 });
  });
});

describe("the account's copy across failures (platform/accountCopy.ts)", () => {
  const head: ExportHead = {
    account: { id: ACCOUNT, createdAt: 1, label: 'test', minor: false },
    devices: [],
    consents: [],
    formerNumbers: [],
    settings: [],
    adminActions: [],
    journalCount: 3,
  };
  const rec = (i: number) => ({
    id: `00000000-0000-4000-8000-00000000000${i}`,
    type: 'intro',
    userId: ACCOUNT,
    deviceId: 'd',
    deckId: 'k',
    entryId: 'e',
    at: new Date(Date.UTC(2026, 9, 20, i)).toISOString(),
    deckRevision: 1,
    sessionId: 's',
    skill: null,
  });
  const pages: Record<number, ExportJournalPage> = {
    0: { records: [rec(1), rec(2)], server: [{ id: rec(1).id, seq: 1, receivedAt: 1, bodyHash: 'a' }, { id: rec(2).id, seq: 2, receivedAt: 1, bodyHash: 'b' }], next: 2, more: true },
    2: { records: [rec(3)], server: [{ id: rec(3).id, seq: 3, receivedAt: 1, bodyHash: 'c' }], next: 3, more: false },
  };

  it('a failed page is asked again from its cursor, the pages already here stay; the file restores', async () => {
    let failNext = true;
    const asked: number[] = [];
    const source = {
      head: async (): Promise<ApiResult<ExportHead>> => ({ ok: true, data: head }),
      page: async (after: number): Promise<ApiResult<ExportJournalPage>> => {
        asked.push(after);
        if (after === 2 && failNext) {
          failNext = false;
          return { ok: false, status: 0, error: 'offline' };
        }
        return { ok: true, data: pages[after]! };
      },
    };
    const progress = emptyCopy();
    const seen: number[] = [];
    expect(await collectCopy(source, progress, 'device-1', () => NOW, (k) => seen.push(k))).toEqual({ ok: false, status: 0 });
    const step = await collectCopy(source, progress, 'device-1', () => NOW, (k) => seen.push(k));
    expect(asked).toEqual([0, 2, 2]);
    expect(seen).toEqual([2, 3]);
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    expect(step.file.records).toHaveLength(3);
    const parsed = parseBackup(serializeAccountExport(step.file));
    expect(parsed.ok && parsed.backup.records.length).toBe(3);
  });
});
