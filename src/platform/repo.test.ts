import 'fake-indexeddb/auto';
import { Rating, type Grade } from 'ts-fsrs';
import { afterEach, describe, expect, it } from 'vitest';
import { parseBackup } from '../core/backup';
import { rebuildCards } from '../core/cards';
import { readDeckArchive } from '../core/deckArchive';
import type { ReviewRecord } from '../core/model';
import { createScheduler } from '../core/scheduler';
import { deck, deckZip, fakeAudio } from '../test/decks';
import { ManaDb } from './db';
import {
  applyImport,
  ensureDevice,
  exportJournal,
  getMedia,
  lastReview,
  listDecks,
  loadSessionData,
  listEntries,
  prepareImport,
  rebuildUserCards,
  recordIntro,
  recordReview,
  restoreJournal,
  userLog,
  type Actor,
  type ReviewInput,
} from './repo';

let n = 0;
const open: ManaDb[] = [];
function freshDb(): ManaDb {
  const db = new ManaDb(`test-${++n}-${Date.now()}`);
  open.push(db);
  return db;
}

afterEach(async () => {
  for (const db of open.splice(0)) {
    db.close();
    await db.delete();
  }
});

function ids(prefix: string) {
  let i = 0;
  return () => `${prefix}-${String(++i).padStart(4, '0')}`;
}

const T0 = Date.parse('2026-10-01T08:00:00Z');
const D = 86_400_000;

async function importDeck(db: ManaDb, d = deck(1, ['a', 'b', 'c']), fileName = 'Урок 1.zip', now = new Date(T0)) {
  const archive = await readDeckArchive(await deckZip(d), fileName);
  expect(archive.check.errors).toEqual([]);
  const plan = await prepareImport(db, archive, now);
  await applyImport(db, plan, archive.audio);
  return plan;
}

function answer(entryId: string, at: number, final: Grade, skill: ReviewInput['skill'] = 'speak'): ReviewInput {
  return {
    at: new Date(at),
    deckId: 'fr-test-01',
    entryId,
    deckRevision: 1,
    sessionId: 's1',
    skill,
    expected: entryId,
    mode: 'voice',
    answer: entryId,
    alternatives: [entryId],
    verdict: final === Rating.Again ? 'incorrect' : 'correct',
    errorType: null,
    latencyMs: 1800,
    totalMs: 2600,
    micDelayMs: 300,
    retries: 0,
    recognitionLang: 'fr-FR',
    suggested: final,
    reason: final === Rating.Again ? 'incorrect' : 'correct',
    final,
    correction: null,
  };
}

async function someProgress(db: ManaDb, actor: Actor) {
  const scheduler = createScheduler();
  const newId = ids('log');
  await recordIntro(db, actor, { at: new Date(T0), deckId: 'fr-test-01', entryId: 'a', deckRevision: 1, sessionId: 's1' }, newId);
  await recordReview(db, scheduler, actor, answer('a', T0 + 60_000, Rating.Good), newId);
  await recordReview(db, scheduler, actor, answer('a', T0 + 61_000, Rating.Good, 'listen'), newId);
  await recordReview(db, scheduler, actor, answer('b', T0 + 120_000, Rating.Again), newId);
  await recordReview(db, scheduler, actor, answer('a', T0 + 2 * D, Rating.Hard), newId);
  await recordReview(db, scheduler, actor, answer('b', T0 + 2 * D, Rating.Good), newId);
}

