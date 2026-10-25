/**
 * Transfer of answers into an account (stage 6a.4, R40), device and server together: the Worker
 * runs in Node over the SQLite stand-in, devices on fake-indexeddb. The first device gives the
 * account its own id; a second device with answers rewrites its userId before the first push;
 * signing in again takes everything first and sends only what the server lacks; a restore while
 * signed in; a closed tab and failures at each step.
 */
import 'fake-indexeddb/auto';
import { Rating, type Grade } from 'ts-fsrs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalJson } from '../src/core/journalRecord';
import type { CardRow, LogRecord } from '../src/core/model';
import { NOTICE_VERSION } from '../src/core/notice';
import { createScheduler } from '../src/core/scheduler';
import { parseBackup } from '../src/core/backup';
import type { ApiResult, SyncTransport } from '../src/platform/api';
import { ManaDb } from '../src/platform/db';
import {
  adoptAccount,
  beginTransfer,
  ensureDevice,
  exportJournal,
  markSignedOut,
  recordIntro,
  recordReview,
  restoreForAccount,
  settleLeftovers,
  type ReviewInput,
} from '../src/platform/repo';
import { sendBeforeLeaving, syncOnce, type SyncEnv } from '../src/platform/syncClient';
import { applyPull, queueCounts } from '../src/platform/syncStore';
import { finishTransfer, signInWith, type SignInOutcome } from '../src/ui/signIn';
import { handleApi, ROUTES } from '../worker/api';
import { INVITE_TTL, ORIGIN } from '../worker/config';
import { send, signedIn, world, type World } from '../worker/test/accounts';
import { newToken, sha256Hex } from '../worker/tokens';

const LUX = { tz: 'Europe/Luxembourg', tzOffsetMin: 120 };
const T = Date.UTC(2026, 9, 22, 18, 0, 0);
const MIN = 60_000;
const DAY = 86_400_000;
const scheduler = createScheduler();
const clock = { now: T + 10 * DAY };

