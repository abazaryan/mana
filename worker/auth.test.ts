import { describe, expect, it } from 'vitest';
import { NOTICE_VERSION } from '../src/core/notice.ts';
import { handleApi, ROUTES } from './api.ts';
import { GLOBAL_BUCKET } from './attempts.ts';
import { cleanName } from './auth.ts';
import { cleanup } from './cleanup.ts';
import { CODE_TTL, INVITE_TTL, MIN_CLIENT, ORIGIN, SESSION_IDLE } from './config.ts';
import { fakeD1, type FakeD1 } from './test/sqlite-d1.ts';
import { newToken, sha256Hex } from './tokens.ts';

const PEPPER = 'test-pepper-not-a-secret';
const T0 = Date.UTC(2026, 9, 23, 12, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const assets = { fetch: async () => new Response(null, { status: 404 }) };

interface World {
  db: FakeD1;
  env: Env;
}

function world(pepper: string | undefined = PEPPER, db: FakeD1 = fakeD1()): World {
  return { db, env: { DB: db, ASSETS: assets, AUTH_PEPPER: pepper } as unknown as Env };
}

interface Send {
  method?: string;
  body?: unknown;
  cookie?: string;
  headers?: Record<string, string>;
  now?: number;
  ip?: string;
}

function send(w: World, path: string, { method = 'POST', body, cookie, headers = {}, now = T0, ip = '198.51.100.7' }: Send = {}) {
  const all: Record<string, string> = {
    'Sec-Fetch-Site': 'same-origin',
    'X-Mana-Version': String(MIN_CLIENT),
    'CF-Connecting-IP': ip,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(cookie ? { Cookie: cookie } : {}),
    ...headers,
  };
  const init: RequestInit = { method, headers: all };
  if (body !== undefined) init.body = JSON.stringify(body);
  return handleApi(new Request(`${ORIGIN}${path}`, init), w.env, ROUTES, now);
}

/** "name=value" of the Set-Cookie header, for the next request's Cookie. */
function cookieOf(response: Response): string {
  const header = response.headers.get('Set-Cookie') ?? '';
  return header.split(';')[0]!;
}

const rows = (w: World, sql: string, ...params: (string | number)[]) => w.db.sqlite.prepare(sql).all(...params) as Record<string, unknown>[];
const count = (w: World, table: string) => (w.db.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

/** An invitation as invite.ts writes it: only the hash in the database. */
async function invite(w: World, { kind = 'account', minor = 0, userId = null as string | null, label = 'test-a', at = T0 } = {}) {
  const token = newToken();
  w.db.sqlite
    .prepare('INSERT INTO invites (token_hash, kind, user_id, label, minor, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(await sha256Hex(token), kind, userId, kind === 'account' ? label : null, minor, at, at + INVITE_TTL);
  return token;
}

const uuid = () => crypto.randomUUID();
const device = (name = 'Windows · Edge', id = uuid()) => ({ id, name });
const adult = { version: NOTICE_VERSION, by: 'self' };
const parent = (name = 'Parent Name') => ({ version: NOTICE_VERSION, by: 'parent', parentName: name, parentAgreed: true });

/** A signed-in device: its cookie, user and device id. */
async function signIn(w: World, opts: { minor?: number; consent?: unknown; now?: number; profile?: string } = {}) {
  const token = await invite(w, { minor: opts.minor ?? 0, at: opts.now ?? T0 });
  const dev = device();
  const response = await send(w, '/api/auth/redeem', {
    body: { token, device: dev, consent: opts.consent ?? adult },
    now: opts.now ?? T0,
    headers: opts.profile ? { 'X-Mana-Profile': opts.profile } : {},
  });
  expect(response.status).toBe(200);
  const { userId } = (await response.json()) as { userId: string };
  return { cookie: cookieOf(response), userId, deviceId: dev.id };
}

async function stripped(response: Response) {
  const headers = [...response.headers].filter(([name]) => name !== 'date');
  return { status: response.status, body: await response.text(), headers };
}

describe('POST /api/auth/invite: what the invitation is, without using it', () => {
  it('account / device and the under-16 mark', async () => {
    const w = world();
    const token = await invite(w, { minor: 1 });
    const response = await send(w, '/api/auth/invite', { body: { token } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ kind: 'account', minor: true });
    expect(rows(w, 'SELECT used_at FROM invites')).toEqual([{ used_at: null }]);
  });

  it('unknown, malformed, expired and used — one and the same answer', async () => {
    const w = world();
    const expired = await invite(w, { at: T0 - INVITE_TTL });
    const used = await invite(w);
    await send(w, '/api/auth/redeem', { body: { token: used, device: device(), consent: adult } });
    const answers = await Promise.all(
      [newToken(), 'short', expired, used].map(async (token) => stripped(await send(w, '/api/auth/invite', { body: { token } }))),
    );
    expect(answers[0]).toEqual({ status: 400, body: '{"error":"invalid"}', headers: answers[0]!.headers });
    for (const answer of answers) expect(answer).toEqual(answers[0]);
  });
});

describe('POST /api/auth/redeem', () => {
  it('16 or older: account, device, consent to the current notice (self), session; only hashes stored', async () => {
    const w = world();
    const token = await invite(w, { label: 'test-adult' });
    const dev = device();
    const response = await send(w, '/api/auth/redeem', { body: { token, device: dev, consent: adult }, headers: { 'X-Mana-Version': String(MIN_CLIENT + 1) } });
    expect(response.status).toBe(200);
    const { userId, device: got } = (await response.json()) as { userId: string; device: unknown };
    expect(got).toEqual(dev);
    expect(rows(w, 'SELECT label, minor, created_at FROM users WHERE id = ?', userId)).toEqual([{ label: 'test-adult', minor: 0, created_at: T0 }]);
    expect(rows(w, 'SELECT notice_version, given_by, parent_name, device_id, given_at FROM consents WHERE user_id = ?', userId)).toEqual([
      { notice_version: NOTICE_VERSION, given_by: 'self', parent_name: null, device_id: dev.id, given_at: T0 },
    ]);
    expect(rows(w, 'SELECT user_id, name, app_version, revoked_at FROM devices WHERE id = ?', dev.id)).toEqual([
      { user_id: userId, name: dev.name, app_version: MIN_CLIENT + 1, revoked_at: null },
    ]);
    const cookieToken = cookieOf(response).split('=')[1]!;
    expect(rows(w, 'SELECT token_hash, expires_at FROM sessions')).toEqual([{ token_hash: await sha256Hex(cookieToken), expires_at: T0 + SESSION_IDLE }]);
    expect(JSON.stringify(rows(w, 'SELECT * FROM sessions'))).not.toContain(cookieToken);
    expect(rows(w, 'SELECT used_at, used_device_id, user_id FROM invites')).toEqual([{ used_at: T0, used_device_id: dev.id, user_id: userId }]);
  });

  it('the cookie: __Host-, HttpOnly, Secure, SameSite=Strict, Path=/, 400 days', async () => {
    const w = world();
    const token = await invite(w);
    const response = await send(w, '/api/auth/redeem', { body: { token, device: device(), consent: adult } });
    expect(response.headers.get('Set-Cookie')).toMatch(/^__Host-mana_s=[A-Za-z0-9_-]{43}; Path=\/; Max-Age=34560000; Secure; HttpOnly; SameSite=Strict$/);
  });

  it('profile 2 → cookie __Host-mana_s2; profile 1 does not see it', async () => {
    const w = world();
    const { cookie } = await signIn(w, { profile: '2' });
    expect(cookie).toMatch(/^__Host-mana_s2=/);
    expect((await send(w, '/api/auth/me', { method: 'GET', cookie, headers: { 'X-Mana-Profile': '2' } })).status).toBe(200);
    expect((await send(w, '/api/auth/me', { method: 'GET', cookie })).status).toBe(401);
  });

  it('the same invitation twice: the second gets the same answer as a wrong one and creates nothing', async () => {
    const w = world();
    const token = await invite(w);
    expect((await send(w, '/api/auth/redeem', { body: { token, device: device(), consent: adult } })).status).toBe(200);
    const again = await send(w, '/api/auth/redeem', { body: { token, device: device(), consent: adult } });
    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({ error: 'invalid' });
    expect([count(w, 'users'), count(w, 'devices'), count(w, 'sessions'), count(w, 'consents')]).toEqual([1, 1, 1, 1]);
  });

  it('valid for 48 hours', async () => {
    const w = world();
    const token = await invite(w);
    const late = await send(w, '/api/auth/redeem', { body: { token, device: device(), consent: adult }, now: T0 + INVITE_TTL });
    expect(await late.json()).toEqual({ error: 'invalid' });
    const inTime = await send(w, '/api/auth/redeem', { body: { token, device: device(), consent: adult }, now: T0 + INVITE_TTL - 1 });
    expect(inTime.status).toBe(200);
  });

  it('wrong, expired and used invitations: identical answers', async () => {
    const w = world();
    const expired = await invite(w, { at: T0 - INVITE_TTL - 1 });
    const used = await invite(w);
    await send(w, '/api/auth/redeem', { body: { token: used, device: device(), consent: adult } });
    const answers = await Promise.all(
      [newToken(), expired, used, 'x'].map(async (token) => stripped(await send(w, '/api/auth/redeem', { body: { token, device: device(), consent: adult } }))),
    );
    for (const answer of answers) expect(answer).toEqual(answers[0]);
    expect(answers[0]!.status).toBe(400);
  });

  it('under 16 by the invitation: without a parent nothing is created and the invitation stays', async () => {
    const w = world();
    const token = await invite(w, { minor: 1 });
    for (const consent of [adult, undefined, { ...parent(), parentAgreed: false }, parent('  '), { ...parent(), parentName: undefined }]) {
      const response = await send(w, '/api/auth/redeem', { body: { token, device: device(), consent } });
      expect(response.status, JSON.stringify(consent)).toBe(400);
      expect(await response.json()).toEqual({ error: 'consent_required' });
    }
    expect([count(w, 'users'), count(w, 'consents'), count(w, 'sessions')]).toEqual([0, 0, 0]);
    expect(rows(w, 'SELECT used_at FROM invites')).toEqual([{ used_at: null }]);
  });

  it('under 16 by the invitation, with a parent: minor 1, consent by the parent with the name', async () => {
    const w = world();
    const { userId } = await signIn(w, { minor: 1, consent: parent('  Nodira   Karimova ') });
    expect(rows(w, 'SELECT minor FROM users')).toEqual([{ minor: 1 }]);
    expect(rows(w, 'SELECT given_by, parent_name, notice_version FROM consents WHERE user_id = ?', userId)).toEqual([
      { given_by: 'parent', parent_name: 'Nodira Karimova', notice_version: NOTICE_VERSION },
    ]);
  });

  it('not marked in the invitation, but the answer "no" (a parent agreed): users.minor = 1 in the same batch', async () => {
    const w = world();
    const { userId } = await signIn(w, { minor: 0, consent: parent() });
    expect(rows(w, 'SELECT minor FROM users WHERE id = ?', userId)).toEqual([{ minor: 1 }]);
    expect(rows(w, 'SELECT given_by FROM consents WHERE user_id = ?', userId)).toEqual([{ given_by: 'parent' }]);
  });

  it('only the current notice version counts', async () => {
    const w = world();
    const token = await invite(w);
    const response = await send(w, '/api/auth/redeem', { body: { token, device: device(), consent: { ...adult, version: NOTICE_VERSION + 1 } } });
    expect(await response.json()).toEqual({ error: 'consent_required' });
  });

  it('a failure inside the batch keeps nothing: the invitation stays unused', async () => {
    const real = fakeD1();
    const broken = {
      ...real,
      prepare(sql: string) {
        const statement = real.prepare(sql);
        if (!sql.includes('INTO consents')) return statement;
        return {
          bind: () => ({
            all: async () => {
              throw new Error('disk full');
            },
          }),
        };
      },
    } as unknown as FakeD1;
    const w = world(PEPPER, broken);
    const token = await invite(w);
    const response = await send(w, '/api/auth/redeem', { body: { token, device: device(), consent: adult } });
    expect(response.status).toBe(500);
    expect([count(w, 'users'), count(w, 'devices'), count(w, 'sessions')]).toEqual([0, 0, 0]);
    expect(rows(w, 'SELECT used_at, redeem_id FROM invites')).toEqual([{ used_at: null, redeem_id: null }]);
  });

  it('409 when this browser profile is already signed in', async () => {
    const w = world();
    const { cookie } = await signIn(w);
    const token = await invite(w);
    const response = await send(w, '/api/auth/redeem', { body: { token, device: device(), consent: adult }, cookie });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'already_signed_in' });
  });

  it("409 device_taken: a device id of another account; the invitation stays", async () => {
    const w = world();
    const { deviceId } = await signIn(w);
    const token = await invite(w);
    const response = await send(w, '/api/auth/redeem', { body: { token, device: device('x', deviceId), consent: adult } });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'device_taken' });
    expect(rows(w, 'SELECT used_at FROM invites WHERE used_at IS NULL')).toHaveLength(1);
  });

  it('a device invitation (recovery): no notice needed, the same account; a signed-out device comes back', async () => {
    const w = world();
    const first = await signIn(w);
    await send(w, '/api/auth/logout', { cookie: first.cookie });
    const token = await invite(w, { kind: 'device', userId: first.userId });
    const response = await send(w, '/api/auth/redeem', { body: { token, device: device('Laptop', first.deviceId) } });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { userId: string }).userId).toBe(first.userId);
    expect(count(w, 'users')).toBe(1);
    expect(count(w, 'consents')).toBe(1);
    expect(rows(w, 'SELECT name, revoked_at FROM devices')).toEqual([{ name: 'Laptop', revoked_at: null }]);
  });

  it('400 bad_request for a malformed body or device', async () => {
    const w = world();
    const token = await invite(w);
    for (const body of [[], { token }, { token, device: { id: 'not-a-uuid', name: 'x' } }, { token, device: device(''), consent: adult }, { token, device: device(), consent: 'yes' }]) {
      const response = await send(w, '/api/auth/redeem', { body });
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await response.json()).toEqual({ error: 'bad_request' });
    }
  });
});

