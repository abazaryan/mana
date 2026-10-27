/**
 * The account (stage 6a.5, R42): erasure (steps, budget of queries, interruptions, no traces),
 * the export, consent again and the fields of /api/auth/me.
 */
import { describe, expect, it } from 'vitest';
import type { ExportHead, ExportJournalPage } from '../src/core/accountRows.ts';
import { canonicalJson } from '../src/core/journalRecord.ts';
import { NOTICE_VERSION } from '../src/core/notice.ts';
import { traceSql, tracesFrom } from '../tools/admin/traces.ts';
import { continueErasure, cronBudget, startErasure, type EraseBudget } from './account.ts';
import { cleanup } from './cleanup.ts';
import { ERASE_PORTION, QUERIES_PER_INVOCATION } from './config.ts';
import { DAY, HOUR, send, signedIn, T0, world, type SignedIn, type World } from './test/accounts.ts';
import { sha256Hex } from './tokens.ts';

const count = (w: World, sql: string, ...params: string[]) => (w.db.sqlite.prepare(sql).get(...params) as { n: number }).n;
const rows = (w: World, sql: string, ...params: string[]) => w.db.sqlite.prepare(sql).all(...params) as Record<string, unknown>[];
const traces = (w: World, ids: string[]) => tracesFrom(rows(w, traceSql(ids)));

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

/** `count` journal rows of an account straight into the database (bodies name the account and the device). */
function fill(w: World, who: SignedIn, total: number): void {
  const insert = w.db.sqlite.prepare(
    `INSERT INTO journal (user_id, id, type, at, device_id, deck_id, entry_id, rules, body, body_hash, received_at)
     VALUES (?, ?, 'review', ?, ?, 'k', 'e', 2, ?, 'h', ?)`,
  );
  w.db.sqlite.exec('BEGIN');
  for (let i = 0; i < total; i++) {
    const id = crypto.randomUUID();
    insert.run(who.userId, id, T0 + i, who.deviceId, JSON.stringify({ id, userId: who.userId, deviceId: who.deviceId }), T0);
  }
  w.db.sqlite.exec('COMMIT');
}

/** An account with something in every table that names it: two devices, records, a setting, an earlier id, a code, an invitation, admin rows. */
async function fullAccount(w: World): Promise<{ a: SignedIn; b: SignedIn; alias: string; ids: string[] }> {
  const a = await signedIn(w);
  const b = await signedIn(w, a.userId);
  const alias = crypto.randomUUID();
  const push = await send(w, '/api/sync/push', { cookie: a.cookie, body: { records: [record(a), record(a)], settings: [{ key: 'uiLang', value: 'tg', mode: 'set' }] } });
  expect(push.status).toBe(200);
  expect((await send(w, '/api/auth/pairing-code', { cookie: a.cookie })).status).toBe(200);
  const sql = w.db.sqlite;
  sql.prepare('INSERT INTO user_aliases (user_id, alias_id, added_at) VALUES (?, ?, ?)').run(a.userId, alias, T0);
  sql
    .prepare("INSERT INTO invites (token_hash, kind, user_id, label, minor, created_at, expires_at) VALUES ('t1', 'device', ?, NULL, 0, ?, ?)")
    .run(a.userId, T0, T0 + DAY);
  sql.prepare("INSERT INTO admin_actions (id, at, action, user_id, detail) VALUES (?, ?, 'revoke', ?, ?)").run(crypto.randomUUID(), T0, a.userId, JSON.stringify({ device: b.deviceId }));
  sql.prepare("INSERT INTO admin_actions (id, at, action, user_id, detail) VALUES (?, ?, 'invite', NULL, '{}')").run(crypto.randomUUID(), T0);
  return { a, b, alias, ids: [a.userId, a.deviceId, b.deviceId, alias] };
}

const budget = (over: Partial<EraseBudget> = {}): EraseBudget => ({ queries: 50, portions: 100, until: Infinity, clock: () => 0, size: ERASE_PORTION, ...over });

