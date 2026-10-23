import { fsrs, Rating, type Grade } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { answerCard, rebuildCards, stepCard } from './cards';
import { cardKey, type DrillRecord, type IntroRecord, type LogRecord, type ReviewRecord } from './model';
import { createScheduler, type CardState } from './scheduler';

const USER = 'user-1';
const H = 3600_000;
const D = 24 * H;
const T0 = Date.parse('2026-10-01T08:00:00Z');

function review(id: string, entryId: string, skill: ReviewRecord['skill'], at: number, final: Grade): Omit<ReviewRecord, 'fsrs'> {
  return {
    id,
    type: 'review',
    userId: USER,
    deviceId: 'dev-1',
    at: new Date(at),
    deckId: 'd',
    entryId,
    deckRevision: 1,
    sessionId: 's',
    skill,
    expected: entryId,
    mode: 'voice',
    answer: entryId,
    alternatives: [],
    verdict: final === Rating.Again ? 'incorrect' : 'correct',
    errorType: null,
    latencyMs: 1500,
    totalMs: 2500,
    micDelayMs: null,
    retries: 0,
    recognitionLang: 'fr-FR',
    suggested: final,
    reason: 'correct',
    final,
    correction: null,
  };
}

/** Records the way the app writes them: each answer stepped from the card as it stood. */
function recordIncrementally(scheduler = createScheduler()) {
  const answers: Omit<ReviewRecord, 'fsrs'>[] = [
    review('r01', 'a', 'speak', T0, Rating.Good),
    review('r02', 'a', 'listen', T0 + 1000, Rating.Good),
    review('r03', 'b', 'speak', T0 + 2000, Rating.Again),
    review('r04', 'b', 'speak', T0 + 10 * 60_000, Rating.Hard),
    review('r05', 'a', 'speak', T0 + D, Rating.Good),
    review('r06', 'b', 'speak', T0 + D + H, Rating.Good),
    review('r07', 'a', 'speak', T0 + 4 * D, Rating.Easy),
    review('r08', 'b', 'speak', T0 + 5 * D, Rating.Again),
    review('r09', 'b', 'speak', T0 + 5 * D + 15 * 60_000, Rating.Good),
    review('r10', 'a', 'speak', T0 + 20 * D, Rating.Good),
    review('r11', 'a', 'listen', T0 + 21 * D, Rating.Hard),
  ];
  const cards = new Map<string, CardState>();
  const log: ReviewRecord[] = [];
  for (const a of answers) {
    const key = cardKey(a);
    const step = stepCard(scheduler, cards.get(key) ?? null, a.final, a.at);
    cards.set(key, step.card);
    log.push({ ...a, fsrs: step.fsrs });
  }
  return { cards, log };
}

describe('rebuildCards', () => {
  it('replaying the journal gives the same states as recording answer by answer', () => {
    const { cards, log } = recordIncrementally();
    const rebuilt = rebuildCards(createScheduler(), log, USER);
    expect(rebuilt).toHaveLength(cards.size);
    for (const c of rebuilt) {
      const { userId, deckId, entryId, skill, lastLogId, ...state } = c;
      expect(userId).toBe(USER);
      expect(state).toEqual(cards.get(cardKey({ deckId, entryId, skill })));
      expect(lastLogId).toBe([...log].reverse().find((r) => cardKey(r) === cardKey(c))!.id);
    }
  });

  it('replaying reproduces every stored next due date, in any storage order', () => {
    const { log } = recordIncrementally();
    const shuffled = [...log].reverse();
    const seen: Date[] = [];
    // Rebuild prefix by prefix: after each answer the card's due equals the stored nextDue.
    for (const r of log) {
      const prefix = shuffled.filter((x) => x.at.getTime() <= r.at.getTime());
      const card = rebuildCards(createScheduler(), prefix, USER).find((c) => c.lastLogId === r.id)!;
      expect(card.due).toEqual(r.fsrs.nextDue);
      expect(card.state).toBe(r.fsrs.nextState);
      seen.push(card.due);
    }
    expect(seen.length).toBe(log.length);
  });

  it('is deterministic even with fuzz on (ts-fsrs seeds fuzz from the review)', () => {
    const fuzzy = () => fsrs({ enable_fuzz: true });
    const { log } = recordIncrementally(fuzzy());
    const a = rebuildCards(fuzzy(), log, USER);
    const b = rebuildCards(fuzzy(), log, USER);
    expect(a).toEqual(b);
    for (const c of a) expect(c.due).toEqual(log.find((r) => r.id === c.lastLogId)!.fsrs.nextDue);
  });

  it('ties at the same moment are ordered by id', () => {
    const s = createScheduler();
    const x = review('x2', 'a', 'speak', T0, Rating.Again);
    const y = review('x1', 'a', 'speak', T0, Rating.Good);
    const withFsrs = (r: Omit<ReviewRecord, 'fsrs'>): ReviewRecord => ({ ...r, fsrs: stepCard(s, null, r.final, r.at).fsrs });
    const one = rebuildCards(s, [withFsrs(x), withFsrs(y)], USER);
    const two = rebuildCards(s, [withFsrs(y), withFsrs(x)], USER);
    expect(one).toEqual(two);
    expect(one[0]!.lastLogId).toBe('x2');
  });

  it('ignores introductions and other users', () => {
    const { log } = recordIncrementally();
    const intro: IntroRecord = {
      id: 'i1',
      type: 'intro',
      skill: null,
      userId: USER,
      deviceId: 'dev-1',
      at: new Date(T0),
      deckId: 'd',
      entryId: 'a',
      deckRevision: 1,
      sessionId: 's',
    };
    const other: LogRecord = { ...log[0]!, id: 'o1', userId: 'user-2' };
    expect(rebuildCards(createScheduler(), [intro, other], USER)).toEqual([]);
  });
});

