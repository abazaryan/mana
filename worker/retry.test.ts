/**
 * The retry window of sign-in (step "CPU of sign-in routes", 27.10.2026): an answer lost after the
 * batch was written (a 1102 or a 503 after the write) leaves the invitation or the code used and
 * the device without a session. The same device may then use the same invitation or code again for
 * RETRY_WINDOW: it gets a new session, its earlier session goes, nothing else is written, and a
 * retry is no failed attempt. Only a retry that matches what the first attempt wrote passes.
 */
import { describe, expect, it } from 'vitest';
import { NOTICE_VERSION } from '../src/core/notice.ts';
import { handleApi, ROUTES } from './api.ts';
import { cleanup } from './cleanup.ts';
import { CODE_TTL, INVITE_TTL, MIN_CLIENT, ORIGIN, RETRY_WINDOW } from './config.ts';
import { fakeD1, type FakeD1 } from './test/sqlite-d1.ts';
import { newToken, sha256Hex } from './tokens.ts';

const T0 = Date.UTC(2026, 9, 27, 12, 0, 0);
const MIN = 60_000;

interface World {
  db: FakeD1;
  env: Env;
}

const world = (): World => {
  const db = fakeD1();
  return { db, env: { DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, AUTH_PEPPER: 'test-pepper' } as unknown as Env };
};

function send(w: World, path: string, body: unknown, { now = T0, cookie, ip = '198.51.100.7' }: { now?: number; cookie?: string; ip?: string } = {}) {
  const headers: Record<string, string> = { 'Sec-Fetch-Site': 'same-origin', 'X-Mana-Version': String(MIN_CLIENT), 'CF-Connecting-IP': ip };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  return handleApi(new Request(`${ORIGIN}${path}`, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? null : JSON.stringify(body) }), w.env, ROUTES, now);
}

