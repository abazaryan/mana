/**
 * Signed-in devices for Worker tests without the sign-in flow: an account, a device and a
 * session written straight into the test database (the token's hash only, like the real flow).
 */
import { handleApi, ROUTES, type Routes } from '../api.ts';
import { MIN_CLIENT, ORIGIN } from '../config.ts';
import { newToken, sha256Hex } from '../tokens.ts';
import { fakeD1, type FakeD1 } from './sqlite-d1.ts';

export const T0 = Date.UTC(2026, 9, 23, 12, 0, 0);
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export interface World {
  db: FakeD1;
  env: Env;
}

export function world(db: FakeD1 = fakeD1()): World {
  return { db, env: { DB: db, ASSETS: { fetch: async () => new Response(null, { status: 404 }) }, AUTH_PEPPER: 'test-pepper' } as unknown as Env };
}

export interface SignedIn {
  userId: string;
  deviceId: string;
  cookie: string;
}

/** One more signed-in device; a new account unless `userId` is given. */
export async function signedIn(w: World, userId: string = crypto.randomUUID(), now = T0): Promise<SignedIn> {
  const deviceId = crypto.randomUUID();
  const token = newToken();
  const sql = w.db.sqlite;
  sql.prepare('INSERT OR IGNORE INTO users (id, label, minor, created_at) VALUES (?, ?, 0, ?)').run(userId, 'test-sync', now);
  sql.prepare('INSERT INTO devices (id, user_id, name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)').run(deviceId, userId, 'test', now, now);
  sql
    .prepare('INSERT INTO sessions (token_hash, user_id, device_id, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(await sha256Hex(token), userId, deviceId, now, now, now + 180 * DAY);
  return { userId, deviceId, cookie: `__Host-mana_s=${token}` };
}

export interface Send {
  method?: string;
  body?: unknown;
  /** A raw body, sent as it is (size checks). */
  raw?: string;
  cookie?: string;
  headers?: Record<string, string>;
  now?: number;
  routes?: Routes;
}

export function send(w: World, path: string, { method = 'POST', body, raw, cookie, headers = {}, now = T0, routes = ROUTES }: Send = {}): Promise<Response> {
  const all: Record<string, string> = {
    'Sec-Fetch-Site': 'same-origin',
    'X-Mana-Version': String(MIN_CLIENT),
    ...(body === undefined && raw === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(cookie ? { Cookie: cookie } : {}),
    ...headers,
  };
  const init: RequestInit = { method, headers: all };
  if (raw !== undefined) init.body = raw;
  else if (body !== undefined) init.body = JSON.stringify(body);
  return handleApi(new Request(`${ORIGIN}${path}`, init), w.env, routes, now);
}
