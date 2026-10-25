/**
 * Earlier local userIds (stage 6a.4, R40): an account invitation with the device's own userId, an
 * earlier id with a device invitation, a pairing code or a backup file, and the guards that keep
 * one id with one account.
 */
import { describe, expect, it } from 'vitest';
import { NOTICE_VERSION } from '../src/core/notice.ts';
import { INVITE_TTL } from './config.ts';
import { GLOBAL_BUCKET } from './attempts.ts';
import { send, signedIn, T0, world, type World } from './test/accounts.ts';
import { fakeD1 } from './test/sqlite-d1.ts';
import { newToken, sha256Hex } from './tokens.ts';

const uuid = () => crypto.randomUUID();
const device = (id = uuid()) => ({ id, name: 'Windows · Edge' });
const adult = { version: NOTICE_VERSION, by: 'self' };

const rows = (w: World, sql: string, ...params: (string | number)[]) => w.db.sqlite.prepare(sql).all(...params) as Record<string, unknown>[];
const aliases = (w: World) => rows(w, 'SELECT user_id, alias_id FROM user_aliases ORDER BY added_at, alias_id');

async function invite(w: World, kind: 'account' | 'device' = 'account', userId: string | null = null) {
  const token = newToken();
  w.db.sqlite
    .prepare('INSERT INTO invites (token_hash, kind, user_id, label, minor, created_at, expires_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
    .run(await sha256Hex(token), kind, userId, kind === 'account' ? 'test-a' : null, T0, T0 + INVITE_TTL);
  return token;
}

const used = async (w: World, token: string) => (rows(w, 'SELECT used_at FROM invites WHERE token_hash = ?', await sha256Hex(token))[0]?.used_at ?? null) !== null;

async function code(w: World, cookie: string): Promise<string> {
  const response = await send(w, '/api/auth/pairing-code', { cookie });
  return ((await response.json()) as { code: string }).code;
}

/** An account made by an earlier transfer: `alias` is one of its earlier ids. */
async function accountWithAlias(w: World, alias: string) {
  const a = await signedIn(w);
  w.db.sqlite.prepare('INSERT INTO user_aliases (user_id, alias_id, added_at) VALUES (?, ?, ?)').run(a.userId, alias, T0);
  return a;
}

describe('migration 0004: user_aliases', () => {
  it('one account per earlier id, never the account itself; it goes with the account', () => {
    const db = fakeD1();
    db.sqlite.exec(`
      INSERT INTO users (id, label, minor, created_at) VALUES ('u', 'test', 0, 1), ('v', 'test', 0, 1);
      INSERT INTO user_aliases VALUES ('u', 'a', 1);
    `);
    expect(() => db.sqlite.exec("INSERT INTO user_aliases VALUES ('v', 'a', 1)")).toThrow(/UNIQUE/);
    expect(() => db.sqlite.exec("INSERT INTO user_aliases VALUES ('u', 'u', 1)")).toThrow(/CHECK/);
    expect(() => db.sqlite.exec("INSERT INTO user_aliases VALUES ('nobody', 'b', 1)")).toThrow(/FOREIGN KEY/);
    db.sqlite.exec("DELETE FROM users WHERE id = 'u'");
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM user_aliases').get()).toEqual({ n: 0 });
  });
});

describe('account invitation with the device own userId', () => {
  it('the account takes it; the answer carries no earlier ids', async () => {
    const w = world();
    const local = uuid();
    const response = await send(w, '/api/auth/redeem', { body: { token: await invite(w), device: device(), consent: adult, localUserId: local } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ userId: local, formerUserIds: [] });
    expect(rows(w, 'SELECT id FROM users')).toEqual([{ id: local }]);
  });

  it('a body of the 6a.3 build (no localUserId) still gets a new random account', async () => {
    const w = world();
    const response = await send(w, '/api/auth/redeem', { body: { token: await invite(w), device: device(), consent: adult } });
    expect(response.status).toBe(200);
    const { userId } = (await response.json()) as { userId: string };
    expect(userId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('an id of another account or another account earlier id — 409 user_taken, the invitation stays unused', async () => {
    const w = world();
    const other = await signedIn(w);
    const alias = uuid();
    await accountWithAlias(w, alias);
    for (const local of [other.userId, alias]) {
      const token = await invite(w);
      const response = await send(w, '/api/auth/redeem', { body: { token, device: device(), consent: adult, localUserId: local } });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'user_taken' });
      expect(await used(w, token)).toBe(false);
    }
  });

  it('upper case, not a UUID, or formerUserId with an account invitation — 400', async () => {
    const w = world();
    for (const extra of [{ localUserId: uuid().toUpperCase() }, { localUserId: 'x' }, { formerUserId: uuid() }]) {
      const response = await send(w, '/api/auth/redeem', { body: { token: await invite(w), device: device(), consent: adult, ...extra } });
      expect(response.status).toBe(400);
    }
  });

  it('taken between the check and the batch: the guard in the first statement keeps the invitation unused', async () => {
    const w = world();
    const other = await signedIn(w);
    const local = uuid();
    const batch = w.db.batch.bind(w.db);
    w.db.batch = async (statements) => {
      w.db.sqlite.prepare('INSERT INTO user_aliases (user_id, alias_id, added_at) VALUES (?, ?, ?)').run(other.userId, local, T0);
      return batch(statements);
    };
    const token = await invite(w);
    const response = await send(w, '/api/auth/redeem', { body: { token, device: device(), consent: adult, localUserId: local } });
    expect(response.status).toBe(409);
    expect(await used(w, token)).toBe(false);
    expect(rows(w, 'SELECT id FROM users WHERE id = ?', local)).toEqual([]);
  });
});

describe('device invitation and pairing code with an earlier id', () => {
  it('a new earlier id is written in the same batch; the answer and /me list it', async () => {
    const w = world();
    const a = await signedIn(w);
    const former = uuid();
    const response = await send(w, '/api/auth/redeem', { body: { token: await invite(w, 'device', a.userId), device: device(), formerUserId: former } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ userId: a.userId, formerUserIds: [former] });
    expect(aliases(w)).toEqual([{ user_id: a.userId, alias_id: former }]);
    const me = await send(w, '/api/auth/me', { method: 'GET', cookie: a.cookie });
    expect(await me.json()).toMatchObject({ formerUserIds: [former] });
  });

  it('the account itself (signing in again) or an id it already has — nothing written, 200', async () => {
    const w = world();
    const former = uuid();
    const a = await accountWithAlias(w, former);
    for (const id of [a.userId, former]) {
      const response = await send(w, '/api/auth/pair', { body: { code: await code(w, a.cookie), device: device(), formerUserId: id } });
      expect(response.status).toBe(200);
    }
    expect(aliases(w)).toEqual([{ user_id: a.userId, alias_id: former }]);
  });

  it('another account id or earlier id — 409; the code stays usable and is no failed attempt', async () => {
    const w = world();
    const a = await signedIn(w);
    const b = await signedIn(w);
    const alias = uuid();
    await accountWithAlias(w, alias);
    const c = await code(w, a.cookie);
    for (const id of [b.userId, alias]) {
      const response = await send(w, '/api/auth/pair', { body: { code: c, device: device(), formerUserId: id } });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'user_taken' });
    }
    expect(rows(w, 'SELECT count FROM auth_attempts WHERE bucket = ?', GLOBAL_BUCKET)).toEqual([]);
    expect((await send(w, '/api/auth/pair', { body: { code: c, device: device(), formerUserId: uuid() } })).status).toBe(200);
  });

  it('a new earlier id needs consent to the current notice: 403, the invitation stays unused', async () => {
    const w = world();
    const a = await signedIn(w, uuid(), T0, { consent: { by: 'self', version: NOTICE_VERSION - 1 } });
    const token = await invite(w, 'device', a.userId);
    const response = await send(w, '/api/auth/redeem', { body: { token, device: device(), formerUserId: uuid() } });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'consent_required' });
    expect(await used(w, token)).toBe(false);
    // Signing in again needs no consent: nothing new is written.
    expect((await send(w, '/api/auth/redeem', { body: { token, device: device(), formerUserId: a.userId } })).status).toBe(200);
  });

  it('localUserId with a device invitation — 400', async () => {
    const w = world();
    const a = await signedIn(w);
    const response = await send(w, '/api/auth/redeem', { body: { token: await invite(w, 'device', a.userId), device: device(), localUserId: uuid() } });
    expect(response.status).toBe(400);
  });

  it('pairing code: taken between the check and the batch — 409, the code is not used', async () => {
    const w = world();
    const a = await signedIn(w);
    const b = await signedIn(w);
    const former = uuid();
    const c = await code(w, a.cookie);
    const batch = w.db.batch.bind(w.db);
    w.db.batch = async (statements) => {
      w.db.batch = batch;
      w.db.sqlite.prepare('INSERT INTO user_aliases (user_id, alias_id, added_at) VALUES (?, ?, ?)').run(b.userId, former, T0);
      return batch(statements);
    };
    expect((await send(w, '/api/auth/pair', { body: { code: c, device: device(), formerUserId: former } })).status).toBe(409);
    expect(rows(w, 'SELECT used_at FROM pairing_codes')).toEqual([{ used_at: null }]);
  });
});