describe('sessions: expiry and renewal at most once a day', () => {
  it('without a cookie, with an unknown one — 401 that clears the cookie', async () => {
    const w = world();
    for (const cookie of [undefined, `__Host-mana_s=${newToken()}`]) {
      const response = await send(w, '/api/auth/me', { method: 'GET', cookie });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'unauthorized' });
      expect(response.headers.get('Set-Cookie')).toBe('__Host-mana_s=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict');
    }
  });

  it('a request within a day writes nothing and sends no cookie; after a day both', async () => {
    const w = world();
    const { cookie, deviceId } = await signIn(w);
    const soon = await send(w, '/api/auth/me', { method: 'GET', cookie, now: T0 + 23 * HOUR, headers: { 'X-Mana-Version': '202610240000' } });
    expect(soon.status).toBe(200);
    expect(soon.headers.get('Set-Cookie')).toBeNull();
    expect(rows(w, 'SELECT last_used_at, expires_at FROM sessions')).toEqual([{ last_used_at: T0, expires_at: T0 + SESSION_IDLE }]);
    const later = T0 + DAY;
    const next = await send(w, '/api/auth/me', { method: 'GET', cookie, now: later, headers: { 'X-Mana-Version': '202610240000' } });
    expect(next.headers.get('Set-Cookie')).toBe(`${cookie}; Path=/; Max-Age=34560000; Secure; HttpOnly; SameSite=Strict`);
    expect(rows(w, 'SELECT last_used_at, expires_at FROM sessions')).toEqual([{ last_used_at: later, expires_at: later + SESSION_IDLE }]);
    expect(rows(w, 'SELECT last_seen_at, app_version FROM devices WHERE id = ?', deviceId)).toEqual([{ last_seen_at: later, app_version: 202610240000 }]);
  });

  it('180 days without requests — the session is over', async () => {
    const w = world();
    const { cookie } = await signIn(w);
    expect((await send(w, '/api/auth/me', { method: 'GET', cookie, now: T0 + SESSION_IDLE - 1 })).status).toBe(200);
    const w2 = world();
    const other = await signIn(w2);
    expect((await send(w2, '/api/auth/me', { method: 'GET', cookie: other.cookie, now: T0 + SESSION_IDLE })).status).toBe(401);
  });

  it('GET /api/auth/me — who this is; HEAD too', async () => {
    const w = world();
    const { cookie, userId, deviceId } = await signIn(w);
    const response = await send(w, '/api/auth/me', { method: 'GET', cookie });
    expect(await response.json()).toEqual({ userId, device: { id: deviceId, name: 'Windows · Edge' } });
    expect((await send(w, '/api/auth/me', { method: 'HEAD', cookie })).status).toBe(200);
  });
});