describe('POST /api/account/delete (R42)', () => {
  it('erases everything of the account; no trace of it or its devices is left, admin rows included', async () => {
    const w = world();
    const { a, b, ids } = await fullAccount(w);
    const other = await signedIn(w);
    expect(traces(w, ids).length).toBeGreaterThan(5);

    const response = await send(w, '/api/account/delete', { cookie: a.cookie, body: { confirm: 'delete' } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ finished: true });
    expect(response.headers.get('Set-Cookie')).toMatch(/^__Host-mana_s=; .*Max-Age=0/);

    expect(traces(w, ids)).toEqual([]);
    expect(rows(w, "SELECT action, user_id, detail FROM admin_actions WHERE action = 'delete'")).toEqual([{ action: 'delete', user_id: null, detail: '{"via":"app"}' }]);
    expect(count(w, "SELECT count(*) AS n FROM admin_actions WHERE action = 'invite'")).toBe(1);
    // The other devices: a plain 401; the same device again: 401 too.
    expect((await send(w, '/api/auth/me', { method: 'GET', cookie: b.cookie })).status).toBe(401);
    expect((await send(w, '/api/account/delete', { cookie: a.cookie, body: { confirm: 'delete' } })).status).toBe(401);
    // Another account is untouched.
    expect((await send(w, '/api/auth/me', { method: 'GET', cookie: other.cookie })).status).toBe(200);
    expect(count(w, 'SELECT count(*) AS n FROM users')).toBe(1);
  });

  it('works without consent to the current notice', async () => {
    const w = world();
    const a = await signedIn(w, undefined, T0, { consent: { by: 'self', version: NOTICE_VERSION - 1 } });
    expect((await send(w, '/api/sync/pull', { method: 'GET', cookie: a.cookie })).status).toBe(403);
    const response = await send(w, '/api/account/delete', { cookie: a.cookie, body: { confirm: 'delete' } });
    expect(response.status).toBe(200);
    expect(traces(w, [a.userId, a.deviceId])).toEqual([]);
  });

  it('400 without the confirmation, 401 without a session, 426 for an old build, 403 from another site — nothing erased', async () => {
    const w = world();
    const a = await signedIn(w);
    const cases: [number, Parameters<typeof send>[2]][] = [
      [400, { cookie: a.cookie, body: {} }],
      [400, { cookie: a.cookie, body: { confirm: true } }],
      [401, { body: { confirm: 'delete' } }],
      [426, { cookie: a.cookie, body: { confirm: 'delete' }, headers: { 'X-Mana-Version': '202610010000' } }],
      [403, { cookie: a.cookie, body: { confirm: 'delete' }, headers: { 'Sec-Fetch-Site': 'cross-site' } }],
    ];
    for (const [status, options] of cases) expect((await send(w, '/api/account/delete', options)).status, JSON.stringify(options)).toBe(status);
    expect(count(w, 'SELECT count(*) AS n FROM users WHERE deleting_at IS NULL')).toBe(1);
  });

  it('a large journal: the request stays within the queries of one invocation and leaves the rest marked; the Cron finishes it', async () => {
    const w = world();
    const a = await signedIn(w);
    const b = await signedIn(w, a.userId);
    fill(w, a, 31 * ERASE_PORTION + 500);
    w.db.counter.queries = 0;
    const response = await send(w, '/api/account/delete', { cookie: a.cookie, body: { confirm: 'delete' } });
    expect(await response.json()).toEqual({ finished: false });
    expect(w.db.counter.queries).toBeLessThanOrEqual(QUERIES_PER_INVOCATION);
    expect(count(w, 'SELECT count(*) AS n FROM journal')).toBe(ERASE_PORTION + 500);
    expect(count(w, 'SELECT count(*) AS n FROM users WHERE deleting_at IS NOT NULL')).toBe(1);
    expect((await send(w, '/api/auth/me', { method: 'GET', cookie: b.cookie })).status).toBe(401);

    w.db.counter.queries = 0;
    await cleanup(w.db as unknown as D1Database, T0);
    expect(w.db.counter.queries).toBeLessThanOrEqual(QUERIES_PER_INVOCATION);
    expect(traces(w, [a.userId, a.deviceId, b.deviceId])).toEqual([]);
  });
});

