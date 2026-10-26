/**
 * A device that lost its account (R33 item 13, owner's remark 1 on 6a.5b): the mark
 * `meta.accountLost` is set by a 401 to a signed-in device — the first request at start included —
 * and by deleting the account here; it survives a reload (it is in the database), goes with a new
 * sign-in and with clearing the device, and is never set on a device that was not signed in.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScheduler } from '../src/core/scheduler';
import { setUnauthorizedHandler } from '../src/platform/api';
import { ManaDb } from '../src/platform/db';
import { adoptAccount, ensureDevice, finishAccountDeletion, markAccountLost, markSignedIn, markSignedOut } from '../src/platform/repo';
import { wipeDevice } from '../src/platform/wipe';
import { refreshAccount } from '../src/ui/signIn';

const ACCOUNT = '11111111-2222-4333-8444-555555555555';
const NOW = new Date(Date.UTC(2026, 9, 26, 22));

const open: ManaDb[] = [];
let n = 0;
function freshDb(): ManaDb {
  const db = new ManaDb(`lost-${++n}-${Date.now()}`);
  open.push(db);
  return db;
}
afterEach(async () => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

async function signedInDevice(db: ManaDb) {
  await ensureDevice(db);
  return markSignedIn(db, ACCOUNT, 'Laptop', NOW);
}

/** The server answers every request with this status (fetch of the page, stubbed). */
function serverAnswers(status: number) {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(status === 401 ? { error: 'unauthorized' } : {}), { status }));
}

describe('the mark of a lost account (meta.accountLost)', () => {
  it('a 401 at start (the first request, /api/auth/me): the account mark goes, the mark stays in the database', async () => {
    const db = freshDb();
    await signedInDevice(db);
    serverAnswers(401);
    let lost: Promise<unknown> | null = null;
    setUnauthorizedHandler(() => {
      lost = markAccountLost(db, NOW);
    });
    await refreshAccount(db, createScheduler());
    expect(lost).not.toBeNull();
    await lost;
    // A reload reads the row again: the mark is there.
    const meta = await db.meta.get('device');
    expect(meta?.account).toBeUndefined();
    expect(meta?.accountLost).toEqual({ reason: 'session', at: NOW });
  });

  it('a device that was not signed in gets no mark', async () => {
    const db = freshDb();
    const before = await ensureDevice(db);
    const after = await markAccountLost(db, NOW);
    expect(after).toEqual(before);
    expect(after.accountLost).toBeUndefined();
  });

  it('the person signs out: no mark (nothing was lost)', async () => {
    const db = freshDb();
    await signedInDevice(db);
    expect((await markSignedOut(db)).accountLost).toBeUndefined();
  });

  it('deleted here: the mark says so', async () => {
    const db = freshDb();
    await signedInDevice(db);
    expect((await finishAccountDeletion(db, NOW)).accountLost).toEqual({ reason: 'deleted', at: NOW });
  });

  it('a new sign-in takes the mark away — without answers and with a transfer of answers', async () => {
    const plain = freshDb();
    await signedInDevice(plain);
    await markAccountLost(plain, NOW);
    expect((await markSignedIn(plain, ACCOUNT, 'Laptop', NOW)).accountLost).toBeUndefined();

    const withAnswers = freshDb();
    await signedInDevice(withAnswers);
    await finishAccountDeletion(withAnswers, NOW);
    const adopted = await adoptAccount(withAnswers, createScheduler(), '66666666-2222-4333-8444-555555555555', 'Laptop', [], NOW);
    expect(adopted.meta.accountLost).toBeUndefined();
  });

  it('clearing the device takes the mark away with the data', async () => {
    const db = new ManaDb('mana');
    await signedInDevice(db);
    await markAccountLost(db, NOW);
    await wipeDevice({ local: null, session: null, close: () => db.close() });
    const fresh = new ManaDb('mana');
    expect((await ensureDevice(fresh)).accountLost).toBeUndefined();
    fresh.close();
    await fresh.delete();
  });
});