async function issue(w: World, cookie: string, now = T0): Promise<string> {
  const response = await send(w, '/api/auth/pairing-code', { cookie, now });
  expect(response.status).toBe(200);
  const { code, expiresAt } = (await response.json()) as { code: string; expiresAt: number };
  expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  expect(expiresAt).toBe(now + CODE_TTL);
  return code;
}

describe('pairing codes', () => {
  it('a code from a signed-in device lets a new device in, typed any way (lower case, hyphen, O for 0)', async () => {
    const w = world();
    const a = await signIn(w);
    const code = await issue(w, a.cookie);
    const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase().replace(/0/g, 'o');
    const dev = device('Phone');
    const response = await send(w, '/api/auth/pair', { body: { code: typed, device: dev } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: a.userId, device: dev });
    expect(cookieOf(response)).toMatch(/^__Host-mana_s=/);
    expect(rows(w, 'SELECT used_device_id FROM pairing_codes')).toEqual([{ used_device_id: dev.id }]);
  });

  it('the database keeps an HMAC with the pepper, not the code', async () => {
    const w = world();
    const a = await signIn(w);
    const code = await issue(w, a.cookie);
    const [row] = rows(w, 'SELECT code_hash FROM pairing_codes');
    expect(row!.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.code_hash).not.toBe(await sha256Hex(code));
    expect(row!.code_hash).not.toBe(await sha256Hex(`pair:${code}`));
  });

  it('once; 10 minutes; a new code replaces the earlier one', async () => {
    const w = world();
    const a = await signIn(w);
    const used = await issue(w, a.cookie);
    expect((await send(w, '/api/auth/pair', { body: { code: used, device: device() } })).status).toBe(200);
    expect(await (await send(w, '/api/auth/pair', { body: { code: used, device: device() } })).json()).toEqual({ error: 'invalid' });

    const late = await issue(w, a.cookie);
    expect(await (await send(w, '/api/auth/pair', { body: { code: late, device: device() }, now: T0 + CODE_TTL })).json()).toEqual({ error: 'invalid' });

    const first = await issue(w, a.cookie);
    const second = await issue(w, a.cookie);
    expect(rows(w, 'SELECT count(*) AS n FROM pairing_codes WHERE user_id = ?', a.userId)).toEqual([{ n: 1 }]);
    expect((await send(w, '/api/auth/pair', { body: { code: first, device: device() } })).status).toBe(400);
    expect((await send(w, '/api/auth/pair', { body: { code: second, device: device() } })).status).toBe(200);
  });

  it('wrong, expired and used codes: identical answers', async () => {
    const w = world();
    const a = await signIn(w);
    const used = await issue(w, a.cookie);
    await send(w, '/api/auth/pair', { body: { code: used, device: device() } });
    const expired = await issue(w, a.cookie, T0 - CODE_TTL);
    const answers = await Promise.all(
      ['00000000', expired, used, 'not a code'].map(async (code, i) =>
        stripped(await send(w, '/api/auth/pair', { body: { code, device: device() }, ip: `203.0.113.${i}` })),
      ),
    );
    for (const answer of answers) expect(answer).toEqual(answers[0]);
    expect(answers[0]!.body).toBe('{"error":"invalid"}');
  });

  it('without AUTH_PEPPER the code routes answer 500; invitations still work', async () => {
    const w = world('');
    expect((await send(w, '/api/auth/pair', { body: { code: '00000000', device: device() } })).status).toBe(500);
    const { cookie } = await signIn(w);
    expect((await send(w, '/api/auth/pairing-code', { cookie })).status).toBe(500);
  });
});

