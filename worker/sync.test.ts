import { describe, expect, it } from 'vitest';
import { canonicalJson, FUTURE_SLACK_MS } from '../src/core/journalRecord.ts';
import { PULL_MAX, PUSH_BODY_LIMIT, PUSH_MAX_RECORDS, type PullResponse, type PushResponse } from '../src/core/syncProtocol.ts';
import { ROUTES, type Routes } from './api.ts';
import { DAY, HOUR, send, signedIn, T0, world, type SignedIn, type World } from './test/accounts.ts';
import { makePush } from './sync.ts';
import { sha256Hex } from './tokens.ts';

let n = 0;
function record(who: SignedIn, extra: Record<string, unknown> = {}): Record<string, unknown> {
  n++;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    type: 'review',
    userId: who.userId,
    deviceId: who.deviceId,
    at: new Date(T0 - HOUR + n).toISOString(),
    deckId: 'test-speak',
    entryId: `e${n % 7}`,
    deckRevision: 9,
    sessionId: 's1',
    skill: 'speak',
    final: 3,
    suggested: 3,
    rules: 2,
    answer: 'bonjour',
    fsrs: { stateBefore: 2, dueBefore: new Date(T0 - DAY).toISOString(), nextDue: new Date(T0 + 3 * DAY).toISOString() },
    ...extra,
  };
}

const pushTo = (w: World, who: SignedIn, body: unknown, opts: { now?: number; routes?: Routes } = {}) =>
  send(w, '/api/sync/push', { body, cookie: who.cookie, ...opts });
async function pushed(w: World, who: SignedIn, body: unknown, opts: { now?: number; routes?: Routes } = {}): Promise<PushResponse> {
  const res = await pushTo(w, who, body, opts);
  expect(res.status).toBe(200);
  return (await res.json()) as PushResponse;
}
async function pulled(w: World, who: SignedIn, query = ''): Promise<{ text: string; body: PullResponse }> {
  const res = await send(w, `/api/sync/pull${query}`, { method: 'GET', cookie: who.cookie });
  expect(res.status).toBe(200);
  const text = await res.text();
  return { text, body: JSON.parse(text) as PullResponse };
}
const count = (w: World, sql: string) => (w.db.sqlite.prepare(sql).get() as { n: number }).n;

const RETURNING_OFF: Routes = { ...ROUTES, '/api/sync/push': { POST: { ...ROUTES['/api/sync/push']!.POST!, handle: makePush(false) } } };

for (const [mode, routes] of [
  ['RETURNING', ROUTES],
  ['without RETURNING (SELECT before the insert)', RETURNING_OFF],
] as const) {
  describe(`push — ${mode}`, () => {
    it('stored, then the same again → duplicate; same id, other content → conflict, the row stays', async () => {
      const w = world();
      const a = await signedIn(w);
      const recs = [record(a), record(a), record(a)];
      expect(await pushed(w, a, { records: recs }, { routes })).toMatchObject({ stored: recs.map((r) => r.id), duplicate: [], conflict: [], rejected: [] });
      expect(await pushed(w, a, { records: recs }, { routes })).toMatchObject({ stored: [], duplicate: recs.map((r) => r.id) });
      const changed = { ...recs[0]!, final: 1 };
      expect(await pushed(w, a, { records: [changed, recs[1]] }, { routes })).toMatchObject({ stored: [], duplicate: [recs[1]!.id], conflict: [recs[0]!.id] });
      const row = w.db.sqlite.prepare('SELECT body, body_hash FROM journal WHERE id = ?').get(recs[0]!.id) as { body: string; body_hash: string };
      expect(row.body).toBe(canonicalJson(recs[0]));
      expect(row.body_hash).toBe(await sha256Hex(canonicalJson(recs[0])));
    });

    it('another key order is the same record (canonical JSON)', async () => {
      const w = world();
      const a = await signedIn(w);
      const r = record(a);
      await pushed(w, a, { records: [r] }, { routes });
      const reversed = Object.fromEntries(Object.entries(r).reverse());
      expect(await pushed(w, a, { records: [reversed] }, { routes })).toMatchObject({ duplicate: [r.id] });
    });

    it('one id twice in a push: the same content — one copy; different — both conflict, nothing stored', async () => {
      const w = world();
      const a = await signedIn(w);
      const same = record(a);
      const other = record(a);
      const res = await pushed(w, a, { records: [same, same, other, { ...other, final: 1 }] }, { routes });
      expect(res).toMatchObject({ stored: [same.id], duplicate: [], conflict: [other.id] });
      expect(count(w, 'SELECT count(*) AS n FROM journal')).toBe(1);
    });
  });
}

