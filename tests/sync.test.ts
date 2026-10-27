/**
 * Stage 6a.3: two devices (two fake-indexeddb databases) and the real Worker code over the test
 * database (worker/test/sqlite-d1.ts, not a stub). The proof of sync: after every exchange, the
 * cards on both devices equal the rebuild of the merged journal (STAGE6_RESEARCH 5.6).
 */
import 'fake-indexeddb/auto';
import { Rating, type Grade } from 'ts-fsrs';
import { afterEach, describe, expect, it } from 'vitest';
import { rebuildCards } from '../src/core/cards';
import { canonicalJson } from '../src/core/journalRecord';
import type { CardRow, LogRecord } from '../src/core/model';
import { NOTICE_VERSION } from '../src/core/notice';
import { createScheduler, RULES_VERSION } from '../src/core/scheduler';
import { introsToday } from '../src/core/session';
import { SEND_DELAY_MS, SEND_MAX_WAIT_MS, SEND_NOW_QUEUE, SendTimer } from '../src/core/sync';
import { PUSH_BODY_LIMIT, type PushResponse } from '../src/core/syncProtocol';
import type { ApiResult, SyncTransport } from '../src/platform/api';
import { ManaDb } from '../src/platform/db';
import { ensureDevice, exportJournal, markSignedIn, markSignedOut, recordDrill, recordIntro, recordReview, type ReviewInput } from '../src/platform/repo';
import { sendBeforeLeaving, syncOnce, type RunResult, type SyncEnv } from '../src/platform/syncClient';
import { applyPull, nextBatch, queueCounts, saveSettings, settleUpdate } from '../src/platform/syncStore';
import { send, signedIn, world, type SignedIn, type World } from '../worker/test/accounts';

const LUX = { tz: 'Europe/Luxembourg', tzOffsetMin: 120 };
const DUSHANBE = { tz: 'Asia/Dushanbe', tzOffsetMin: 300 };
const T = Date.UTC(2026, 9, 22, 18, 0, 0);
const MIN = 60_000;
const DAY = 86_400_000;
const scheduler = createScheduler();