describe('counters of failed code attempts', () => {
  const wrong = (w: World, ip: string, now = T0, code = '00000000') => send(w, '/api/auth/pair', { body: { code, device: device() }, ip, now });

  it('10 failures from one address in 10 minutes → 429, even with the right code; another address goes on', async () => {
    const w = world();
    const a = await signIn(w);
    const code = await issue(w, a.cookie);
    for (let i = 0; i < 10; i++) expect((await wrong(w, '192.0.2.1', T0 + i)).status).toBe(400);
    const blocked = await wrong(w, '192.0.2.1', T0 + 10, code);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'too_many_requests' });
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await wrong(w, '192.0.2.2', T0 + 11, code)).status).toBe(200);
  });

  it('after the 10-minute window the address may try again', async () => {
    const w = world();
    for (let i = 0; i < 10; i++) await wrong(w, '192.0.2.1', T0);
    expect((await wrong(w, '192.0.2.1', T0 + 10 * MIN - 1)).status).toBe(429);
    expect((await wrong(w, '192.0.2.1', T0 + 10 * MIN)).status).toBe(400);
  });

  it('IPv6: one /64 is one address', async () => {
    const w = world();
    for (let i = 0; i < 10; i++) await wrong(w, `2001:db8:1:2::${i + 1}`, T0);
    expect((await wrong(w, '2001:db8:1:2:ffff::9', T0)).status).toBe(429);
    expect((await wrong(w, '2001:db8:1:3::1', T0)).status).toBe(400);
  });

  it('50 failures in an hour from anywhere → codes closed to everyone for an hour, then open', async () => {
    const w = world();
    const a = await signIn(w);
    for (let i = 0; i < 50; i++) await wrong(w, `10.0.${i}.1`, T0 + i);
    const code = await issue(w, a.cookie, T0 + 100);
    expect((await wrong(w, '172.16.0.1', T0 + 200, code)).status).toBe(429);
    expect((await wrong(w, '172.16.0.1', T0 + 49 + HOUR - 1, code)).status).toBe(429);
    const fresh = await issue(w, a.cookie, T0 + 49 + HOUR);
    expect((await wrong(w, '172.16.0.1', T0 + 49 + HOUR, fresh)).status).toBe(200);
  });

  it('the address is stored only as an HMAC with the pepper', async () => {
    const w = world();
    await wrong(w, '192.0.2.77');
    const buckets = rows(w, 'SELECT bucket FROM auth_attempts').map((r) => r.bucket as string);
    expect(buckets).toContain(GLOBAL_BUCKET);
    const ipRow = buckets.find((b) => b !== GLOBAL_BUCKET)!;
    expect(ipRow).toMatch(/^pair:ip:[0-9a-f]{32}$/);
    expect(JSON.stringify(rows(w, 'SELECT * FROM auth_attempts'))).not.toContain('192.0.2.77');
  });

  it('IP rows go once their window is over: at the next failure and by the hourly cleanup; the global row stays', async () => {
    const w = world();
    await wrong(w, '192.0.2.1', T0);
    await wrong(w, '192.0.2.2', T0 + 10 * MIN);
    expect(rows(w, "SELECT count(*) AS n FROM auth_attempts WHERE bucket LIKE 'pair:ip:%'")).toEqual([{ n: 1 }]);
    await cleanup(w.env.DB, T0 + 20 * MIN);
    expect(rows(w, 'SELECT bucket FROM auth_attempts')).toEqual([{ bucket: GLOBAL_BUCKET }]);
  });
});