let n = 0;
const open: ManaDb[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

async function toResult<R>(res: Response): Promise<ApiResult<R>> {
  const data = (await res.json().catch(() => null)) as unknown;
  if (res.ok) return { ok: true, data: data as R };
  const code = data !== null && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : 'http';
  return { ok: false, status: res.status, error: code };
}

interface Dev {
  db: ManaDb;
  cookie: string;
  env: SyncEnv;
  /** Pushes this device made, with the number of records in each. */
  pushes: number[];
  /** Pulls this device made. */
  pulls: number;
  /** Pull pages of at most this many records (the real page is 500). */
  pageSize: number;
  /** The next pull fails as a network error. */
  failPull: boolean;
}

function transportOf(w: World, d: () => Dev): SyncTransport {
  return {
    async push(body) {
      d().pushes.push((JSON.parse(body) as { records: unknown[] }).records.length);
      return toResult(await send(w, '/api/sync/push', { raw: body, cookie: d().cookie, now: clock.now }));
    },
    async pull(after) {
      d().pulls++;
      if (d().failPull) {
        d().failPull = false;
        return { ok: false, status: 0, error: 'offline' };
      }
      return toResult(await send(w, `/api/sync/pull?after=${after}&limit=${d().pageSize}`, { method: 'GET', cookie: d().cookie, now: clock.now }));
    },
  };
}

/** A device without sign-in: its own local user, no answers yet. */
async function localDevice(w: World): Promise<Dev> {
  const db = new ManaDb(`transfer-${++n}-${Date.now()}`);
  open.push(db);
  const meta = await ensureDevice(db);
  await db.settings.put({ userId: meta.userId, uiLang: 'tg', meaningLang: 'tg', newPerDay: 5, updatedAt: new Date(T) });
  const d: Dev = { db, cookie: '', pushes: [], pulls: 0, pageSize: 500, failPull: false, env: undefined as unknown as SyncEnv };
  d.env = { db, scheduler, transport: transportOf(w, () => d), build: 202610250000, locks: null, sleep: async () => {}, online: () => true };
  return d;
}

const actorOf = async (d: Dev) => {
  const meta = (await d.db.meta.get('device'))!;
  return { userId: meta.userId, deviceId: meta.deviceId };
};

function answer(entryId: string, at: number, final: Grade): ReviewInput {
  return {
    at: new Date(at),
    deckId: 'fr-test-01',
    entryId,
    deckRevision: 1,
    sessionId: 's1',
    skill: 'speak',
    expected: entryId,
    mode: 'typed',
    answer: entryId,
    alternatives: [entryId],
    verdict: final === Rating.Again ? 'incorrect' : 'correct',
    errorType: null,
    latencyMs: 1800,
    totalMs: 2600,
    micDelayMs: null,
    retries: 0,
    recognitionLang: null,
    suggested: final,
    reason: final === Rating.Again ? 'incorrect' : 'correct',
    final,
    correction: null,
    ...LUX,
  };
}

/** A few days of answers on a device: introductions and answers for `entries`. */
async function study(d: Dev, entries: string[], start: number) {
  const actor = await actorOf(d);
  for (const [i, e] of entries.entries()) {
    await recordIntro(d.db, actor, { at: new Date(start + i * MIN), deckId: 'fr-test-01', entryId: e, deckRevision: 1, sessionId: 's1', ...LUX });
    await recordReview(d.db, scheduler, actor, answer(e, start + i * MIN + 30_000, Rating.Good));
    await recordReview(d.db, scheduler, actor, answer(e, start + DAY + i * MIN, i % 2 ? Rating.Hard : Rating.Easy));
  }
}

/** The due dates of the cards — the acceptance criterion (STAGE6_RESEARCH 5.9 item 6) — without the user. */
const dues = async (d: Dev) =>
  (await d.db.cards.toArray())
    .map((c: CardRow) => `${c.deckId}|${c.entryId}|${c.skill}|${c.due.toISOString()}|${c.stability}|${c.difficulty}`)
    .sort()
    .join('\n');

const serverRows = (w: World) => w.db.sqlite.prepare('SELECT user_id, id, body FROM journal ORDER BY seq').all() as { user_id: string; id: string; body: string }[];
const aliasRows = (w: World) => w.db.sqlite.prepare('SELECT user_id, alias_id FROM user_aliases').all();
const ids = async (d: Dev) => (await d.db.log.toCollection().primaryKeys()).map(String).sort();

async function accountInvite(w: World) {
  const token = newToken();
  w.db.sqlite
    .prepare("INSERT INTO invites (token_hash, kind, user_id, label, minor, created_at, expires_at) VALUES (?, 'account', NULL, 'test-a', 0, ?, ?)")
    .run(await sha256Hex(token), clock.now, clock.now + INVITE_TTL);
  return token;
}

async function pairingCode(w: World, cookie: string) {
  return ((await (await send(w, '/api/auth/pairing-code', { cookie, now: clock.now })).json()) as { code: string }).code;
}

/** Signs a device in through the real client step (signInWith) against the Worker. */
function signIn(w: World, d: Dev, transfer: boolean, path: string, body: (device: unknown, local: string | null) => object): Promise<SignInOutcome> {
  return signInWith(d.db, scheduler, transfer, async (device, local) => {
    const res = await send(w, path, { body: body(device, local), now: clock.now });
    const cookie = res.headers.get('Set-Cookie');
    if (res.ok && cookie) d.cookie = cookie.split(';')[0]!;
    return toResult(res);
  });
}

const redeemAccount = (w: World, d: Dev, token: string) =>
  signIn(w, d, true, '/api/auth/redeem', (device, local) => ({ token, device, consent: { version: NOTICE_VERSION, by: 'self' }, localUserId: local }));
const pairWith = (w: World, d: Dev, code: string, transfer = true) =>
  signIn(w, d, transfer, '/api/auth/pair', (device, local) => (local ? { code, device, formerUserId: local } : { code, device }));

/** Runs the sync until it settles. */
async function syncAll(...devices: Dev[]) {
  for (let i = 0; i < 2; i++) for (const d of devices) expect(await syncOnce(d.env)).toBe('ok');
}

describe('first device: the account takes the device own id', () => {
  it('nothing is rewritten, every record is queued and sent; due dates the same before and after', async () => {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a', 'b', 'c'], T);
    const local = (await actorOf(phone)).userId;
    const before = await dues(phone);
    const logBefore = (await phone.db.log.toArray()).map((r) => canonicalJson(r)).sort();

    const out = await redeemAccount(w, phone, await accountInvite(w));
    expect(out.ok).toBe(true);
    const meta = (await phone.db.meta.get('device'))!;
    expect(meta.userId).toBe(local);
    expect(meta.account?.userId).toBe(local);
    expect(meta.pendingTransfer).toBeUndefined();
    expect(meta.sync?.pullFirst).toBe(true);
    expect((await phone.db.log.toArray()).map((r) => canonicalJson(r)).sort()).toEqual(logBefore);
    expect(await dues(phone)).toBe(before);
    expect((await queueCounts(phone.db)).pending).toBe(9);

    await syncAll(phone);
    expect((await queueCounts(phone.db)).pending).toBe(0);
    const rows = serverRows(w);
    expect(rows.length).toBe(9);
    expect(new Set(rows.map((r) => r.user_id))).toEqual(new Set([local]));
    expect(await dues(phone)).toBe(before);

    // A second, empty device gets the same cards.
    const laptop = await localDevice(w);
    expect((await pairWith(w, laptop, await pairingCode(w, phone.cookie), false)).ok).toBe(true);
    await syncAll(laptop);
    expect(await dues(laptop)).toBe(before);
  });
});

describe('second device with its own answers', () => {
  async function twoDevices() {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a', 'b'], T);
    await redeemAccount(w, phone, await accountInvite(w));
    await syncAll(phone);
    const laptop = await localDevice(w);
    await study(laptop, ['c', 'd'], T + 2 * DAY);
    return { w, phone, laptop, account: (await actorOf(phone)).userId, former: (await actorOf(laptop)).userId };
  }

  it('rewrites its userId before the first push: same ids, times, answers, deviceId; due dates the same', async () => {
    const { w, phone, laptop, account, former } = await twoDevices();
    const before = await dues(laptop);
    const records = await laptop.db.log.toArray();
    const out = await pairWith(w, laptop, await pairingCode(w, phone.cookie));
    expect(out.ok).toBe(true);

    const meta = (await laptop.db.meta.get('device'))!;
    expect(meta.userId).toBe(account);
    expect(meta.formerUserIds).toEqual([former]);
    expect(await laptop.db.settings.get(former)).toBeUndefined();
    expect((await laptop.db.settings.get(account))?.uiLang).toBe('tg');
    const after = await laptop.db.log.toArray();
    expect(after.map((r) => canonicalJson({ ...r, userId: former })).sort()).toEqual(records.map((r) => canonicalJson(r)).sort());
    expect(after.every((r) => r.userId === account)).toBe(true);
    expect(await dues(laptop)).toBe(before);
    expect(aliasRows(w)).toEqual([{ user_id: account, alias_id: former }]);

    await syncAll(laptop, phone);
    const rows = serverRows(w);
    expect(rows.length).toBe(12);
    expect(new Set(rows.map((r) => r.user_id))).toEqual(new Set([account]));
    expect(await dues(phone)).toBe(await dues(laptop));
  });

  it('the canonical JSON of a rewritten record is the same on any device and equals one written with the account id', async () => {
    const { w, phone, laptop, account, former } = await twoDevices();
    const record = (await laptop.db.log.toArray())[0]!;
    const other = await localDevice(w);
    await other.db.meta.update('device', { userId: former });
    await other.db.log.add(record);
    await adoptAccount(other.db, scheduler, account, 'other', [former]);
    await pairWith(w, laptop, await pairingCode(w, phone.cookie));
    const a = await sha256Hex(canonicalJson(await laptop.db.log.get(record.id)));
    const b = await sha256Hex(canonicalJson(await other.db.log.get(record.id)));
    expect(a).toBe(b);
    expect(a).toBe(await sha256Hex(canonicalJson({ ...record, userId: account })));
  });

  it('a repeat changes nothing', async () => {
    const { w, phone, laptop, account } = await twoDevices();
    await pairWith(w, laptop, await pairingCode(w, phone.cookie));
    await syncAll(laptop);
    const log = (await laptop.db.log.toArray()).map((r) => canonicalJson(r)).sort();
    const before = await dues(laptop);
    await adoptAccount(laptop.db, scheduler, account, 'laptop', []);
    expect((await laptop.db.log.toArray()).map((r) => canonicalJson(r)).sort()).toEqual(log);
    expect(await dues(laptop)).toBe(before);
    laptop.pushes = [];
    await syncAll(laptop);
    expect(laptop.pushes.reduce((a, b) => a + b, 0)).toBe(0);
    expect(serverRows(w).length).toBe(12);
  });

  it('a device that was in another account: 409 user_taken, nothing changes on it, the code stays usable', async () => {
    const { w, phone, account } = await twoDevices();
    const tablet = await localDevice(w);
    const other = await signedIn(w);
    // The tablet was in the other account (its records there): its local user is that account.
    await tablet.db.meta.update('device', { userId: other.userId });
    await study(tablet, ['x'], T);
    const before = await dues(tablet);
    const code = await pairingCode(w, phone.cookie);
    const out = await pairWith(w, tablet, code);
    expect(out).toEqual({ ok: false, reason: 'userTaken' });
    const meta = (await tablet.db.meta.get('device'))!;
    expect(meta.userId).toBe(other.userId);
    expect(meta.account).toBeUndefined();
    expect(meta.pendingTransfer).toBeUndefined();
    expect(await dues(tablet)).toBe(before);
    expect(aliasRows(w)).toEqual([]);
    expect((await pairWith(w, await localDevice(w), code, false)).ok).toBe(true);
    expect(account).not.toBe(other.userId);
  });
});

describe('signing in again: take everything first, send only what the server lacks', () => {
  it('records the server has leave the queue after the pull; only the new ones are sent', async () => {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a', 'b', 'c'], T);
    await redeemAccount(w, phone, await accountInvite(w));
    await syncAll(phone);
    await markSignedOut(phone.db);
    await study(phone, ['d'], T + 3 * DAY);
    const laptop = await localDevice(w);
    // The phone's cookie still works for issuing a code in this test; the laptop signs in to give one.
    await pairWith(w, laptop, await pairingCode(w, phone.cookie), false);

    phone.pushes = [];
    phone.pulls = 0;
    phone.pageSize = 4;
    const out = await pairWith(w, phone, await pairingCode(w, laptop.cookie));
    expect(out.ok).toBe(true);
    expect((await queueCounts(phone.db)).pending).toBe(12);
    expect(await sendBeforeLeaving(phone.env)).toBeUndefined();
    expect(phone.pushes).toEqual([]);

    expect(await syncOnce(phone.env)).toBe('ok');
    expect(phone.pulls).toBe(3);
    expect(phone.pushes).toEqual([3]);
    expect((await queueCounts(phone.db)).pending).toBe(0);
    expect(serverRows(w).length).toBe(12);
    expect((await phone.db.meta.get('device'))!.sync?.pullFirst).toBeFalsy();
  });

  it('a pull cut in the middle: the pages before it count, no push until the pull is through', async () => {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a', 'b', 'c', 'd'], T);
    await redeemAccount(w, phone, await accountInvite(w));
    await syncAll(phone);
    const account = (await actorOf(phone)).userId;
    await adoptAccount(phone.db, scheduler, account, 'phone', []);
    expect((await queueCounts(phone.db)).pending).toBe(12);

    phone.pageSize = 5;
    phone.pushes = [];
    // First page through, the second cut: 5 left the queue, the mark stands, nothing was sent.
    let pages = 0;
    const pull = phone.env.transport.pull;
    phone.env = {
      ...phone.env,
      transport: {
        ...phone.env.transport,
        pull: async (after, limit) => (++pages === 2 ? { ok: false, status: 0, error: 'offline' } : pull(after, limit)),
      },
    };
    expect(await syncOnce(phone.env)).toBe('failed');
    expect((await queueCounts(phone.db)).pending).toBe(7);
    expect((await phone.db.meta.get('device'))!.sync?.pullFirst).toBe(true);
    expect(phone.pushes).toEqual([]);

    expect(await syncOnce(phone.env)).toBe('ok');
    expect((await queueCounts(phone.db)).pending).toBe(0);
    expect(phone.pushes).toEqual([]);
    expect(serverRows(w).length).toBe(12);
  });

  it('a record the server holds with another content stays queued and meets its conflict', async () => {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a'], T);
    await redeemAccount(w, phone, await accountInvite(w));
    await syncAll(phone);
    const account = (await actorOf(phone)).userId;
    const [first] = (await phone.db.log.toArray()).sort((a, b) => a.at.getTime() - b.at.getTime());
    await phone.db.log.put({ ...first!, sessionId: 'changed' } as LogRecord);
    await adoptAccount(phone.db, scheduler, account, 'phone', []);
    await syncOnce(phone.env);
    const row = await phone.db.outbox.get(first!.id);
    expect(row?.status).toBe('conflict');
    expect((await queueCounts(phone.db)).pending).toBe(0);
  });
});

describe('interruptions', () => {
  it('tab closed between the server yes and the device transaction: finished at start by /api/auth/me', async () => {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a'], T);
    const laptop = await localDevice(w);
    await redeemAccount(w, laptop, await accountInvite(w));
    const account = (await actorOf(laptop)).userId;
    const before = await dues(phone);
    const local = (await actorOf(phone)).userId;
    await beginTransfer(phone.db);
    // The request went through; the page died before adoptAccount.
    const meta = (await phone.db.meta.get('device'))!;
    const res = await send(w, '/api/auth/pair', {
      body: { code: await pairingCode(w, laptop.cookie), device: { id: meta.deviceId, name: 'phone' }, formerUserId: local },
      now: clock.now,
    });
    phone.cookie = res.headers.get('Set-Cookie')!.split(';')[0]!;
    vi.stubGlobal('fetch', async (path: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      headers.set('Cookie', phone.cookie);
      return handleApi(new Request(`${ORIGIN}${path}`, { ...init, headers }), w.env, ROUTES, clock.now);
    });
    expect(await finishTransfer(phone.db, scheduler)).toBe(true);
    const after = (await phone.db.meta.get('device'))!;
    expect(after.userId).toBe(account);
    expect(after.pendingTransfer).toBeUndefined();
    expect(await dues(phone)).toBe(before);
    expect(await finishTransfer(phone.db, scheduler)).toBe(false);
  });

  it('the request never reached the server: at start /api/auth/me answers 401, the mark goes, nothing changes', async () => {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a'], T);
    const local = (await actorOf(phone)).userId;
    await beginTransfer(phone.db);
    vi.stubGlobal('fetch', async (path: string, init: RequestInit) => handleApi(new Request(`${ORIGIN}${path}`, init), w.env, ROUTES, clock.now));
    expect(await finishTransfer(phone.db, scheduler)).toBe(false);
    const meta = (await phone.db.meta.get('device'))!;
    expect(meta.pendingTransfer).toBeUndefined();
    expect(meta.userId).toBe(local);
  });

  it('a failure inside the device transaction keeps nothing; the repeat goes through', async () => {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a', 'b'], T);
    const before = { dues: await dues(phone), ids: await ids(phone), meta: await phone.db.meta.get('device') };
    const add = phone.db.outbox.bulkAdd.bind(phone.db.outbox);
    phone.db.outbox.bulkAdd = (() => Promise.reject(new Error('disk full'))) as typeof phone.db.outbox.bulkAdd;
    const account = crypto.randomUUID();
    await expect(adoptAccount(phone.db, scheduler, account, 'phone', [])).rejects.toThrow('disk full');
    expect(await dues(phone)).toBe(before.dues);
    expect((await phone.db.log.toArray()).every((r) => r.userId === before.meta!.userId)).toBe(true);
    expect(await phone.db.meta.get('device')).toEqual(before.meta);
    phone.db.outbox.bulkAdd = add;
    await adoptAccount(phone.db, scheduler, account, 'phone', []);
    expect((await phone.db.log.toArray()).every((r) => r.userId === account)).toBe(true);
    expect(await dues(phone)).toBe(before.dues);
  });

  it('a window still holding the earlier id writes as the account, and its record is queued', async () => {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a'], T);
    const stale = await actorOf(phone);
    const account = crypto.randomUUID();
    await adoptAccount(phone.db, scheduler, account, 'phone', []);
    const { record } = await recordReview(phone.db, scheduler, stale, answer('a', T + 5 * DAY, Rating.Good));
    expect(record.userId).toBe(account);
    expect((await phone.db.outbox.get(record.id))?.status).toBe('pending');
    const intro = await recordIntro(phone.db, stale, { at: new Date(T + 5 * DAY), deckId: 'fr-test-01', entryId: 'z', deckRevision: 1, sessionId: 's2', ...LUX });
    expect(intro.userId).toBe(account);
  });

  it('records left under an earlier id (an older build) move at start', async () => {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a'], T);
    const former = (await actorOf(phone)).userId;
    const account = crypto.randomUUID();
    await adoptAccount(phone.db, scheduler, account, 'phone', []);
    const left = { ...(await phone.db.log.toArray())[0]!, id: crypto.randomUUID(), userId: former, at: new Date(T + 6 * DAY) } as LogRecord;
    await phone.db.log.add(left);
    expect(await settleLeftovers(phone.db, scheduler)).toBe(true);
    expect((await phone.db.log.get(left.id))?.userId).toBe(account);
    expect((await phone.db.outbox.get(left.id))?.status).toBe('pending');
    expect(await settleLeftovers(phone.db, scheduler)).toBe(false);
  });
});

describe('restore from a file while signed in', () => {
  it('a file of an earlier id on a third device: records already there are skipped, nothing changes', async () => {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a', 'b'], T);
    await redeemAccount(w, phone, await accountInvite(w));
    await syncAll(phone);
    const laptop = await localDevice(w);
    await study(laptop, ['c'], T + DAY);
    const file = (await exportJournal(laptop.db, await actorOf(laptop))).json;
    await pairWith(w, laptop, await pairingCode(w, phone.cookie));
    await syncAll(laptop, phone);

    const third = await localDevice(w);
    await pairWith(w, third, await pairingCode(w, phone.cookie), false);
    await syncAll(third);
    const before = await dues(third);
    const backup = parseBackup(file);
    if (!backup.ok) throw new Error('backup');
    expect(await restoreForAccount(third.db, scheduler, backup.backup)).toEqual({ ok: true, added: 0, skipped: 3 });
    expect(await dues(third)).toBe(before);
  });

  it('a file of the earlier id with records the device lacks: rewritten, queued, the server gets them once', async () => {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a'], T);
    await redeemAccount(w, phone, await accountInvite(w));
    await syncAll(phone);
    const laptop = await localDevice(w);
    await study(laptop, ['c'], T + DAY);
    const file = parseBackup((await exportJournal(laptop.db, await actorOf(laptop))).json);
    if (!file.ok) throw new Error('backup');
    // Unknown to the account yet: refused until the server makes it an earlier id.
    expect(await restoreForAccount(phone.db, scheduler, file.backup)).toEqual({ ok: false, error: 'unknownUser' });
    const res = await toResult<{ formerUserIds: string[] }>(await send(w, '/api/auth/alias', { body: { aliasId: file.backup.userId }, cookie: phone.cookie, now: clock.now }));
    if (!res.ok) throw new Error('alias');
    await phone.db.meta.update('device', { formerUserIds: res.data.formerUserIds });
    expect(await restoreForAccount(phone.db, scheduler, file.backup)).toEqual({ ok: true, added: 3, skipped: 0 });
    const account = (await actorOf(phone)).userId;
    expect((await phone.db.log.toArray()).every((r) => r.userId === account)).toBe(true);
    await syncAll(phone);
    expect(serverRows(w).length).toBe(6);
    expect(await restoreForAccount(phone.db, scheduler, file.backup)).toEqual({ ok: true, added: 0, skipped: 3 });
  });
});

describe('the received page and the queue', () => {
  it('a record equal to a queued one leaves the queue; outside pullFirst too', async () => {
    const w = world();
    const phone = await localDevice(w);
    await study(phone, ['a'], T);
    await redeemAccount(w, phone, await accountInvite(w));
    const records = await phone.db.log.toArray();
    const account = (await actorOf(phone)).userId;
    const page = { records: records.map((r) => JSON.parse(JSON.stringify(r)) as Record<string, unknown>), next: 3, more: false, settings: {}, serverTime: clock.now };
    await applyPull(phone.db, scheduler, page, 202610250000);
    expect((await queueCounts(phone.db)).pending).toBe(0);
    expect((await phone.db.meta.get('device'))!.sync?.pullFirst).toBeFalsy();
    expect(account).toBe(records[0]!.userId);
  });
});