describe('POST /api/auth/alias (a backup file of another installation)', () => {
  it('a new id joins the account; again — the same answer', async () => {
    const w = world();
    const a = await signedIn(w);
    const id = uuid();
    for (let i = 0; i < 2; i++) {
      const response = await send(w, '/api/auth/alias', { body: { aliasId: id }, cookie: a.cookie });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ formerUserIds: [id] });
    }
  });

  it('the account itself — nothing written; another account or its earlier id — 409', async () => {
    const w = world();
    const a = await signedIn(w);
    const b = await signedIn(w);
    const alias = uuid();
    await accountWithAlias(w, alias);
    expect(await (await send(w, '/api/auth/alias', { body: { aliasId: a.userId }, cookie: a.cookie })).json()).toEqual({ formerUserIds: [] });
    for (const id of [b.userId, alias]) expect((await send(w, '/api/auth/alias', { body: { aliasId: id }, cookie: a.cookie })).status).toBe(409);
  });

  it('refusals: no session 401, old build 426, bad id 400, no consent 403', async () => {
    const w = world();
    const a = await signedIn(w);
    expect((await send(w, '/api/auth/alias', { body: { aliasId: uuid() } })).status).toBe(401);
    expect((await send(w, '/api/auth/alias', { body: { aliasId: uuid() }, cookie: a.cookie, headers: { 'X-Mana-Version': '202610241449' } })).status).toBe(426);
    expect((await send(w, '/api/auth/alias', { body: { aliasId: 'A' }, cookie: a.cookie })).status).toBe(400);
    const old = await signedIn(w, uuid(), T0, { consent: null });
    expect((await send(w, '/api/auth/alias', { body: { aliasId: uuid() }, cookie: old.cookie })).status).toBe(403);
    expect(aliases(w)).toEqual([]);
  });
});
