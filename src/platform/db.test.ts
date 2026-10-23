import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { ManaDb } from './db';

/** The schema before stage 6a.3, as the phone has it now. */
class ManaDbV1 extends Dexie {
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      meta: 'key',
      settings: 'userId',
      decks: 'id',
      entries: '[deckId+entryId], deckId, [deckId+position]',
      media: '[deckId+path], deckId',
      log: 'id, [userId+at], [userId+deckId+entryId+skill+at], [userId+deckId+entryId+type]',
      cards: '[userId+deckId+entryId+skill], [userId+due], [userId+deckId]',
    });
  }
}

let n = 0;
const names: string[] = [];
const fresh = () => {
  const name = `upgrade-${++n}-${Date.now()}`;
  names.push(name);
  return name;
};
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name);
});

describe('schema version 2 (stage 6a.3)', () => {
  it('a version 1 database opens with every row in place and an empty send queue', async () => {
    const name = fresh();
    const old = new ManaDbV1(name);
    await old.table('meta').put({ key: 'device', userId: 'u', deviceId: 'd', createdAt: new Date(0), rulesVersion: 2 });
    await old.table('log').bulkPut([
      { id: 'r1', type: 'intro', userId: 'u', at: new Date(1), deckId: 'k', entryId: 'e', skill: null },
      { id: 'r2', type: 'review', userId: 'u', at: new Date(2), deckId: 'k', entryId: 'e', skill: 'speak' },
    ]);
    await old.table('cards').put({ userId: 'u', deckId: 'k', entryId: 'e', skill: 'speak', due: new Date(3) });
    old.close();

    const db = new ManaDb(name);
    expect(db.verno).toBe(2);
    expect(await db.log.count()).toBe(2);
    expect(await db.cards.count()).toBe(1);
    expect(await db.meta.get('device')).toMatchObject({ userId: 'u', rulesVersion: 2 });
    expect(await db.outbox.count()).toBe(0);
    expect(await db.log.where('[userId+at]').between(['u', Dexie.minKey], ['u', Dexie.maxKey]).count()).toBe(2);
    db.close();
  });

  it('another window still on version 1 is told (versionchange) and closes, so the upgrade is not blocked', async () => {
    const name = fresh();
    const old = new ManaDbV1(name);
    await old.open();
    let told = 0;
    old.on('versionchange', () => {
      told++;
    });
    const db = new ManaDb(name);
    await db.open();
    expect(told).toBe(1);
    expect(db.verno).toBe(2);
    db.close();
  });

  it('the old code with a version 2 database afterwards: Dexie 4 opens it and reads the old tables (no VersionError)', async () => {
    const name = fresh();
    const db = new ManaDb(name);
    await db.log.put({ id: 'r1', type: 'intro', userId: 'u', at: new Date(1), deckId: 'k', entryId: 'e', skill: null } as never);
    db.close();
    const old = new ManaDbV1(name);
    const opened = await old.open().then(
      () => 'opened',
      (e: unknown) => (e instanceof Error ? e.name : 'error'),
    );
    expect(opened).toBe('opened');
    expect(await old.table('log').count()).toBe(1);
    old.close();
  });
});