describe('erasure steps and interruptions', () => {
  const db = (w: World) => w.db as unknown as D1Database;

  it('interrupted after step 1: nobody gets in (401), the Cron finishes it; one admin row only, also when step 1 runs again', async () => {
    const w = world();
    const a = await signedIn(w);
    fill(w, a, 3);
    await startErasure(db(w), a.userId, 'app', T0, budget());
    await startErasure(db(w), a.userId, 'admin', T0 + 1, budget());
    expect((await send(w, '/api/auth/me', { method: 'GET', cookie: a.cookie })).status).toBe(401);
    expect(rows(w, "SELECT detail FROM admin_actions WHERE action = 'delete'")).toEqual([{ detail: '{"via":"app"}' }]);
    expect(count(w, 'SELECT count(*) AS n FROM journal')).toBe(3);
    await cleanup(db(w), T0 + HOUR);
    expect(traces(w, [a.userId, a.deviceId])).toEqual([]);
  });

  it('a portion erases exactly the oldest n records; out of portions, time or queries — unfinished, the users row stays', async () => {
    const w = world();
    const a = await signedIn(w);
    fill(w, a, 5);
    const seqs = rows(w, 'SELECT seq FROM journal ORDER BY seq').map((r) => r.seq);
    await startErasure(db(w), a.userId, 'app', T0, budget());
    expect(await continueErasure(db(w), a.userId, budget({ size: 2, portions: 1 }))).toBe(false);
    expect(rows(w, 'SELECT seq FROM journal ORDER BY seq').map((r) => r.seq)).toEqual(seqs.slice(2));
    expect(await continueErasure(db(w), a.userId, budget({ size: 2, until: 0 }))).toBe(false);
    expect(await continueErasure(db(w), a.userId, budget({ size: 2, queries: 1 }))).toBe(false);
    expect(count(w, 'SELECT count(*) AS n FROM journal')).toBe(3);
    expect(count(w, 'SELECT count(*) AS n FROM users')).toBe(1);
    expect(await continueErasure(db(w), a.userId, budget({ size: 2 }))).toBe(true);
    expect(count(w, 'SELECT count(*) AS n FROM users')).toBe(0);
  });

  it('a record that arrives during the erasure (a push in flight) goes with the cascade', async () => {
    const w = world();
    const a = await signedIn(w);
    await startErasure(db(w), a.userId, 'app', T0, budget());
    await continueErasure(db(w), a.userId, budget({ portions: 0 }));
    fill(w, a, 2);
    expect(await continueErasure(db(w), a.userId, budget())).toBe(true);
    expect(traces(w, [a.userId, a.deviceId])).toEqual([]);
  });

  it('the Cron: several large erasures, at most 50 queries a run, all finished over a few runs', async () => {
    const w = world();
    const a = await signedIn(w);
    const b = await signedIn(w);
    fill(w, a, 30 * ERASE_PORTION);
    fill(w, b, 30 * ERASE_PORTION);
    await startErasure(db(w), a.userId, 'app', T0, budget());
    await startErasure(db(w), b.userId, 'admin', T0 + 1, budget());
    for (let run = 0; run < 3; run++) {
      w.db.counter.queries = 0;
      await cleanup(db(w), T0 + run * HOUR, cronBudget(() => 0));
      expect(w.db.counter.queries, `run ${run}`).toBeLessThanOrEqual(QUERIES_PER_INVOCATION);
    }
    expect(traces(w, [a.userId, a.deviceId, b.userId, b.deviceId])).toEqual([]);
  });
});