const cookieOf = (r: Response) => (r.headers.get('Set-Cookie') ?? '').split(';')[0]!;
const rows = (w: World, sql: string, ...params: (string | number)[]) => w.db.sqlite.prepare(sql).all(...params) as Record<string, unknown>[];
const count = (w: World, table: string) => (w.db.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
const uuid = () => crypto.randomUUID();
const device = (id = uuid()) => ({ id, name: 'Windows · Edge' });
const SELF = { version: NOTICE_VERSION, by: 'self' };
const PARENT = { version: NOTICE_VERSION, by: 'parent', parentName: 'Parent Name', parentAgreed: true };

async function invite(w: World, kind: 'account' | 'device' = 'account', userId: string | null = null, minor = 0) {
  const token = newToken();
  w.db.sqlite
    .prepare('INSERT INTO invites (token_hash, kind, user_id, label, minor, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(await sha256Hex(token), kind, userId, kind === 'account' ? 'test-a' : null, minor, T0, T0 + INVITE_TTL);
  return token;
}

/** A signed-in first device of a new account (adult, consent to the current notice). */
async function account(w: World) {
  const dev = device();
  const r = await send(w, '/api/auth/redeem', { token: await invite(w), device: dev, consent: SELF });
  expect(r.status).toBe(200);
  return { userId: ((await r.json()) as { userId: string }).userId, cookie: cookieOf(r), deviceId: dev.id };
}

async function code(w: World, cookie: string, now = T0): Promise<string> {
  return ((await (await send(w, '/api/auth/pairing-code', {}, { cookie, now })).json()) as { code: string }).code;
}

const sessionsOf = (w: World, deviceId: string) => rows(w, 'SELECT token_hash FROM sessions WHERE device_id = ?', deviceId).length;
const failures = (w: World) => rows(w, "SELECT count FROM auth_attempts WHERE bucket LIKE 'pair:ip:%'");

describe('redeem: the same device again within the window', () => {
  it('the answer was lost after the batch: the retry gets a new session, the earlier one goes, nothing else is written', async () => {
    const w = world();
    const token = await invite(w);
    const dev = device();
    const first = await send(w, '/api/auth/redeem', { token, device: dev, consent: SELF });
    expect(first.status).toBe(200);
    const counts = ['users', 'devices', 'consents', 'invites'].map((t) => count(w, t));
    const again = await send(w, '/api/auth/redeem', { token, device: dev, consent: SELF }, { now: T0 + 5 * MIN });
    expect(again.status).toBe(200);
    const body = (await again.json()) as { userId: string; device: { id: string } };
    expect(body.userId).toBe(((await first.json()) as { userId: string }).userId);
    expect(body.device.id).toBe(dev.id);
    expect(cookieOf(again)).not.toBe(cookieOf(first));
    expect(sessionsOf(w, dev.id)).toBe(1);
    expect((await send(w, '/api/auth/me', undefined, { cookie: cookieOf(first) })).status).toBe(401);
    expect((await send(w, '/api/auth/me', undefined, { cookie: cookieOf(again) })).status).toBe(200);
    expect(['users', 'devices', 'consents', 'invites'].map((t) => count(w, t))).toEqual(counts);
  });

  it('the lookup of the invitation answers the same device within the window, and nobody after it', async () => {
    const w = world();
    const token = await invite(w, 'account', null, 1);
    const dev = device();
    expect((await send(w, '/api/auth/redeem', { token, device: dev, consent: PARENT })).status).toBe(200);
    const mine = await send(w, '/api/auth/invite', { token, deviceId: dev.id }, { now: T0 + RETRY_WINDOW });
    expect(mine.status).toBe(200);
    expect(await mine.json()).toEqual({ kind: 'account', minor: true });
    expect(await (await send(w, '/api/auth/invite', { token, deviceId: uuid() })).json()).toEqual({ error: 'invalid' });
    expect(await (await send(w, '/api/auth/invite', { token })).json()).toEqual({ error: 'invalid' });
    expect(await (await send(w, '/api/auth/invite', { token, deviceId: dev.id }, { now: T0 + RETRY_WINDOW + 1 })).json()).toEqual({ error: 'invalid' });
    expect((await send(w, '/api/auth/invite', { token, deviceId: 'not-a-uuid' })).status).toBe(400);
  });

  it('another device with the same link gets invalid; the same device after 10 minutes too', async () => {
    const w = world();
    const token = await invite(w);
    const dev = device();
    expect((await send(w, '/api/auth/redeem', { token, device: dev, consent: SELF })).status).toBe(200);
    const stranger = await send(w, '/api/auth/redeem', { token, device: device(), consent: SELF }, { now: T0 + MIN });
    expect(await stranger.json()).toEqual({ error: 'invalid' });
    const late = await send(w, '/api/auth/redeem', { token, device: dev, consent: SELF }, { now: T0 + RETRY_WINDOW + 1 });
    expect(await late.json()).toEqual({ error: 'invalid' });
    expect(count(w, 'sessions')).toBe(1);
  });

  it('account with localUserId: the retry with it passes; without it (the device was cleared) passes too', async () => {
    const w = world();
    const token = await invite(w);
    const dev = device();
    const local = uuid();
    expect((await send(w, '/api/auth/redeem', { token, device: dev, consent: SELF, localUserId: local })).status).toBe(200);
    const withIt = await send(w, '/api/auth/redeem', { token, device: dev, consent: SELF, localUserId: local }, { now: T0 + MIN });
    expect(((await withIt.json()) as { userId: string }).userId).toBe(local);
    const without = await send(w, '/api/auth/redeem', { token, device: dev, consent: SELF }, { now: T0 + 2 * MIN });
    expect(((await without.json()) as { userId: string }).userId).toBe(local);
    expect(count(w, 'users')).toBe(1);
  });

  it('account without localUserId: a retry with one (not the account id) is invalid and writes nothing', async () => {
    const w = world();
    const token = await invite(w);
    const dev = device();
    expect((await send(w, '/api/auth/redeem', { token, device: dev, consent: SELF })).status).toBe(200);
    const sessions = rows(w, 'SELECT token_hash FROM sessions');
    const again = await send(w, '/api/auth/redeem', { token, device: dev, consent: SELF, localUserId: uuid() }, { now: T0 + MIN });
    expect(await again.json()).toEqual({ error: 'invalid' });
    expect([count(w, 'users'), count(w, 'user_aliases')]).toEqual([1, 0]);
    expect(rows(w, 'SELECT token_hash FROM sessions')).toEqual(sessions);
  });

  it('consent: the retry must give the same one — self after self passes, a parent after self is invalid, self after a parent is invalid', async () => {
    const w = world();
    const adult = await invite(w);
    const a = device();
    expect((await send(w, '/api/auth/redeem', { token: adult, device: a, consent: SELF })).status).toBe(200);
    expect((await send(w, '/api/auth/redeem', { token: adult, device: a, consent: PARENT }, { now: T0 + MIN })).status).toBe(400);
    expect((await send(w, '/api/auth/redeem', { token: adult, device: a, consent: SELF }, { now: T0 + MIN })).status).toBe(200);

    const minor = await invite(w, 'account', null, 1);
    const b = device();
    expect((await send(w, '/api/auth/redeem', { token: minor, device: b, consent: PARENT })).status).toBe(200);
    expect((await send(w, '/api/auth/redeem', { token: minor, device: b, consent: SELF }, { now: T0 + MIN })).status).toBe(400);
    expect((await send(w, '/api/auth/redeem', { token: minor, device: b, consent: PARENT }, { now: T0 + MIN })).status).toBe(200);
    expect(count(w, 'consents')).toBe(2);
  });

  it('device invitation (recover.ts) with formerUserId: the retry with it or without it passes', async () => {
    const w = world();
    const a = await account(w);
    const token = await invite(w, 'device', a.userId);
    const dev = device();
    const former = uuid();
    expect((await send(w, '/api/auth/redeem', { token, device: dev, formerUserId: former })).status).toBe(200);
    expect((await send(w, '/api/auth/redeem', { token, device: dev, formerUserId: former }, { now: T0 + MIN })).status).toBe(200);
    expect((await send(w, '/api/auth/redeem', { token, device: dev }, { now: T0 + 2 * MIN })).status).toBe(200);
    expect(rows(w, 'SELECT alias_id FROM user_aliases')).toEqual([{ alias_id: former }]);
  });

  it('device invitation without formerUserId: a retry with a new one is invalid; with the account id passes', async () => {
    const w = world();
    const a = await account(w);
    const token = await invite(w, 'device', a.userId);
    const dev = device();
    expect((await send(w, '/api/auth/redeem', { token, device: dev })).status).toBe(200);
    expect(await (await send(w, '/api/auth/redeem', { token, device: dev, formerUserId: uuid() }, { now: T0 + MIN })).json()).toEqual({ error: 'invalid' });
    expect(count(w, 'user_aliases')).toBe(0);
    expect((await send(w, '/api/auth/redeem', { token, device: dev, formerUserId: a.userId }, { now: T0 + MIN })).status).toBe(200);
  });

  it('device_taken, a new device id, the answer lost: the retry with the new id passes', async () => {
    const w = world();
    const other = await account(w);
    const token = await invite(w);
    expect((await send(w, '/api/auth/redeem', { token, device: device(other.deviceId), consent: SELF })).status).toBe(409);
    const renewed = device();
    expect((await send(w, '/api/auth/redeem', { token, device: renewed, consent: SELF })).status).toBe(200);
    expect((await send(w, '/api/auth/redeem', { token, device: renewed, consent: SELF }, { now: T0 + MIN })).status).toBe(200);
  });

  it('a device signed out meanwhile, or an account being erased: invalid', async () => {
    const w = world();
    const token = await invite(w);
    const dev = device();
    const first = await send(w, '/api/auth/redeem', { token, device: dev, consent: SELF });
    expect((await send(w, '/api/auth/logout', {}, { cookie: cookieOf(first) })).status).toBe(200);
    expect(await (await send(w, '/api/auth/redeem', { token, device: dev, consent: SELF }, { now: T0 + MIN })).json()).toEqual({ error: 'invalid' });

    const token2 = await invite(w);
    const dev2 = device();
    const second = await send(w, '/api/auth/redeem', { token: token2, device: dev2, consent: SELF });
    w.db.sqlite.prepare('UPDATE users SET deleting_at = ? WHERE id = ?').run(T0, ((await second.json()) as { userId: string }).userId);
    expect(await (await send(w, '/api/auth/redeem', { token: token2, device: dev2, consent: SELF }, { now: T0 + MIN })).json()).toEqual({ error: 'invalid' });
  });

  it('two requests of one device at the same moment: both answered, one session stays', async () => {
    const w = world();
    const token = await invite(w);
    const dev = device();
    const answers = await Promise.all([1, 2].map(() => send(w, '/api/auth/redeem', { token, device: dev, consent: SELF })));
    expect(answers.map((r) => r.status)).toEqual([200, 200]);
    expect(sessionsOf(w, dev.id)).toBe(1);
    expect(count(w, 'users')).toBe(1);
  });
});

describe('pair: the same device again within the window', () => {
  it('the retry gets a new session and is no failed attempt; another device gets invalid and a failure', async () => {
    const w = world();
    const a = await account(w);
    const c = await code(w, a.cookie);
    const dev = device();
    const first = await send(w, '/api/auth/pair', { code: c, device: dev });
    expect(first.status).toBe(200);
    const again = await send(w, '/api/auth/pair', { code: c, device: dev }, { now: T0 + 5 * MIN });
    expect(again.status).toBe(200);
    expect(sessionsOf(w, dev.id)).toBe(1);
    expect((await send(w, '/api/auth/me', undefined, { cookie: cookieOf(first) })).status).toBe(401);
    expect(failures(w)).toEqual([]);
    expect(await (await send(w, '/api/auth/pair', { code: c, device: device() }, { now: T0 + 6 * MIN })).json()).toEqual({ error: 'invalid' });
    expect(failures(w)).toEqual([{ count: 1 }]);
  });

  it('after 10 minutes: invalid, a failure', async () => {
    const w = world();
    const a = await account(w);
    const c = await code(w, a.cookie);
    const dev = device();
    expect((await send(w, '/api/auth/pair', { code: c, device: dev })).status).toBe(200);
    expect(await (await send(w, '/api/auth/pair', { code: c, device: dev }, { now: T0 + RETRY_WINDOW + 1 })).json()).toEqual({ error: 'invalid' });
    expect(failures(w)).toEqual([{ count: 1 }]);
  });

  it('with formerUserId: the retry with it or without it passes; without at first, a new one later is invalid', async () => {
    const w = world();
    const a = await account(w);
    const c1 = await code(w, a.cookie);
    const dev = device();
    const former = uuid();
    expect((await send(w, '/api/auth/pair', { code: c1, device: dev, formerUserId: former })).status).toBe(200);
    expect((await send(w, '/api/auth/pair', { code: c1, device: dev, formerUserId: former }, { now: T0 + MIN })).status).toBe(200);
    expect((await send(w, '/api/auth/pair', { code: c1, device: dev }, { now: T0 + MIN })).status).toBe(200);

    const c2 = await code(w, a.cookie, T0 + 2 * MIN);
    const dev2 = device();
    expect((await send(w, '/api/auth/pair', { code: c2, device: dev2 }, { now: T0 + 2 * MIN })).status).toBe(200);
    expect(await (await send(w, '/api/auth/pair', { code: c2, device: dev2, formerUserId: uuid() }, { now: T0 + 3 * MIN })).json()).toEqual({ error: 'invalid' });
    expect(rows(w, 'SELECT alias_id FROM user_aliases')).toEqual([{ alias_id: former }]);
  });
});

describe('the hourly cleanup keeps used rows for the window', () => {
  it('a code used at its 9th minute is still there after it expires, until 10 minutes after the use', async () => {
    const w = world();
    const a = await account(w);
    const c = await code(w, a.cookie);
    const dev = device();
    const used = T0 + 9 * MIN;
    expect((await send(w, '/api/auth/pair', { code: c, device: dev }, { now: used })).status).toBe(200);
    await cleanup(w.env.DB, T0 + CODE_TTL + MIN);
    expect(count(w, 'pairing_codes')).toBe(1);
    expect((await send(w, '/api/auth/pair', { code: c, device: dev }, { now: T0 + CODE_TTL + MIN })).status).toBe(200);
    await cleanup(w.env.DB, used + RETRY_WINDOW + 1);
    expect(count(w, 'pairing_codes')).toBe(0);
  });

  it('an invitation used just before it expires stays for the window; unused expired ones go', async () => {
    const w = world();
    const token = await invite(w);
    const used = T0 + INVITE_TTL - MIN;
    expect((await send(w, '/api/auth/redeem', { token, device: device(), consent: SELF }, { now: used })).status).toBe(200);
    await invite(w);
    await cleanup(w.env.DB, T0 + INVITE_TTL);
    expect(count(w, 'invites')).toBe(1);
    await cleanup(w.env.DB, used + RETRY_WINDOW + 1);
    expect(count(w, 'invites')).toBe(0);
  });
});
