import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultSettings, type LogRecord } from '../core/model';
import { ManaDb } from './db';
import { ensureDevice, getSettings, hasLocalAnswers, markSignedIn, markSignedOut, putSettings, renewDeviceId, setAccountDeviceName } from './repo';

let n = 0;
const open: ManaDb[] = [];
function freshDb(): ManaDb {
  const db = new ManaDb(`account-${++n}-${Date.now()}`);
  open.push(db);
  return db;
}
afterEach(async () => {
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

const NOW = new Date(Date.UTC(2026, 9, 23, 12));
const ACCOUNT = '11111111-2222-4333-8444-555555555555';

async function withAnswer(db: ManaDb) {
  const meta = await ensureDevice(db);
  await db.log.add({ id: crypto.randomUUID(), type: 'intro', userId: meta.userId, deviceId: meta.deviceId, at: NOW } as unknown as LogRecord);
}

describe('sign-in on the device (stage 6a.2)', () => {
  it('a device with any journal record has answers; a fresh one has none', async () => {
    const empty = freshDb();
    await ensureDevice(empty);
    expect(await hasLocalAnswers(empty)).toBe(false);
    const used = freshDb();
    await withAnswer(used);
    expect(await hasLocalAnswers(used)).toBe(true);
  });

  it('after sign-in the account id is the local user; the settings move with it', async () => {
    const db = freshDb();
    const meta = await ensureDevice(db);
    await putSettings(db, { ...defaultSettings(meta.userId, 'tg', NOW), newPerDay: 10 });
    const next = await markSignedIn(db, ACCOUNT, 'Windows · Edge', NOW);
    expect(next.userId).toBe(ACCOUNT);
    expect(next.deviceId).toBe(meta.deviceId);
    expect(next.account).toEqual({ userId: ACCOUNT, deviceName: 'Windows · Edge', since: NOW });
    expect(await getSettings(db, meta.userId)).toBeUndefined();
    expect((await getSettings(db, ACCOUNT))?.newPerDay).toBe(10);
  });

  it('never on a device with answers: nothing changes', async () => {
    const db = freshDb();
    await withAnswer(db);
    const before = await db.meta.get('device');
    await expect(markSignedIn(db, ACCOUNT, 'x', NOW)).rejects.toThrow(/not empty/);
    await expect(renewDeviceId(db)).rejects.toThrow(/not empty/);
    expect(await db.meta.get('device')).toEqual(before);
  });

  it('sign-out removes only the mark: user, journal and settings stay', async () => {
    const db = freshDb();
    await ensureDevice(db);
    await markSignedIn(db, ACCOUNT, 'Phone', NOW);
    await putSettings(db, defaultSettings(ACCOUNT, 'ru', NOW));
    const renamed = await setAccountDeviceName(db, 'My phone');
    expect(renamed.account?.deviceName).toBe('My phone');
    const out = await markSignedOut(db);
    expect(out.account).toBeUndefined();
    expect(out.userId).toBe(ACCOUNT);
    expect(await getSettings(db, ACCOUNT)).toBeDefined();
  });

  it('a new device id when the server says the old one is taken', async () => {
    const db = freshDb();
    const meta = await ensureDevice(db);
    const next = await renewDeviceId(db, () => 'new-id');
    expect(next.deviceId).toBe('new-id');
    expect(next.userId).toBe(meta.userId);
  });
});