describe('drill records (R25)', () => {
  it('the rebuild with and without the practice after Again gives the same next due dates', () => {
    const { log } = recordIncrementally();
    const drills: DrillRecord[] = log
      .filter((r) => r.final === Rating.Again)
      .map((r, k) => ({
        id: `dr${k}`,
        type: 'drill',
        userId: USER,
        deviceId: 'dev-1',
        at: new Date(r.at.getTime() + 20_000),
        deckId: r.deckId,
        entryId: r.entryId,
        deckRevision: 1,
        sessionId: 's',
        skill: r.skill,
        reviewId: r.id,
        skipped: false,
        echo: null,
        copy: { typed: r.entryId, verdict: 'correct', errorType: null },
      }));
    expect(drills.length).toBeGreaterThan(0);
    const plain = rebuildCards(createScheduler(), log, USER);
    const withDrills = rebuildCards(createScheduler(), [...log, ...drills], USER);
    expect(withDrills).toEqual(plain);
    for (const c of withDrills) expect(c.due).toEqual(log.find((r) => r.id === c.lastLogId)!.fsrs.nextDue);
  });
});

describe('returns after Again do not change FSRS (R29.2)', () => {
  const s = createScheduler();
  const days = (c: { due: Date }, from: number) => Math.round((c.due.getTime() - from) / D);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const ret = (r: Omit<ReviewRecord, 'fsrs'>, requeue: number): Omit<ReviewRecord, 'fsrs'> => ({ ...r, requeue });
  /** Records answers the way the app does (answerCard), then rebuilds. */
  function play(answers: Omit<ReviewRecord, 'fsrs'>[]) {
    let card: CardState | null = null;
    const log: ReviewRecord[] = [];
    for (const a of answers) {
      const step = answerCard(s, card, a);
      card = step.card;
      log.push({ ...a, fsrs: step.fsrs });
    }
    return { card: card!, log, rebuilt: rebuildCards(s, log, USER)[0]! };
  }

  it('new card: Again, return Good → 1 day, S 0.21 (as after the first Again)', () => {
    const { card, log, rebuilt } = play([review('a1', 'a', 'speak', T0, Rating.Again), ret(review('a2', 'a', 'speak', T0 + 120_000, Rating.Good), 1)]);
    expect(days(card, T0)).toBe(1);
    expect(r2(card.stability)).toBe(0.21);
    expect(r2(card.difficulty)).toBe(6.41);
    expect(rebuilt.lastLogId).toBe('a1');
    expect(rebuilt.due).toEqual(card.due);
    // The return's snapshot shows the card unchanged.
    expect(log[1]!.fsrs.nextDue).toEqual(log[1]!.fsrs.dueBefore);
    expect(log[1]!.fsrs.nextState).toBe(log[1]!.fsrs.stateBefore);
  });

  it('new card: Again, return Again, second return Good → still 1 day, D not raised', () => {
    const { card } = play([
      review('b1', 'a', 'speak', T0, Rating.Again),
      ret(review('b2', 'a', 'speak', T0 + 120_000, Rating.Again), 1),
      ret(review('b3', 'a', 'speak', T0 + 240_000, Rating.Good), 2),
    ]);
    expect(days(card, T0)).toBe(1);
    expect(r2(card.difficulty)).toBe(6.41);
  });

  it('a card in review: Again on time, return Good → 2 days, S 1.54; then Good on time → 5 days', () => {
    const lapse = T0 + 13 * D;
    const { card } = play([
      review('c1', 'a', 'speak', T0, Rating.Good),
      review('c2', 'a', 'speak', T0 + 2 * D, Rating.Good),
      review('c3', 'a', 'speak', lapse, Rating.Again),
      ret(review('c4', 'a', 'speak', lapse + 120_000, Rating.Good), 1),
    ]);
    expect(days(card, lapse)).toBe(2);
    expect(r2(card.stability)).toBe(1.54);
    const next = answerCard(s, card, { final: Rating.Good, at: card.due }).card;
    expect(days(next, card.due.getTime())).toBe(5);
    expect(r2(next.stability)).toBe(4.88);
  });

  it('a return with no card yet (cannot happen in the app) counts as an ordinary first answer', () => {
    const step = answerCard(s, null, { final: Rating.Good, at: new Date(T0), requeue: 1 });
    expect(step.changed).toBe(true);
    expect(days(step.card, T0)).toBe(2);
  });

  it('the replay skips returns in records of any version (old ones have no `rules`)', () => {
    const old = [review('d1', 'a', 'speak', T0, Rating.Again), ret(review('d2', 'a', 'speak', T0 + 120_000, Rating.Good), 1)];
    const rebuilt = rebuildCards(s, old.map((r) => ({ ...r, fsrs: stepCard(s, null, r.final, r.at).fsrs })), USER)[0]!;
    expect(rebuilt.lastLogId).toBe('d1');
    expect(days(rebuilt, T0)).toBe(1);
  });
});