describe('the hourly cleanup', () => {
  it('expired sessions, codes and invitations go; live ones stay; well within a day for IP rows', async () => {
    const w = world();
    const a = await signIn(w);
    await issue(w, a.cookie);
    await invite(w, { at: T0 - INVITE_TTL - 1 });
    const live = await invite(w);
    await cleanup(w.env.DB, T0 + CODE_TTL);
    expect(count(w, 'pairing_codes')).toBe(0);
    expect(count(w, 'sessions')).toBe(1);
    expect(rows(w, 'SELECT token_hash FROM invites WHERE used_at IS NULL')).toEqual([{ token_hash: await sha256Hex(live) }]);
    await cleanup(w.env.DB, T0 + SESSION_IDLE);
    expect(count(w, 'sessions')).toBe(0);
  });
});

describe('devices: list, rename, revoke; logout', () => {
  async function two(w: World) {
    const a = await signIn(w);
    const code = await issue(w, a.cookie);
    const dev = device('Phone');
    const response = await send(w, '/api/auth/pair', { body: { code, device: dev }, now: T0 + 1 });
    return { a, b: { cookie: cookieOf(response), deviceId: dev.id } };
  }

  it('the list: both devices, this one marked', async () => {
    const w = world();
    const { a, b } = await two(w);
    const response = await send(w, '/api/auth/devices', { method: 'GET', cookie: a.cookie });
    expect(await response.json()).toEqual({
      devices: [
        { id: b.deviceId, name: 'Phone', lastSeenAt: T0 + 1, current: false },
        { id: a.deviceId, name: 'Windows · Edge', lastSeenAt: T0, current: true },
      ],
    });
  });

  it('revoking another device: its next request is 401, it leaves the list', async () => {
    const w = world();
    const { a, b } = await two(w);
    const response = await send(w, '/api/auth/devices/revoke', { body: { deviceId: b.deviceId }, cookie: a.cookie });
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect((await send(w, '/api/auth/me', { method: 'GET', cookie: b.cookie })).status).toBe(401);
    const list = (await (await send(w, '/api/auth/devices', { method: 'GET', cookie: a.cookie })).json()) as { devices: unknown[] };
    expect(list.devices).toHaveLength(1);
  });

  it("an unknown device or another account's — the same 404", async () => {
    const w = world();
    const { a } = await two(w);
    const other = await signIn(w);
    for (const deviceId of [uuid(), other.deviceId]) {
      const response = await send(w, '/api/auth/devices/revoke', { body: { deviceId }, cookie: a.cookie });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
    }
    expect((await send(w, '/api/auth/me', { method: 'GET', cookie: other.cookie })).status).toBe(200);
  });

  it('rename this device', async () => {
    const w = world();
    const { cookie } = await signIn(w);
    expect(await (await send(w, '/api/auth/device', { body: { name: '  My   laptop ' }, cookie })).json()).toEqual({ ok: true, name: 'My laptop' });
    expect(await (await send(w, '/api/auth/me', { method: 'GET', cookie })).json()).toMatchObject({ device: { name: 'My laptop' } });
    expect((await send(w, '/api/auth/device', { body: { name: 'x'.repeat(41) }, cookie })).status).toBe(400);
  });

  it('logout: the session row goes, the cookie is cleared, the device is marked signed out', async () => {
    const w = world();
    const { cookie, deviceId } = await signIn(w);
    const response = await send(w, '/api/auth/logout', { cookie, now: T0 + 5 });
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toBe('__Host-mana_s=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict');
    expect(count(w, 'sessions')).toBe(0);
    expect(rows(w, 'SELECT revoked_at FROM devices WHERE id = ?', deviceId)).toEqual([{ revoked_at: T0 + 5 }]);
    expect((await send(w, '/api/auth/me', { method: 'GET', cookie })).status).toBe(401);
  });

  it('logout without a session is fine too', async () => {
    expect((await send(world(), '/api/auth/logout')).status).toBe(200);
  });
});