describe('push — checks', () => {
  it('refusals with reasons; the valid records of the same push are stored', async () => {
    const w = world();
    const a = await signedIn(w);
    const good = record(a);
    const recs = [
      good,
      record(a, { userId: crypto.randomUUID() }),
      record(a, { at: new Date(T0 + FUTURE_SLACK_MS + 1).toISOString() }),
      record(a, { at: '2026-09-30T23:59:59.999Z' }),
      record(a, { final: 9 }),
      record(a, { pad: 'x'.repeat(17_000) }),
      'not a record',
    ];
    const res = await pushed(w, a, { records: recs });
    expect(res.stored).toEqual([good.id]);
    expect(res.rejected.map((r) => r.reason)).toEqual(['user', 'future', 'past', 'schema', 'size', 'schema']);
    expect(res.rejected[0]!.id).toBe(recs[1]!.id);
    expect(res.serverTime).toBe(T0);
  });

  it('a record of another device of the account is taken (6a.4); an unknown later type too', async () => {
    const w = world();
    const a = await signedIn(w);
    const later = { ...record(a, { deviceId: 'an-older-device' }), type: 'practice', skill: undefined, final: undefined, fsrs: undefined, extra: { x: [1] } };
    const res = await pushed(w, a, { records: [later] });
    expect(res.stored).toEqual([later.id]);
    const row = w.db.sqlite.prepare('SELECT type, rules, device_id FROM journal').get();
    expect(row).toEqual({ type: 'practice', rules: null, device_id: 'an-older-device' });
  });

  it('a failure in the middle of the batch keeps nothing: no records, no settings, no seq used', async () => {
    const w = world();
    const a = await signedIn(w);
    await pushed(w, a, { records: [record(a)] });
    const seq = count(w, "SELECT seq AS n FROM sqlite_sequence WHERE name = 'journal'");
    w.db.sqlite.exec("CREATE TRIGGER boom BEFORE INSERT ON journal WHEN NEW.entry_id = 'boom' BEGIN SELECT RAISE(ABORT, 'boom'); END");
    const res = await pushTo(w, a, { records: [record(a), record(a, { entryId: 'boom' }), record(a)], settings: [{ key: 'newPerDay', value: 10, mode: 'set' }] });
    expect(res.status).toBe(500);
    expect(count(w, 'SELECT count(*) AS n FROM journal')).toBe(1);
    expect(count(w, 'SELECT count(*) AS n FROM user_settings')).toBe(0);
    expect(count(w, "SELECT seq AS n FROM sqlite_sequence WHERE name = 'journal'")).toBe(seq);
  });

  it('the number of queries does not grow with the push', async () => {
    const w = world();
    const a = await signedIn(w);
    const calls: number[] = [];
    for (const size of [1, PUSH_MAX_RECORDS]) {
      let prepared = 0;
      const prepare = w.db.prepare;
      w.db.prepare = (sql: string) => {
        prepared++;
        return prepare(sql);
      };
      await pushed(w, a, { records: Array.from({ length: size }, () => record(a)) });
      w.db.prepare = prepare;
      calls.push(prepared);
    }
    expect(calls[0]).toBe(calls[1]);
    expect(calls[0]).toBeLessThanOrEqual(6);
  });

  it(`at most ${PUSH_MAX_RECORDS} records; a body over 1 MiB is 413; JSON only; old app 426; no session 401`, async () => {
    const w = world();
    const a = await signedIn(w);
    expect((await pushTo(w, a, { records: Array.from({ length: PUSH_MAX_RECORDS + 1 }, () => record(a)) })).status).toBe(400);
    expect((await pushTo(w, a, { records: 'x' })).status).toBe(400);
    const big = JSON.stringify({ records: [], pad: 'x'.repeat(PUSH_BODY_LIMIT) });
    expect((await send(w, '/api/sync/push', { raw: big, cookie: a.cookie })).status).toBe(413);
    expect((await send(w, '/api/sync/push', { raw: '{"records":[]}', cookie: a.cookie, headers: { 'Content-Type': 'text/plain' } })).status).toBe(415);
    expect((await send(w, '/api/sync/push', { body: { records: [] }, cookie: a.cookie, headers: { 'X-Mana-Version': '202610210000' } })).status).toBe(426);
    expect((await send(w, '/api/sync/push', { body: { records: [] } })).status).toBe(401);
    expect((await send(w, '/api/sync/push', { body: { records: [] }, cookie: a.cookie, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(403);
  });

  it('a push of the largest size: 200 records of ≈ 5 KB in one body under 1 MiB', async () => {
    const w = world();
    const a = await signedIn(w);
    const recs = Array.from({ length: PUSH_MAX_RECORDS }, () => record(a, { pad: 'é'.repeat(2400) }));
    expect(JSON.stringify({ records: recs }).length).toBeLessThan(PUSH_BODY_LIMIT);
    expect((await pushed(w, a, { records: recs })).stored).toHaveLength(PUSH_MAX_RECORDS);
  });
});

describe('pull', () => {
  it('records after the cursor in seq order, limit and "more"; bodies exactly as stored', async () => {
    const w = world();
    const a = await signedIn(w);
    const recs = Array.from({ length: 5 }, () => record(a));
    await pushed(w, a, { records: recs });
    const first = await pulled(w, a, '?after=0&limit=3');
    expect(first.body.records.map((r) => (r as { id: string }).id)).toEqual(recs.slice(0, 3).map((r) => r.id));
    expect(first.body.more).toBe(true);
    expect(first.text.startsWith(`{"records":[${canonicalJson(recs[0])},`)).toBe(true);
    const rest = await pulled(w, a, `?after=${first.body.next}`);
    expect(rest.body.records).toHaveLength(2);
    expect(rest.body.more).toBe(false);
    const none = await pulled(w, a, `?after=${rest.body.next}`);
    expect(none.body).toMatchObject({ records: [], more: false, next: rest.body.next, serverTime: T0 });
  });

  it("only the account's own records; every device of it gets them, its own ones too", async () => {
    const w = world();
    const a = await signedIn(w);
    const b = await signedIn(w, a.userId);
    const other = await signedIn(w);
    await pushed(w, a, { records: [record(a)] });
    await pushed(w, other, { records: [record(other)] });
    expect((await pulled(w, b)).body.records).toHaveLength(1);
    expect((await pulled(w, a)).body.records).toHaveLength(1);
    expect((await pulled(w, other)).body.records).toHaveLength(1);
  });

  it(`bad cursor or limit 400; limit up to ${PULL_MAX}; old app 426 (R39); no session 401`, async () => {
    const w = world();
    const a = await signedIn(w);
    for (const q of ['?after=-1', '?after=x', `?limit=${PULL_MAX + 1}`, '?limit=0']) {
      expect((await send(w, `/api/sync/pull${q}`, { method: 'GET', cookie: a.cookie })).status, q).toBe(400);
    }
    expect((await send(w, '/api/sync/pull', { method: 'GET', cookie: a.cookie, headers: { 'X-Mana-Version': '202610210000' } })).status).toBe(426);
    expect((await send(w, '/api/sync/pull', { method: 'GET' })).status).toBe(401);
    const res = await send(w, '/api/sync/pull', { method: 'GET', cookie: a.cookie });
    expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('settings', () => {
  it('set: the change the server got last wins; init only where the account has none', async () => {
    const w = world();
    const a = await signedIn(w);
    const b = await signedIn(w, a.userId);
    let res = await pushed(w, a, { records: [], settings: [{ key: 'uiLang', value: 'tg', mode: 'init' }, { key: 'newPerDay', value: 5, mode: 'init' }] });
    expect(res.settings).toEqual({ uiLang: { value: 'tg', rev: 1 }, newPerDay: { value: 5, rev: 1 } });
    res = await pushed(w, b, { records: [], settings: [{ key: 'uiLang', value: 'ru', mode: 'init' }, { key: 'meaningLang', value: 'ru', mode: 'init' }] });
    expect(res.settings).toEqual({ uiLang: { value: 'tg', rev: 1 }, newPerDay: { value: 5, rev: 1 }, meaningLang: { value: 'ru', rev: 2 } });
    res = await pushed(w, b, { records: [], settings: [{ key: 'newPerDay', value: 10, mode: 'set' }] });
    expect(res.settings.newPerDay).toEqual({ value: 10, rev: 3 });
    res = await pushed(w, a, { records: [], settings: [{ key: 'newPerDay', value: 15, mode: 'set' }] });
    expect(res.settings.newPerDay).toEqual({ value: 15, rev: 4 });
    expect((await pulled(w, b)).body.settings).toEqual(res.settings);
  });

  it('unknown keys and values are refused by key; the rest is stored', async () => {
    const w = world();
    const a = await signedIn(w);
    const res = await pushed(w, a, {
      records: [],
      settings: [
        { key: 'systemKeyboard', value: true, mode: 'set' },
        { key: 'uiLang', value: 'fr', mode: 'set' },
        { key: 'newPerDay', value: 2.5, mode: 'set' },
        { key: 'meaningLang', value: 'en', mode: 'set' },
      ],
    });
    expect(res.settingsRejected).toEqual(['systemKeyboard', 'uiLang', 'newPerDay']);
    expect(res.settings).toEqual({ meaningLang: { value: 'en', rev: 1 } });
    expect((await pushTo(w, a, { records: [], settings: [{ key: 'uiLang', value: 'tg', mode: 'later' }] })).status).toBe(400);
  });
});

describe('the device seen', () => {
  it('last_seen_at at most once an hour', async () => {
    const w = world();
    const a = await signedIn(w);
    const seen = () => (w.db.sqlite.prepare('SELECT last_seen_at AS n FROM devices WHERE id = ?').get(a.deviceId) as { n: number }).n;
    await pushed(w, a, { records: [] }, { now: T0 + 30 * 60_000 });
    expect(seen()).toBe(T0);
    await pushed(w, a, { records: [] }, { now: T0 + HOUR });
    expect(seen()).toBe(T0 + HOUR);
  });
});