let n = 0;
const open: ManaDb[] = [];
afterEach(async () => {
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

async function toResult<T>(res: Response): Promise<ApiResult<T>> {
  const data = (await res.json().catch(() => null)) as unknown;
  if (res.ok) return { ok: true, data: data as T };
  const code = data !== null && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : 'http';
  return { ok: false, status: res.status, error: code };
}

/** The server's clock in a test. */
const clock = { now: T + 10 * DAY };

interface Device {
  db: ManaDb;
  who: SignedIn;
  env: SyncEnv;
  /** Requests this device made: [kind, body bytes, keepalive]. */
  calls: [string, number, boolean][];
  /** Down: every request fails as a network error. */
  offline: boolean;
  /** The next n pushes answer 503. */
  failPushes: number;
  /** The next n pulls answer 503. */
  failPulls: number;
  /** Records in each push, and the limit of each pull, in order. */
  pushSizes: number[];
  pullLimits: number[];
}

function transportOf(w: World, d: () => Device): SyncTransport {
  return {
    async push(body, keepalive) {
      d().calls.push(['push', new TextEncoder().encode(body).byteLength, keepalive]);
      d().pushSizes.push((JSON.parse(body) as { records: unknown[] }).records.length);
      if (d().offline) return { ok: false, status: 0, error: 'offline' };
      if (d().failPushes > 0) {
        d().failPushes--;
        return { ok: false, status: 503, error: 'http' };
      }
      return toResult<PushResponse>(await send(w, '/api/sync/push', { raw: body, cookie: d().who.cookie, now: clock.now }));
    },
    async pull(after, limit) {
      d().calls.push(['pull', 0, false]);
      d().pullLimits.push(limit);
      if (d().offline) return { ok: false, status: 0, error: 'offline' };
      if (d().failPulls > 0) {
        d().failPulls--;
        return { ok: false, status: 503, error: 'http' };
      }
      return toResult(await send(w, `/api/sync/pull?after=${after}&limit=${limit}`, { method: 'GET', cookie: d().who.cookie, now: clock.now }));
    },
  };
}

/** A device signed in to the account (a new one unless `userId`), with an empty journal. */
async function device(w: World, userId?: string, opts?: Parameters<typeof signedIn>[3]): Promise<Device> {
  const db = new ManaDb(`sync-${++n}-${Date.now()}`);
  open.push(db);
  const who = await signedIn(w, userId, undefined, opts);
  await ensureDevice(db);
  await db.settings.put({ userId: who.userId, uiLang: 'tg', meaningLang: 'tg', newPerDay: 5, updatedAt: new Date(T) });
  await markSignedIn(db, who.userId, 'test');
  const meta = (await db.meta.get('device'))!;
  await db.settings.put({ ...(await db.settings.get(meta.userId))!, userId: who.userId });
  const d: Device = { db, who, calls: [], offline: false, failPushes: 0, failPulls: 0, pushSizes: [], pullLimits: [], env: undefined as unknown as SyncEnv };
  d.env = { db, scheduler, transport: transportOf(w, () => d), build: 202610230000, locks: null, sleep: async () => {}, online: () => !d.offline };
  return d;
}

async function actorOf(d: Device) {
  const meta = (await d.db.meta.get('device'))!;
  return { userId: meta.userId, deviceId: meta.deviceId };
}

function answer(entryId: string, at: number, final: Grade, zone = LUX, extra: Partial<ReviewInput> = {}): ReviewInput {
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
    ...zone,
    ...extra,
  };
}

const sortCards = (cards: CardRow[]) => [...cards].sort((a, b) => `${a.entryId}/${a.skill}`.localeCompare(`${b.entryId}/${b.skill}`));
const facts = (cards: CardRow[]) => sortCards(cards).map((c) => ({ key: `${c.entryId}/${c.skill}`, due: c.due.getTime(), s: c.stability, d: c.difficulty, state: c.state }));
const allLog = (d: Device) => d.db.log.toArray();

async function expectMerged(...devices: Device[]) {
  const ids = new Set<string>();
  const merged: LogRecord[] = [];
  for (const d of devices) for (const r of await allLog(d)) if (!ids.has(r.id) && ids.add(r.id)) merged.push(r);
  const userId = devices[0]!.who.userId;
  const expected = facts(rebuildCards(scheduler, merged, userId));
  for (const d of devices) {
    expect((await allLog(d)).length).toBe(merged.length);
    expect(facts(await d.db.cards.toArray())).toEqual(expected);
  }
}

async function sync(d: Device, expected: RunResult = 'ok') {
  expect(await syncOnce(d.env)).toBe(expected);
}

describe('two devices in two zones', () => {
  it('answers on the same cards in turns, offline, Again with a return, exchanges in any order — the cards equal the rebuild of the merged journal on both', async () => {
    const w = world();
    const a = await device(w);
    const b = await device(w, a.who.userId);
    const actA = await actorOf(a);
    const actB = await actorOf(b);

    // A (Luxembourg) meets and answers two entries.
    await recordIntro(a.db, actA, { at: new Date(T), deckId: 'fr-test-01', entryId: 'e1', deckRevision: 1, sessionId: 's1', ...LUX });
    await recordReview(a.db, scheduler, actA, answer('e1', T + MIN, Rating.Good));
    await recordReview(a.db, scheduler, actA, answer('e2', T + 2 * MIN, Rating.Again));
    await sync(a);

    // B (Dushanbe) is offline: answers the same cards, Again and the return after it, a drill.
    b.offline = true;
    await sync(b, 'offline');
    const again = await recordReview(b.db, scheduler, actB, answer('e1', T + DAY + 30 * MIN, Rating.Again, DUSHANBE));
    await recordDrill(b.db, actB, { at: new Date(T + DAY + 31 * MIN), deckId: 'fr-test-01', entryId: 'e1', deckRevision: 1, sessionId: 's2', skill: 'speak', reviewId: again.record.id, skipped: false, echo: null, copy: null, ...DUSHANBE });
    await recordReview(b.db, scheduler, actB, answer('e1', T + DAY + 35 * MIN, Rating.Good, DUSHANBE, { requeue: 1 }));
    await recordReview(b.db, scheduler, actB, answer('e3', T + DAY + 36 * MIN, Rating.Easy, DUSHANBE));
    expect((await queueCounts(b.db)).pending).toBe(4);

    // A answers more meanwhile, then they meet in different orders, with a batch repeated.
    await recordReview(a.db, scheduler, actA, answer('e2', T + DAY + 10 * MIN, Rating.Good));
    b.offline = false;
    await sync(b);
    const repeat = await nextBatch(a.db, 100, 512 * 1024);
    await a.env.transport.push(repeat!.body, false);
    await sync(a);
    await sync(b);
    await expectMerged(a, b);
    expect((await queueCounts(a.db)).pending).toBe(0);
    expect((await queueCounts(b.db)).pending).toBe(0);

    // One more round on both, then the same again: nothing changes.
    await recordReview(b.db, scheduler, actB, answer('e2', T + 3 * DAY, Rating.Hard, DUSHANBE));
    await recordReview(a.db, scheduler, actA, answer('e1', T + 3 * DAY + MIN, Rating.Good));
    await sync(a);
    await sync(b);
    await sync(a);
    await expectMerged(a, b);
    const before = facts(await a.db.cards.toArray());
    await sync(a);
    await sync(b);
    expect(facts(await a.db.cards.toArray())).toEqual(before);
    await expectMerged(a, b);
  });

  it('an answer earlier than one already in the card (the other clock was ahead): the card is rebuilt, not stepped', async () => {
    const w = world();
    const a = await device(w);
    const b = await device(w, a.who.userId);
    await recordReview(a.db, scheduler, await actorOf(a), answer('e1', T + 2 * DAY, Rating.Good));
    await sync(a);
    await recordReview(b.db, scheduler, await actorOf(b), answer('e1', T, Rating.Again, DUSHANBE));
    await sync(b, 'ok');
    await recordReview(b.db, scheduler, await actorOf(b), answer('e1', T + DAY, Rating.Hard, DUSHANBE));
    await sync(b);
    await sync(a);
    await expectMerged(a, b);
  });

  it('one entry introduced on both devices offline counts once in the limit of new entries', async () => {
    const w = world();
    const a = await device(w);
    const b = await device(w, a.who.userId);
    const intro = { deckId: 'fr-test-01', entryId: 'e1', deckRevision: 1, sessionId: 's1' };
    await recordIntro(a.db, await actorOf(a), { ...intro, at: new Date(T), ...LUX });
    await recordIntro(b.db, await actorOf(b), { ...intro, at: new Date(T + MIN), ...LUX });
    await sync(a);
    await sync(b);
    await sync(a);
    const log = await allLog(a);
    expect(log.filter((r) => r.type === 'intro')).toHaveLength(2);
    expect(introsToday(log, new Date(T + 2 * MIN), 'Europe/Luxembourg')).toBe(1);
  });

  it('records of a deck this device does not have: kept, and their cards are rebuilt (STAGE6 5.8)', async () => {
    const w = world();
    const a = await device(w);
    const b = await device(w, a.who.userId);
    await recordReview(a.db, scheduler, await actorOf(a), answer('x', T, Rating.Good, LUX, { deckId: 'my-other-deck' }));
    await sync(a);
    await sync(b);
    expect((await b.db.cards.toArray()).map((c) => c.deckId)).toEqual(['my-other-deck']);
  });
});

describe('the queue', () => {
  it('received records never enter the queue; the send status never changes the record', async () => {
    const w = world();
    const a = await device(w);
    const b = await device(w, a.who.userId);
    const { record } = await recordReview(a.db, scheduler, await actorOf(a), answer('e1', T, Rating.Good));
    const stored = await a.db.log.get(record.id);
    await sync(a);
    expect(await a.db.log.get(record.id)).toEqual(stored);
    await sync(b);
    expect(await b.db.outbox.count()).toBe(0);
    expect(await b.db.log.count()).toBe(1);
  });

  it('a full round: Date, undefined, NaN, nested objects → push from A → pull on B → push again from B → duplicate, the same hash', async () => {
    const w = world();
    const a = await device(w);
    const b = await device(w, a.who.userId);
    const { record } = await recordReview(
      a.db,
      scheduler,
      await actorOf(a),
      answer('e1', T, Rating.Good, LUX, { latencyMs: Number.NaN, voice: undefined, recognitionErrors: [{ code: 'no-speech', atMs: 12 }] }),
    );
    (record as unknown as { later: unknown }).later = { when: new Date(T), list: [{ b: 2, a: 1 }] };
    await a.db.log.put(record);
    await sync(a);
    const row = w.db.sqlite.prepare('SELECT body, body_hash FROM journal').get() as { body: string; body_hash: string };
    expect(row.body).toBe(canonicalJson(await a.db.log.get(record.id)));
    await sync(b);
    const onB = (await b.db.log.get(record.id))!;
    const res = await b.env.transport.push(`{"records":[${JSON.stringify(onB)}]}`, false);
    expect(res).toMatchObject({ ok: true, data: { duplicate: [record.id], conflict: [] } });
    expect((w.db.sqlite.prepare('SELECT body_hash FROM journal').get() as { body_hash: string }).body_hash).toBe(row.body_hash);
  });

  it('refused and conflicting records stay with their reason, are not sent again, and go into the file', async () => {
    const w = world();
    const a = await device(w);
    clock.now = T;
    const late = await recordReview(a.db, scheduler, await actorOf(a), answer('e1', T + 3 * 3_600_000, Rating.Good));
    const ok = await recordReview(a.db, scheduler, await actorOf(a), answer('e2', T, Rating.Good));
    await sync(a);
    clock.now = T + 10 * DAY;
    expect(await a.db.outbox.toArray()).toEqual([{ id: late.record.id, status: 'rejected', reason: 'future', queuedAt: T + 3 * 3_600_000 }]);
    expect(await queueCounts(a.db)).toEqual({ pending: 0, notAccepted: 1 });
    const pushes = a.calls.filter(([k]) => k === 'push').length;
    await sync(a);
    expect(a.calls.filter(([k]) => k === 'push').length).toBe(pushes);
    const file = JSON.parse((await exportJournal(a.db, await actorOf(a))).json) as { records: { id: string }[] };
    expect(file.records.map((r) => r.id).sort()).toEqual([late.record.id, ok.record.id].sort());

    // The same id with other content on the server: conflict, kept here.
    const changed = { ...(await a.db.log.get(ok.record.id))!, final: 1 as const };
    await a.db.outbox.put({ id: ok.record.id, status: 'pending', queuedAt: T });
    await a.db.log.put(changed);
    await sync(a);
    expect(await a.db.outbox.get(ok.record.id)).toMatchObject({ status: 'conflict', reason: 'conflict' });
  });

  it('401: the queue stays where it is', async () => {
    const w = world();
    const a = await device(w);
    await recordReview(a.db, scheduler, await actorOf(a), answer('e1', T, Rating.Good));
    w.db.sqlite.exec('DELETE FROM sessions');
    await sync(a, 'unauthorized');
    expect((await queueCounts(a.db)).pending).toBe(1);
    await markSignedOut(a.db);
    await recordReview(a.db, scheduler, await actorOf(a), answer('e2', T, Rating.Good));
    expect((await queueCounts(a.db)).pending).toBe(1);
  });

  it('batches of 25 (step "CPU of sign-in routes", 27.10.2026): 60 records go as 25, 25, 10', async () => {
    const w = world();
    const a = await device(w);
    const act = await actorOf(a);
    for (let i = 0; i < 60; i++) await recordReview(a.db, scheduler, act, answer(`e${i}`, T + i * 1000, Rating.Good));
    await sync(a);
    expect(a.pushSizes).toEqual([25, 25, 10]);
    expect((await queueCounts(a.db)).pending).toBe(0);
  });

  it('5xx: the batch of 25 is halved 25 → 13 → 10, then the run fails and the queue waits', async () => {
    const w = world();
    const a = await device(w);
    const act = await actorOf(a);
    for (let i = 0; i < 30; i++) await recordReview(a.db, scheduler, act, answer(`e${i}`, T + i * 1000, Rating.Good));
    a.failPushes = 1;
    await sync(a);
    expect(a.pushSizes).toEqual([25, 13, 13, 4]);
    expect((await queueCounts(a.db)).pending).toBe(0);
    a.pushSizes = [];
    for (let i = 0; i < 30; i++) await recordReview(a.db, scheduler, act, answer(`f${i}`, T + i * 1000, Rating.Good));
    a.failPushes = 10;
    await sync(a, 'failed');
    expect(a.pushSizes).toEqual([25, 13, 10]);
    expect((await queueCounts(a.db)).pending).toBe(30);
  });

  it('pull pages of 200; a 5xx halves the page 200 → 100 and the next page is 200 again', async () => {
    const w = world();
    const b = await device(w);
    const act = await actorOf(b);
    for (let i = 0; i < 250; i++) await recordReview(b.db, scheduler, act, answer(`e${i}`, T + i * 1000, Rating.Good));
    await sync(b);
    const a = await device(w, b.who.userId);
    a.failPulls = 1;
    await sync(a);
    expect(a.pullLimits).toEqual([200, 100, 200]);
    expect(await a.db.log.count()).toBe(250);
  });

  it('pull failing down to a page of 50: the run fails, the cursor stays, the next run starts at 200', async () => {
    const w = world();
    const b = await device(w);
    const act = await actorOf(b);
    for (let i = 0; i < 5; i++) await recordReview(b.db, scheduler, act, answer(`e${i}`, T + i * 1000, Rating.Good));
    await sync(b);
    const a = await device(w, b.who.userId);
    a.failPulls = 10;
    await sync(a, 'failed');
    expect(a.pullLimits).toEqual([200, 100, 50]);
    expect(await a.db.log.count()).toBe(0);
    a.failPulls = 0;
    a.pullLimits = [];
    await sync(a);
    expect(a.pullLimits).toEqual([200]);
    expect(await a.db.log.count()).toBe(5);
  });

  it('the push while the page goes away: keepalive, at most 60 KiB, only records', async () => {
    const w = world();
    const a = await device(w);
    const act = await actorOf(a);
    for (let i = 0; i < 120; i++) await recordReview(a.db, scheduler, act, answer(`e${i}`, T + i * 1000, Rating.Good, LUX, { answer: 'x'.repeat(400) }));
    await sendBeforeLeaving(a.env);
    const [[kind, bytes, keepalive]] = a.calls as [[string, number, boolean]];
    expect(kind).toBe('push');
    expect(keepalive).toBe(true);
    expect(bytes).toBeLessThanOrEqual(60 * 1024);
    const left = (await queueCounts(a.db)).pending;
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThan(120);
  });

  it('one run at a time: a second one at the same moment is busy', async () => {
    const w = world();
    const a = await device(w);
    await recordReview(a.db, scheduler, await actorOf(a), answer('e1', T, Rating.Good));
    const [first, second] = await Promise.all([syncOnce(a.env), syncOnce(a.env)]);
    expect([first, second].sort()).toEqual(['busy', 'ok']);
  });

  it('with Web Locks: another window holding the lock makes this run busy', async () => {
    const w = world();
    const a = await device(w);
    const held: LockManager = { request: async (_n: string, _o: unknown, f: (lock: Lock | null) => unknown) => f(null) } as unknown as LockManager;
    expect(await syncOnce({ ...a.env, locks: held })).toBe('busy');
  });
});

describe('versions', () => {
  it('426 on push: marked, no more exchange; a newer build clears the mark', async () => {
    const w = world();
    const a = await device(w);
    await recordReview(a.db, scheduler, await actorOf(a), answer('e1', T, Rating.Good));
    const old: SyncEnv = { ...a.env, transport: { ...a.env.transport, push: async () => ({ ok: false, status: 426, error: 'upgrade_required' }) } };
    let told = 0;
    expect(await syncOnce({ ...old, onNeedsUpdate: () => told++ })).toBe('update');
    expect(told).toBe(1);
    expect((await a.db.meta.get('device'))!.sync!.needsUpdate).toMatchObject({ reason: 'client', build: a.env.build });
    await sync(a, 'update');
    expect(await settleUpdate(a.db, scheduler, a.env.build, RULES_VERSION)).toBe(true);
    expect(await settleUpdate(a.db, scheduler, a.env.build + 1, RULES_VERSION)).toBe(false);
    await sync(a);
    expect((await queueCounts(a.db)).pending).toBe(0);
  });

  it('records with newer rules: saved with the cursor, cards not rebuilt, marked; rebuilt after the update', async () => {
    const w = world();
    const a = await device(w);
    const b = await device(w, a.who.userId);
    const { record } = await recordReview(a.db, scheduler, await actorOf(a), answer('e1', T, Rating.Good));
    await a.db.log.put({ ...record, rules: RULES_VERSION + 1 });
    await sync(a);
    await sync(b, 'update');
    expect(await b.db.log.count()).toBe(1);
    expect(await b.db.cards.count()).toBe(0);
    const sync1 = (await b.db.meta.get('device'))!.sync!;
    expect(sync1).toMatchObject({ needsRebuild: true, needsUpdate: { reason: 'rules' } });
    expect(sync1.cursor).toBeGreaterThan(0);
    // A newer build that still has the old rules: the mark holds.
    expect(await settleUpdate(b.db, scheduler, b.env.build + 1, RULES_VERSION)).toBe(true);
    // A build with the new rules: rebuilt, no mark.
    expect(await settleUpdate(b.db, scheduler, b.env.build + 2, RULES_VERSION + 1)).toBe(false);
    expect(await b.db.cards.count()).toBe(1);
  });

  it('a received page that does not read stores nothing: the cursor and the records stay', async () => {
    const w = world();
    const a = await device(w);
    const page = { records: [{ id: 'x', type: 'review', userId: a.who.userId }], next: 7, more: false, settings: {}, serverTime: T };
    await expect(applyPull(a.db, scheduler, page, a.env.build)).rejects.toThrow();
    expect(await a.db.log.count()).toBe(0);
    expect((await a.db.meta.get('device'))!.sync).toBeUndefined();
  });
});

describe('consent to the current notice (R39)', () => {
  it('403 consent_required: one request, no retries, the queue stays; after the consent it goes', async () => {
    const w = world();
    const a = await device(w, undefined, { consent: null });
    await recordReview(a.db, scheduler, await actorOf(a), answer('e1', T, Rating.Good));
    await recordReview(a.db, scheduler, await actorOf(a), answer('e2', T, Rating.Good));
    await sync(a, 'consent');
    expect(a.calls).toHaveLength(1);
    expect((await queueCounts(a.db)).pending).toBe(2);
    expect((await a.db.meta.get('device'))!.sync!.needsConsent).toMatchObject({ version: NOTICE_VERSION });
    expect(w.db.sqlite.prepare('SELECT count(*) AS n FROM journal').get()).toEqual({ n: 0 });

    // The consent is given (the screen of 6a.5b does it through /api/auth/consent): the queue goes, the mark goes.
    w.db.sqlite
      .prepare("INSERT INTO consents (id, user_id, notice_version, given_by, parent_name, device_id, given_at) VALUES ('c', ?, ?, 'self', NULL, 'd', 1)")
      .run(a.who.userId, NOTICE_VERSION);
    await sync(a);
    expect((await queueCounts(a.db)).pending).toBe(0);
    expect((await a.db.meta.get('device'))!.sync!.needsConsent).toBeUndefined();
  });

  it('under 16 with a consent the child gave (self): refused too', async () => {
    const w = world();
    const a = await device(w, undefined, { minor: true, consent: { by: 'self' } });
    await recordReview(a.db, scheduler, await actorOf(a), answer('e1', T, Rating.Good));
    await sync(a, 'consent');
    expect((await queueCounts(a.db)).pending).toBe(1);
  });
});

describe('settings', () => {
  it('first exchange after sign-in: the account\'s values win, a key the account lacks is sent', async () => {
    const w = world();
    const a = await device(w);
    await saveSettings(a.db, { ...(await a.db.settings.get(a.who.userId))!, newPerDay: 10, uiLang: 'ru' });
    await sync(a);
    const b = await device(w, a.who.userId);
    await b.db.settings.put({ ...(await b.db.settings.get(b.who.userId))!, uiLang: 'en', newPerDay: 20, biasing: true });
    await sync(b);
    expect(await b.db.settings.get(b.who.userId)).toMatchObject({ uiLang: 'ru', newPerDay: 10, meaningLang: 'tg', biasing: true });
  });

  it('the change the server got last wins, by key; device-only keys never leave', async () => {
    const w = world();
    const a = await device(w);
    const b = await device(w, a.who.userId);
    await sync(a);
    await sync(b);
    await saveSettings(b.db, { ...(await b.db.settings.get(b.who.userId))!, newPerDay: 15 });
    await saveSettings(a.db, { ...(await a.db.settings.get(a.who.userId))!, newPerDay: 20, uiLang: 'en', biasing: true });
    await sync(a);
    await sync(b);
    await sync(a);
    expect(await a.db.settings.get(a.who.userId)).toMatchObject({ newPerDay: 15, uiLang: 'en', biasing: true });
    expect(await b.db.settings.get(b.who.userId)).toMatchObject({ newPerDay: 15, uiLang: 'en' });
    expect((await b.db.settings.get(b.who.userId))!.biasing).toBeUndefined();
    const keys = (w.db.sqlite.prepare('SELECT key FROM user_settings ORDER BY key').all() as { key: string }[]).map((r) => r.key);
    expect(keys).toEqual(['meaningLang', 'newPerDay', 'uiLang']);
  });

  it('a setting changed while signed out is not pending', async () => {
    const w = world();
    const a = await device(w);
    await markSignedOut(a.db);
    expect(await saveSettings(a.db, { ...(await a.db.settings.get(a.who.userId))!, newPerDay: 15 })).toBe(false);
  });
});

describe('when to send', () => {
  it('answers every 5 s for 3 minutes: sends at least once a minute', () => {
    const timer = new SendTimer();
    const sends: number[] = [];
    let now = 0;
    for (let t = 0; t <= 180_000; t += 1000) {
      now = t;
      const due = timer.dueAt();
      if (due !== null && due <= now) {
        sends.push(now);
        timer.sent();
      }
      if (t % 5000 === 0) timer.queued(now);
    }
    expect(sends.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < sends.length; i++) expect(sends[i]! - sends[i - 1]!).toBeLessThanOrEqual(SEND_MAX_WAIT_MS + 5000);
  });

  it(`${SEND_DELAY_MS / 1000} s after the last answer; at once at ${SEND_NOW_QUEUE} records`, () => {
    const timer = new SendTimer();
    expect(timer.dueAt()).toBeNull();
    timer.queued(1000);
    expect(timer.dueAt()).toBe(1000 + SEND_DELAY_MS);
    for (let i = 1; i < SEND_NOW_QUEUE; i++) timer.queued(1000 + i);
    expect(timer.dueAt()).toBe(1000 + SEND_NOW_QUEUE - 1);
  });

  it('a push body stays under the server limit', async () => {
    const w = world();
    const a = await device(w);
    const act = await actorOf(a);
    for (let i = 0; i < 150; i++) await recordReview(a.db, scheduler, act, answer(`e${i}`, T + i, Rating.Good, LUX, { answer: 'é'.repeat(3000) }));
    const batch = (await nextBatch(a.db, 100, 512 * 1024))!;
    expect(new TextEncoder().encode(batch.body).byteLength).toBeLessThanOrEqual(512 * 1024);
    expect(new TextEncoder().encode(batch.body).byteLength).toBeLessThan(PUSH_BODY_LIMIT);
    expect(batch.ids.length).toBeLessThan(100);
  });
});