describe('device', () => {
  it('first run creates userId and deviceId; later runs keep them', async () => {
    const db = freshDb();
    const first = await ensureDevice(db, new Date(T0), ids('id'));
    expect(first).toMatchObject({ key: 'device', userId: 'id-0001', deviceId: 'id-0002' });
    const again = await ensureDevice(db, new Date(T0 + D), ids('other'));
    expect(again).toEqual(first);
  });

  it('real ids are UUIDs', async () => {
    const m = await ensureDevice(freshDb());
    expect(m.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(m.deviceId).not.toBe(m.userId);
  });
});

describe('deck import', () => {
  it('installs the deck, its entries in order and the audio', async () => {
    const db = freshDb();
    await importDeck(db, deck(1, ['b', 'a', 'c']), 'C:\\Downloads\\Фаронсавӣ · Дарси 01.zip');
    const decks = await listDecks(db);
    expect(decks).toHaveLength(1);
    expect(decks[0]).toMatchObject({ id: 'fr-test-01', name: 'Фаронсавӣ · Дарси 01', revision: 1, entryCount: 3 });
    expect((await listEntries(db, 'fr-test-01')).map((e) => e.entryId)).toEqual(['b', 'a', 'c']);
    const media = await getMedia(db, 'fr-test-01', 'audio/a.mp3');
    expect(media?.type).toBe('audio/mpeg');
    expect(new Uint8Array(media!.data)).toEqual(fakeAudio('audio/a.mp3', 1));
    expect(decks[0]!.audioBytes).toBe(3 * fakeAudio('audio/a.mp3', 1).length);
  });

  it('a new revision updates by id, hides missing entries and keeps the journal and cards', async () => {
    const db = freshDb();
    const actor = await ensureDevice(db);
    await importDeck(db);
    await someProgress(db, actor);
    const logBefore = await userLog(db, actor.userId);
    const cardsBefore = await db.cards.toArray();

    const next = deck(2, ['a', 'c', 'd']);
    next.entries[0]!.text = 'a corrigé';
    const plan = await importDeck(db, next, 'Урок 1 (новый).zip', new Date(T0 + 3 * D));
    expect(plan.summary).toEqual({ added: 1, updated: 2, hidden: 1, restored: 0 });

    expect((await listEntries(db, 'fr-test-01')).map((e) => [e.entryId, e.text])).toEqual([
      ['a', 'a corrigé'],
      ['c', 'c'],
      ['d', 'd'],
    ]);
    const all = await listEntries(db, 'fr-test-01', true);
    expect(all.find((e) => e.entryId === 'b')).toMatchObject({ hidden: 1, text: 'b' });
    expect((await listDecks(db))[0]).toMatchObject({ name: 'Урок 1 (новый)', revision: 2, entryCount: 3, hiddenCount: 1 });
    // Audio replaced with the new revision's files; b's audio is gone with the old revision.
    expect(new Uint8Array((await getMedia(db, 'fr-test-01', 'audio/a.mp3'))!.data)).toEqual(fakeAudio('audio/a.mp3', 2));
    expect(await getMedia(db, 'fr-test-01', 'audio/b.mp3')).toBeUndefined();

    expect(await userLog(db, actor.userId)).toEqual(logBefore);
    expect(await db.cards.toArray()).toEqual(cardsBefore);

    // b comes back in revision 3: shown again, its card and history still there.
    const plan3 = await importDeck(db, deck(3, ['a', 'b', 'c', 'd']), 'Урок 1.zip');
    expect(plan3.summary.restored).toBe(1);
    expect((await listEntries(db, 'fr-test-01')).map((e) => e.entryId)).toEqual(['a', 'b', 'c', 'd']);
    expect(await db.cards.get([actor.userId, 'fr-test-01', 'b', 'speak'])).toBeDefined();
  });

  it('same and older revisions need confirmation; the journal is untouched by a reinstall', async () => {
    const db = freshDb();
    const actor = await ensureDevice(db);
    await importDeck(db, deck(2, ['a', 'b']));
    await someProgress(db, actor);
    const logBefore = await userLog(db, actor.userId);

    const same = await readDeckArchive(await deckZip(deck(2, ['a', 'b'])), 'Урок.zip');
    const samePlan = await prepareImport(db, same);
    expect(samePlan.confirm).toEqual([{ type: 'reinstall', revision: 2 }]);
    await applyImport(db, samePlan, same.audio);
    expect(await userLog(db, actor.userId)).toEqual(logBefore);

    const older = await readDeckArchive(await deckZip(deck(1, ['a', 'b'])), 'Урок.zip');
    expect((await prepareImport(db, older)).confirm).toEqual([{ type: 'older', installed: 2, incoming: 1 }]);
  });

  it('a deck with errors is reported and nothing is written', async () => {
    const db = freshDb();
    const bad = deck(1, ['a']);
    bad.language = 'lb-LU';
    const archive = await readDeckArchive(await deckZip(bad), 'Плохая.zip');
    expect(archive.check.deck).toBeNull();
    expect(archive.check.errors.length).toBeGreaterThan(0);
    expect(archive.audio).toEqual([]);
    await expect(prepareImport(db, archive)).rejects.toThrow();
    expect(await listDecks(db)).toEqual([]);

    const notZip = await readDeckArchive(new TextEncoder().encode('not a zip'), 'текст.zip');
    expect(notZip.check.errors[0]?.message).toContain('не открывается как ZIP');
  });

  it('a failure in the middle of writing leaves the previous revision whole', async () => {
    const db = freshDb();
    await importDeck(db, deck(1, ['a', 'b']));
    const archive = await readDeckArchive(await deckZip(deck(2, ['a', 'c'])), 'Урок.zip');
    const plan = await prepareImport(db, archive);
    // A value IndexedDB cannot store: the media write fails after entries were replaced.
    const broken = [...archive.audio, { path: 'audio/x.mp3', type: 'audio/mpeg', data: (() => 0) as unknown as ArrayBuffer }];
    await expect(applyImport(db, plan, broken)).rejects.toThrow();
    expect((await listDecks(db))[0]?.revision).toBe(1);
    expect((await listEntries(db, 'fr-test-01', true)).map((e) => [e.entryId, e.hidden])).toEqual([
      ['a', 0],
      ['b', 0],
    ]);
    expect(new Uint8Array((await getMedia(db, 'fr-test-01', 'audio/b.mp3'))!.data)).toEqual(fakeAudio('audio/b.mp3', 1));
  });
});

describe('journal and cards', () => {
  it('records get UUID-like ids, userId and deviceId; answers carry the computed next due', async () => {
    const db = freshDb();
    const actor = await ensureDevice(db);
    const r = await recordReview(db, createScheduler(), actor, answer('a', T0, Rating.Good));
    expect(r.record).toMatchObject({ type: 'review', userId: actor.userId, deviceId: actor.deviceId });
    expect(r.record.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.record.fsrs.nextDue).toEqual(r.card.due);
    expect(await db.log.get(r.record.id)).toEqual(r.record);
  });

  it('an existing journal id cannot be written twice', async () => {
    const db = freshDb();
    const actor = await ensureDevice(db);
    const input = { at: new Date(T0), deckId: 'd', entryId: 'a', deckRevision: 1, sessionId: 's' };
    await recordIntro(db, actor, input, () => 'same-id');
    await expect(recordIntro(db, actor, input, () => 'same-id')).rejects.toThrow();
  });

  it('cards rebuilt from the journal equal the cards updated answer by answer', async () => {
    const db = freshDb();
    const actor = await ensureDevice(db);
    await someProgress(db, actor);
    const stored = await db.cards.toArray();
    expect(stored).toHaveLength(3);

    await db.cards.clear();
    const rebuilt = await rebuildUserCards(db, createScheduler(), actor.userId);
    const key = (c: { deckId: string; entryId: string; skill: string }) => `${c.deckId}/${c.entryId}/${c.skill}`;
    const sort = <T extends { deckId: string; entryId: string; skill: string }>(a: T[]) =>
      [...a].sort((x, y) => key(x).localeCompare(key(y)));
    expect(sort(rebuilt)).toEqual(sort(stored));
    expect(sort(await db.cards.toArray())).toEqual(sort(stored));

    // Every stored next due date is what the replay gives after that answer.
    const reviews = (await userLog(db, actor.userId)).filter((r): r is ReviewRecord => r.type === 'review');
    for (const r of reviews) {
      const upTo = reviews.filter((x) => x.at.getTime() <= r.at.getTime());
      const card = rebuildCards(createScheduler(), upTo, actor.userId).find((c) => c.lastLogId === r.id);
      expect(card?.due).toEqual(r.fsrs.nextDue);
    }
  });
});

describe('session data (stage 4.2)', () => {
  it('lastReview: the latest answer on that card only', async () => {
    const db = freshDb();
    const actor = await ensureDevice(db);
    await someProgress(db, actor);
    const a = await lastReview(db, actor.userId, 'fr-test-01', 'a', 'speak');
    expect(a).toMatchObject({ entryId: 'a', skill: 'speak', final: Rating.Hard });
    expect((await lastReview(db, actor.userId, 'fr-test-01', 'a', 'listen'))?.final).toBe(Rating.Good);
    expect(await lastReview(db, actor.userId, 'fr-test-01', 'c', 'speak')).toBeNull();
    expect(await lastReview(db, 'someone-else', 'fr-test-01', 'a', 'speak')).toBeNull();
  });

  it('loadSessionData: entries with hidden ones, the deck cards, the whole journal', async () => {
    const db = freshDb();
    const actor = await ensureDevice(db);
    await importDeck(db);
    await importDeck(db, deck(2, ['a', 'b']), 'Урок 1.zip');
    await someProgress(db, actor);
    const data = await loadSessionData(db, actor.userId, 'fr-test-01');
    expect(data.entries.map((e) => [e.entryId, e.hidden])).toEqual([['a', 0], ['b', 0], ['c', 1]]);
    expect(data.cards).toHaveLength(3);
    expect(data.log).toHaveLength(6);
  });

  it('an introduction keeps its "say it aloud" and "copy it out" results', async () => {
    const db = freshDb();
    const actor = await ensureDevice(db);
    const echo = { answer: 'le nom', alternatives: ['le nom'], verdict: 'correct' as const, skipped: false };
    const copy = { typed: 'le non', verdict: 'almost' as const, errorType: 'typo' };
    const r = await recordIntro(db, actor, { at: new Date(T0), deckId: 'd', entryId: 'a', deckRevision: 1, sessionId: 's', echo, copy });
    expect(await db.log.get(r.id)).toMatchObject({ type: 'intro', echo, copy });
  });
});

describe('backup', () => {
  it('save → restore into an empty installation: same records, same cards, user adopted', async () => {
    const a = freshDb();
    const actorA = await ensureDevice(a);
    await someProgress(a, actorA);
    const { json, count } = await exportJournal(a, actorA, new Date(T0 + 3 * D));
    expect(count).toBe(6);

    const b = freshDb();
    const actorB = await ensureDevice(b);
    await b.settings.put({ userId: actorB.userId, uiLang: 'tg', meaningLang: 'tg', newPerDay: 5, updatedAt: new Date(T0) });
    const res = await restoreJournal(b, createScheduler(), json);
    expect(res).toEqual({ ok: true, added: 6, skipped: 0, userId: actorA.userId });
    expect((await b.meta.get('device'))?.userId).toBe(actorA.userId);
    expect((await b.meta.get('device'))?.deviceId).toBe(actorB.deviceId);
    expect((await b.settings.get(actorA.userId))?.uiLang).toBe('tg');

    const sortById = <T extends { id: string }>(x: T[]) => [...x].sort((p, q) => p.id.localeCompare(q.id));
    expect(sortById(await userLog(b, actorA.userId))).toEqual(sortById(await userLog(a, actorA.userId)));
    const ck = (c: { entryId: string; skill: string }) => c.entryId + c.skill;
    const sortCards = <T extends { entryId: string; skill: string }>(x: T[]) => [...x].sort((p, q) => ck(p).localeCompare(ck(q)));
    expect(sortCards(await b.cards.toArray())).toEqual(sortCards(await a.cards.toArray()));
  });

  it('restoring the same file again adds nothing; new answers in the file are added', async () => {
    const db = freshDb();
    const actor = await ensureDevice(db);
    await someProgress(db, actor);
    const first = (await exportJournal(db, actor)).json;
    expect(await restoreJournal(db, createScheduler(), first)).toEqual({ ok: true, added: 0, skipped: 6, userId: actor.userId });

    // A file with one record this installation lost.
    const parsed = parseBackup(first);
    if (!parsed.ok) throw new Error('backup did not parse');
    const lost = parsed.backup.records[3]!;
    await db.log.delete(lost.id);
    expect(await restoreJournal(db, createScheduler(), first)).toEqual({ ok: true, added: 1, skipped: 5, userId: actor.userId });
    expect(await db.log.get(lost.id)).toEqual(lost);
  });

  it('a file of another user is refused when this installation has its own answers', async () => {
    const a = freshDb();
    const actorA = await ensureDevice(a);
    await someProgress(a, actorA);
    const b = freshDb();
    const actorB = await ensureDevice(b);
    await someProgress(b, actorB);
    const res = await restoreJournal(b, createScheduler(), (await exportJournal(a, actorA)).json);
    expect(res).toEqual({ ok: false, error: 'otherUser' });
    expect(await userLog(b, actorA.userId)).toEqual([]);
  });

  it('broken files are refused with a reason', async () => {
    const db = freshDb();
    await ensureDevice(db);
    const s = createScheduler();
    expect(await restoreJournal(db, s, '{oops')).toEqual({ ok: false, error: 'json' });
    expect(await restoreJournal(db, s, '{"format":"other"}')).toEqual({ ok: false, error: 'format' });
    const v2 = JSON.stringify({ format: 'mana-journal', version: 2 });
    expect(await restoreJournal(db, s, v2)).toEqual({ ok: false, error: 'version' });
    const bad = JSON.stringify({
      format: 'mana-journal',
      version: 1,
      exportedAt: new Date(T0).toISOString(),
      userId: 'u',
      deviceId: 'd',
      records: [{ id: 'x', type: 'review', userId: 'u' }],
    });
    expect(await restoreJournal(db, s, bad)).toEqual({ ok: false, error: 'records' });
    expect(await db.log.count()).toBe(0);
  });
});
