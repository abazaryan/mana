/**
 * Devices against the Worker in one test (stage 6a.4): the Worker runs in Node over the SQLite
 * stand-in, each device on its own fake-indexeddb database; sign-in goes through the real client
 * step (signInWith), sync through the real engine with a transport that calls the Worker.
 */
import 'fake-indexeddb/auto';
import type { FSRS } from 'ts-fsrs';
import { cardsHash } from '../../src/core/cardsReport';
import { NOTICE_VERSION } from '../../src/core/notice';
import type { ApiResult, SyncTransport } from '../../src/platform/api';
import { ManaDb } from '../../src/platform/db';
import { ensureDevice } from '../../src/platform/repo';
import { syncOnce, type SyncEnv } from '../../src/platform/syncClient';
import { signInWith, type SignInOutcome } from '../../src/ui/signIn';
import { INVITE_TTL } from '../../worker/config';
import { send, type World } from '../../worker/test/accounts';
import { newToken, sha256Hex } from '../../worker/tokens';

export async function toResult<R>(res: Response): Promise<ApiResult<R>> {
  const data = (await res.json().catch(() => null)) as unknown;
  if (res.ok) return { ok: true, data: data as R };
  const code = data !== null && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : 'http';
  return { ok: false, status: res.status, error: code };
}

/** The server's clock in a test. */
export interface Clock {
  now: number;
}

export interface Dev {
  db: ManaDb;
  cookie: string;
  env: SyncEnv;
  /** Pushes this device made, with the number of records in each. */
  pushes: number[];
  /** Pulls this device made. */
  pulls: number;
  /** Pull pages of at most this many records (the real page is 500). */
  pageSize: number;
}

let n = 0;

export interface Devices {
  w: World;
  clock: Clock;
  scheduler: FSRS;
  open: ManaDb[];
}

function transportOf(t: Devices, d: () => Dev): SyncTransport {
  return {
    async push(body) {
      d().pushes.push((JSON.parse(body) as { records: unknown[] }).records.length);
      return toResult(await send(t.w, '/api/sync/push', { raw: body, cookie: d().cookie, now: t.clock.now }));
    },
    async pull(after) {
      d().pulls++;
      return toResult(await send(t.w, `/api/sync/pull?after=${after}&limit=${d().pageSize}`, { method: 'GET', cookie: d().cookie, now: t.clock.now }));
    },
  };
}

/** A device without sign-in: its own local user, no answers yet. */
export async function localDevice(t: Devices): Promise<Dev> {
  const db = new ManaDb(`devices-${++n}-${Date.now()}`);
  t.open.push(db);
  const meta = await ensureDevice(db);
  await db.settings.put({ userId: meta.userId, uiLang: 'tg', meaningLang: 'tg', newPerDay: 5, updatedAt: new Date(t.clock.now) });
  const d: Dev = { db, cookie: '', pushes: [], pulls: 0, pageSize: 500, env: undefined as unknown as SyncEnv };
  d.env = { db, scheduler: t.scheduler, transport: transportOf(t, () => d), build: 202610250000, locks: null, sleep: async () => {}, online: () => true };
  return d;
}

export const actorOf = async (d: Dev) => {
  const meta = (await d.db.meta.get('device'))!;
  return { userId: meta.userId, deviceId: meta.deviceId };
};

/** SHA-256 of the cards' due dates (the #/lab/cards hash), without the user. */
export async function duesHash(d: Dev): Promise<string> {
  return cardsHash(await d.db.cards.toArray());
}

export async function accountInvite(t: Devices): Promise<string> {
  const token = newToken();
  t.w.db.sqlite
    .prepare("INSERT INTO invites (token_hash, kind, user_id, label, minor, created_at, expires_at) VALUES (?, 'account', NULL, 'test-a', 0, ?, ?)")
    .run(await sha256Hex(token), t.clock.now, t.clock.now + INVITE_TTL);
  return token;
}

export async function pairingCode(t: Devices, cookie: string): Promise<string> {
  return ((await (await send(t.w, '/api/auth/pairing-code', { cookie, now: t.clock.now })).json()) as { code: string }).code;
}

/** Signs a device in through the real client step (signInWith) against the Worker. */
export function signIn(t: Devices, d: Dev, transfer: boolean, path: string, body: (device: unknown, local: string | null) => object): Promise<SignInOutcome> {
  return signInWith(d.db, t.scheduler, transfer, async (device, local) => {
    const res = await send(t.w, path, { body: body(device, local), now: t.clock.now });
    const cookie = res.headers.get('Set-Cookie');
    if (res.ok && cookie) d.cookie = cookie.split(';')[0]!;
    return toResult(res);
  });
}

/** An account invitation; with `transfer` the device's own userId becomes the account's id. */
export async function redeemAccount(t: Devices, d: Dev, transfer = true): Promise<SignInOutcome> {
  const token = await accountInvite(t);
  return signIn(t, d, transfer, '/api/auth/redeem', (device, local) => ({
    token,
    device,
    consent: { version: NOTICE_VERSION, by: 'self' },
    ...(local ? { localUserId: local } : {}),
  }));
}

/** A pairing code from `from`; with `transfer` the device's userId becomes an earlier id of the account. */
export async function pairWith(t: Devices, d: Dev, from: Dev, transfer = true): Promise<SignInOutcome> {
  const code = await pairingCode(t, from.cookie);
  return signIn(t, d, transfer, '/api/auth/pair', (device, local) => (local ? { code, device, formerUserId: local } : { code, device }));
}

/** Runs the sync of the devices until it settles; every run must go through. */
export async function syncAll(...devices: Dev[]): Promise<void> {
  for (let i = 0; i < 2; i++) for (const d of devices) if ((await syncOnce(d.env)) !== 'ok') throw new Error('sync did not go through');
}

export const serverRows = (w: World) => w.db.sqlite.prepare('SELECT user_id, id FROM journal ORDER BY seq').all() as { user_id: string; id: string }[];
export const aliasRows = (w: World) => w.db.sqlite.prepare('SELECT user_id, alias_id FROM user_aliases').all() as { user_id: string; alias_id: string }[];