describe('GET /api/account/export and /api/account/export/journal (R42 item 5)', () => {
  it('the head: account, every device, consents, earlier ids, settings, admin rows, the count; no hashes of sessions, invitations or codes', async () => {
    const w = world();
    const { a, b, alias } = await fullAccount(w);
    expect((await send(w, '/api/auth/devices/revoke', { cookie: a.cookie, body: { deviceId: b.deviceId } })).status).toBe(200);
    const response = await send(w, '/api/account/export', { method: 'GET', cookie: a.cookie });
    expect(response.status).toBe(200);
    const text = await response.text();
    const head = JSON.parse(text) as ExportHead;
    expect(head.account).toEqual({ id: a.userId, createdAt: T0, label: 'test-sync', minor: false });
    // Both added at T0: the order is by id then.
    expect(head.devices.map((d) => [d.id, d.revokedAt !== null])).toEqual(
      [
        [a.deviceId, false],
        [b.deviceId, true],
      ].sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
    );
    expect(head.consents).toEqual([{ id: expect.any(String), noticeVersion: NOTICE_VERSION, givenBy: 'self', parentName: null, deviceId: a.deviceId, givenAt: T0 }]);
    expect(head.formerNumbers).toEqual([{ aliasId: alias, addedAt: T0 }]);
    expect(head.settings).toEqual([{ key: 'uiLang', value: 'tg', serverRev: 1, updatedAt: T0, deviceId: a.deviceId }]);
    expect(head.adminActions).toEqual([{ id: expect.any(String), at: T0, action: 'revoke', detail: { device: b.deviceId } }]);
    expect(head.journalCount).toBe(2);
    for (const r of rows(w, 'SELECT token_hash AS h FROM sessions UNION ALL SELECT token_hash FROM invites UNION ALL SELECT code_hash FROM pairing_codes')) {
      expect(text).not.toContain(String(r.h));
    }
  });

  it('the journal in pages: every record as stored, with seq, time received and hash', async () => {
    const w = world();
    const a = await signedIn(w);
    const recs = [record(a), record(a), record(a), record(a), record(a)];
    expect((await send(w, '/api/sync/push', { cookie: a.cookie, body: { records: recs }, now: T0 + 5 })).status).toBe(200);
    const got: ExportJournalPage[] = [];
    let after = 0;
    for (;;) {
      const response = await send(w, `/api/account/export/journal?after=${after}&limit=2`, { method: 'GET', cookie: a.cookie });
      expect(response.status).toBe(200);
      const page = (await response.json()) as ExportJournalPage;
      got.push(page);
      after = page.next;
      if (!page.more) break;
    }
    expect(got.map((p) => p.records.length)).toEqual([2, 2, 1]);
    expect(got.flatMap((p) => p.records)).toEqual(recs.map((r) => JSON.parse(canonicalJson(r))));
    const server = got.flatMap((p) => p.server);
    const stored = rows(w, 'SELECT id, seq, received_at, body_hash FROM journal ORDER BY seq');
    expect(server).toEqual(stored.map((r) => ({ id: r.id, seq: r.seq, receivedAt: r.received_at, bodyHash: r.body_hash })));
    expect(server[0]!.bodyHash).toBe(await sha256Hex(canonicalJson(recs[0])));
  });

  it('a journal page holds at most 200 records: a larger limit (an older app asks 500) is cut, the pages follow "more"', async () => {
    const w = world();
    const a = await signedIn(w);
    const recs = Array.from({ length: 250 }, () => record(a));
    for (let i = 0; i < recs.length; i += 50) {
      expect((await send(w, '/api/sync/push', { cookie: a.cookie, body: { records: recs.slice(i, i + 50) }, now: T0 + 5 })).status).toBe(200);
    }
    const sizes: number[] = [];
    let after = 0;
    for (;;) {
      const page = (await (await send(w, `/api/account/export/journal?after=${after}&limit=500`, { method: 'GET', cookie: a.cookie })).json()) as ExportJournalPage;
      sizes.push(page.records.length);
      after = page.next;
      if (!page.more) break;
    }
    expect(sizes).toEqual([200, 50]);
  });

  it('works without consent; 401 without a session; 400 for a bad cursor', async () => {
    const w = world();
    const a = await signedIn(w, undefined, T0, { consent: null });
    expect((await send(w, '/api/account/export', { method: 'GET', cookie: a.cookie })).status).toBe(200);
    expect((await send(w, '/api/account/export/journal', { method: 'GET', cookie: a.cookie })).status).toBe(200);
    expect((await send(w, '/api/account/export', { method: 'GET' })).status).toBe(401);
    expect((await send(w, '/api/account/export/journal?after=-1', { method: 'GET', cookie: a.cookie })).status).toBe(400);
    expect((await send(w, '/api/account/export/journal?limit=0', { method: 'GET', cookie: a.cookie })).status).toBe(400);
    expect((await send(w, '/api/account/export/journal?limit=x', { method: 'GET', cookie: a.cookie })).status).toBe(400);
  });
});

describe('the device name at a new sign-in (R42 item 11)', () => {
  it('a code on a device that was in the account keeps the name the person gave it', async () => {
    const w = world();
    const a = await signedIn(w);
    const b = await signedIn(w, a.userId);
    expect((await send(w, '/api/auth/device', { cookie: b.cookie, body: { name: 'Phone of Mama' } })).status).toBe(200);
    expect((await send(w, '/api/auth/logout', { cookie: b.cookie })).status).toBe(200);
    const { code } = (await (await send(w, '/api/auth/pairing-code', { cookie: a.cookie })).json()) as { code: string };
    const response = await send(w, '/api/auth/pair', { body: { code, device: { id: b.deviceId, name: 'Android · Chrome' } } });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { device: { name: string } }).device.name).toBe('Phone of Mama');
    expect(rows(w, 'SELECT name, revoked_at FROM devices WHERE id = ?', b.deviceId)).toEqual([{ name: 'Phone of Mama', revoked_at: null }]);
  });
});