describe('zones in the replay (R29.3)', () => {
  const s = createScheduler();
  it('records without a zone count as Luxembourg; with one, its offset is used', () => {
    // 23:45Z → 00:05Z: 01:45 → 02:05 in Luxembourg (one app day), 04:45 → 05:05 in Dushanbe (one too),
    // 19:45 → 20:05 in New York; a record at 03:50Z in Dushanbe (08:50) after one at 22:30Z (03:30) is the next day.
    const a = review('z1', 'a', 'speak', Date.parse('2026-10-17T23:45:00Z'), Rating.Good);
    const b = review('z2', 'a', 'speak', Date.parse('2026-10-18T00:05:00Z'), Rating.Good);
    const legacy = rebuildCards(s, [a, b].map((r) => ({ ...r, fsrs: stepCard(s, null, r.final, r.at).fsrs })), USER)[0]!;
    expect(legacy.elapsedDays).toBe(0);
    expect(legacy.lastReviewOffsetMin).toBe(120);

    const c = { ...review('z3', 'b', 'speak', Date.parse('2026-10-17T22:30:00Z'), Rating.Good), tz: 'Asia/Dushanbe', tzOffsetMin: 300 };
    const d = { ...review('z4', 'b', 'speak', Date.parse('2026-10-18T03:50:00Z'), Rating.Good), tz: 'Asia/Dushanbe', tzOffsetMin: 300 };
    const dushanbe = rebuildCards(s, [c, d].map((r) => ({ ...r, fsrs: stepCard(s, null, r.final, r.at).fsrs })), USER)[0]!;
    expect(dushanbe.elapsedDays).toBe(1);
    expect(dushanbe.lastReviewOffsetMin).toBe(300);
    // The same two moments as Luxembourg records: 00:30 → 05:50, also the next day; as New York (-240): 18:30 → 23:50, the same day.
    const ny = rebuildCards(s, [c, d].map((r) => ({ ...r, tz: 'America/New_York', tzOffsetMin: -240, fsrs: stepCard(s, null, r.final, r.at).fsrs })), USER)[0]!;
    expect(ny.elapsedDays).toBe(0);
  });
});