describe('the new routes keep the 6a.1 checks', () => {
  const changing = ['/api/auth/invite', '/api/auth/redeem', '/api/auth/pair', '/api/auth/pairing-code', '/api/auth/device', '/api/auth/devices/revoke', '/api/auth/logout'];

  it('CSRF: a foreign Origin gets 403 on every changing route', async () => {
    const w = world();
    for (const path of changing) {
      const response = await send(w, path, { body: {}, headers: { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' } });
      expect(response.status, path).toBe(403);
    }
  });

  it('426 for an old client on every changing sign-in route — but logout and the invitation lookup always work', async () => {
    const w = world();
    const old = { 'X-Mana-Version': String(MIN_CLIENT - 1) };
    for (const path of ['/api/auth/redeem', '/api/auth/pair', '/api/auth/pairing-code', '/api/auth/device', '/api/auth/devices/revoke']) {
      const response = await send(w, path, { body: {}, headers: old });
      expect(response.status, path).toBe(426);
    }
    expect((await send(w, '/api/auth/logout', { headers: old })).status).toBe(200);
    expect((await send(w, '/api/auth/invite', { body: { token: 'x' }, headers: old })).status).toBe(400);
  });

  it('a code body over 1 KB is 413', async () => {
    const response = await send(world(), '/api/auth/pair', { body: { code: 'x'.repeat(1100), device: device() } });
    expect(response.status).toBe(413);
  });
});

describe('cleanName', () => {
  it('collapses spaces, keeps a Persian zero-width non-joiner, refuses control and bidi-override characters', () => {
    expect(cleanName('  a   b ', 10)).toBe('a b');
    expect(cleanName('a‌b', 10)).toBe('a‌b');
    expect(cleanName('a\u0000b', 10)).toBeNull();
    expect(cleanName('a‮b', 10)).toBeNull();
    expect(cleanName('', 10)).toBeNull();
    expect(cleanName('abc', 2)).toBeNull();
    expect(cleanName(5, 10)).toBeNull();
  });
});