describe('POST /api/auth/consent and /api/auth/me (R42 item 6)', () => {
  const adult = { version: NOTICE_VERSION, by: 'self' };
  const parent = { version: NOTICE_VERSION, by: 'parent', parentName: 'Parent Name', parentAgreed: true };
  const me = async (w: World, who: SignedIn) => (await (await send(w, '/api/auth/me', { method: 'GET', cookie: who.cookie })).json()) as { minor: boolean; needsConsent: boolean };
  const consentRows = (w: World, who: SignedIn) => rows(w, 'SELECT notice_version, given_by, parent_name, device_id FROM consents WHERE user_id = ? ORDER BY given_at', who.userId);

  it('an older consent: me says so, sync is refused; consent again — a new row, sync goes; again — 200, no new row', async () => {
    const w = world();
    const a = await signedIn(w, undefined, T0, { consent: { by: 'self', version: NOTICE_VERSION - 1 } });
    expect(await me(w, a)).toMatchObject({ minor: false, needsConsent: true });
    expect((await send(w, '/api/sync/push', { cookie: a.cookie, body: { records: [] } })).status).toBe(403);
    const response = await send(w, '/api/auth/consent', { cookie: a.cookie, body: { consent: adult }, now: T0 + 1 });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(await me(w, a)).toMatchObject({ needsConsent: false });
    expect((await send(w, '/api/sync/push', { cookie: a.cookie, body: { records: [record(a)] } })).status).toBe(200);
    expect((await send(w, '/api/auth/consent', { cookie: a.cookie, body: { consent: adult }, now: T0 + 2 })).status).toBe(200);
    expect(consentRows(w, a)).toEqual([
      { notice_version: NOTICE_VERSION - 1, given_by: 'self', parent_name: null, device_id: a.deviceId },
      { notice_version: NOTICE_VERSION, given_by: 'self', parent_name: null, device_id: a.deviceId },
    ]);
  });

  it('under 16: only a parent with a name and the mark; the own consent — 400; me says minor', async () => {
    const w = world();
    const a = await signedIn(w, undefined, T0, { minor: true, consent: { by: 'parent', version: NOTICE_VERSION - 1 } });
    expect(await me(w, a)).toMatchObject({ minor: true, needsConsent: true });
    for (const consent of [adult, { ...parent, parentName: ' ' }, { ...parent, parentAgreed: false }]) {
      const response = await send(w, '/api/auth/consent', { cookie: a.cookie, body: { consent } });
      expect(response.status, JSON.stringify(consent)).toBe(400);
      expect(await response.json()).toEqual({ error: 'consent_required' });
    }
    expect((await send(w, '/api/auth/consent', { cookie: a.cookie, body: { consent: parent } })).status).toBe(200);
    expect(consentRows(w, a).at(-1)).toEqual({ notice_version: NOTICE_VERSION, given_by: 'parent', parent_name: 'Parent Name', device_id: a.deviceId });
    expect(await me(w, a)).toMatchObject({ minor: true, needsConsent: false });
  });

  it('16 or older: a consent of a parent is not taken; another version — 400; malformed — 400 bad_request; 426, 401', async () => {
    const w = world();
    const a = await signedIn(w, undefined, T0, { consent: null });
    const cases: [number, string, Parameters<typeof send>[2]][] = [
      [400, 'consent_required', { cookie: a.cookie, body: { consent: parent } }],
      [400, 'consent_required', { cookie: a.cookie, body: { consent: { ...adult, version: NOTICE_VERSION + 1 } } }],
      [400, 'bad_request', { cookie: a.cookie, body: { consent: { version: NOTICE_VERSION, by: 'someone' } } }],
      [400, 'bad_request', { cookie: a.cookie, body: {} }],
      [426, 'upgrade_required', { cookie: a.cookie, body: { consent: adult }, headers: { 'X-Mana-Version': '202610010000' } }],
      [401, 'unauthorized', { body: { consent: adult } }],
    ];
    for (const [status, code, options] of cases) {
      const response = await send(w, '/api/auth/consent', options);
      expect(response.status, JSON.stringify(options)).toBe(status);
      expect(await response.json()).toEqual({ error: code });
    }
    expect(consentRows(w, a)).toEqual([]);
  });
});
