/**
 * The numbers of tools/admin/counts.ts (stage 6a.6): read-only, numbers only — the accounts on the
 * server and, for one account, its journal rows, devices (signed out among them), sessions,
 * consents, earlier ids and whether it is being erased. The SQL runs on the test database.
 */
import { describe, expect, it } from 'vitest';
import { countsFrom, countsSql, countsText } from '../tools/admin/countRows';
import { send, signedIn, T0, world, type SignedIn, type World } from '../worker/test/accounts';

const read = (w: World) => (text: string) => w.db.sqlite.prepare(text).all() as Record<string, unknown>[];
const counts = (w: World, userId: string | null) => countsFrom(read(w)(countsSql(userId)));

let n = 0;
const record = (who: SignedIn) => ({
  id: crypto.randomUUID(),
  type: 'intro',
  userId: who.userId,
  deviceId: who.deviceId,
  at: new Date(T0 - 1000 + n++).toISOString(),
  deckId: 'test-speak',
  entryId: `e${n}`,
  deckRevision: 9,
  sessionId: 's1',
  skill: null,
});

/** An account with three records, an earlier id and two devices, the second one signed out. */
async function account(w: World): Promise<{ a: SignedIn; b: SignedIn }> {
  const a = await signedIn(w);
  const b = await signedIn(w, a.userId);
  const body = { records: [record(a), record(a), record(a)] };
  expect((await send(w, '/api/sync/push', { cookie: a.cookie, body })).status).toBe(200);
  w.db.sqlite.prepare('INSERT INTO user_aliases (user_id, alias_id, added_at) VALUES (?, ?, ?)').run(a.userId, crypto.randomUUID(), T0);
  expect((await send(w, '/api/auth/devices/revoke', { cookie: a.cookie, body: { deviceId: b.deviceId } })).status).toBe(200);
  return { a, b };
}

describe('the counts of tools/admin/counts.ts', () => {
  it("one account's numbers; another account counts in the total only", async () => {
    const w = world();
    const { a } = await account(w);
    await signedIn(w);
    expect(counts(w, a.userId)).toEqual({
      accounts: 2,
      erasing: 0,
      account: { found: true, erasing: false, journal: 3, devices: 2, signedOut: 1, sessions: 1, consents: 1, earlierIds: 1 },
    });
  });

  it('without --user: the total only', async () => {
    const w = world();
    expect(counts(w, null)).toEqual({ accounts: 0, erasing: 0, account: null });
    await account(w);
    expect(counts(w, null)).toEqual({ accounts: 1, erasing: 0, account: null });
  });

  it('an unknown id: not found, zeros', async () => {
    const w = world();
    await account(w);
    expect(counts(w, crypto.randomUUID()).account).toEqual({
      found: false,
      erasing: false,
      journal: 0,
      devices: 0,
      signedOut: 0,
      sessions: 0,
      consents: 0,
      earlierIds: 0,
    });
  });

  it('an account being erased (users.deleting_at) is marked, in the total and for the account', async () => {
    const w = world();
    const { a } = await account(w);
    w.db.sqlite.prepare('UPDATE users SET deleting_at = ? WHERE id = ?').run(T0, a.userId);
    const c = counts(w, a.userId);
    expect(c.erasing).toBe(1);
    expect(c.account?.erasing).toBe(true);
    expect(countsText(c, a.userId)[1]).toMatch(/being erased: yes/);
  });

  it('the text: numbers and the first 8 characters of the id, nothing else of the account', async () => {
    const w = world();
    const { a } = await account(w);
    const lines = countsText(counts(w, a.userId), a.userId);
    expect(lines).toEqual([
      'Accounts: 1 (being erased: 0).',
      `Account ${a.userId.slice(0, 8)}: being erased: no, journal 3, devices 2 (signed out 1), sessions 1, consents 1, earlier ids 1.`,
    ]);
    expect(lines.join('\n')).not.toContain(a.userId);
    expect(lines.join('\n')).not.toContain('test-sync');
    expect(countsText(counts(w, crypto.randomUUID()), crypto.randomUUID())[1]).toMatch(/^No account [0-9a-f]{8}\.$/);
  });

  it('takes a UUID only', () => {
    expect(() => countsSql("x' OR 1=1 --")).toThrow();
    expect(countsSql(null)).not.toContain('journal');
  });
});
