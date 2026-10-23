import { Rating, State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { MAX_RESPONSE_TIME_MS } from './latency';
import { ratingForVerdict } from './rating';
import {
  applyReview,
  createScheduler,
  fromFsrsCard,
  newCardState,
  toFsrsCard,
  type CardState,
} from './scheduler';

const now = new Date('2026-10-11T09:00:00Z');

describe('card mapping', () => {
  it('round-trips a card, with lastReview null ↔ last_review undefined', () => {
    const fresh = newCardState(now);
    expect(fresh.state).toBe(State.New);
    expect(fresh.lastReview).toBeNull();
    expect(toFsrsCard(fresh).last_review).toBeUndefined();
    expect(fromFsrsCard(toFsrsCard(fresh))).toEqual(fresh);

    const reviewed: CardState = { ...fresh, lastReview: now, learningSteps: 1, reps: 1 };
    expect(toFsrsCard(reviewed).last_review).toBe(now);
    expect(toFsrsCard(reviewed).learning_steps).toBe(1);
    expect(fromFsrsCard(toFsrsCard(reviewed))).toEqual(reviewed);
  });
});

describe('applyReview', () => {
  const scheduler = createScheduler();

  it('advances a new card and snapshots the state before the review', () => {
    const before = newCardState(now);
    const { card, log } = applyReview(scheduler, before, Rating.Good, now, {
      responseTimeMs: 1800,
      errorType: null,
    });

    // R29.1: no steps in minutes — the first answer already sets days.
    expect(card.state).toBe(State.Review);
    expect(card.scheduledDays).toBe(2);
    expect(card.reps).toBe(1);
    expect(card.lastReview?.getTime()).toBe(now.getTime());
    expect(card.due.getTime()).toBeGreaterThan(now.getTime());

    expect(log.rating).toBe(Rating.Good);
    expect(log.state).toBe(State.New);
    expect(log.reviewedAt.getTime()).toBe(now.getTime());
    expect(log.responseTimeMs).toBe(1800);
    expect(log.errorType).toBeNull();
    expect(log.scheduledDays).toBe(0);
    expect(log.difficulty).toBe(0);
  });

  it('does not mutate the input card', () => {
    const before = newCardState(now);
    const copy = { ...before };
    applyReview(scheduler, before, Rating.Good, now);
    expect(before).toEqual(copy);
  });

  it('records the error type of an almost-right answer', () => {
    const { log } = applyReview(scheduler, newCardState(now), ratingForVerdict('almost'), now, {
      responseTimeMs: 3200,
      errorType: 'diacritic',
    });
    expect(log.rating).toBe(Rating.Hard);
    expect(log.errorType).toBe('diacritic');
  });

  it('keeps two consecutive reviews consistent', () => {
    const first = applyReview(scheduler, newCardState(now), Rating.Good, now);
    const later = new Date(now.getTime() + 60_000);
    const second = applyReview(scheduler, first.card, Rating.Again, later);
    expect(second.card.reps).toBe(2);
    expect(second.log.state).toBe(State.Review);
    expect(second.log.reviewedAt).toBe(later);
  });

  it('is deterministic (fuzz off)', () => {
    const a = applyReview(scheduler, newCardState(now), Rating.Easy, now);
    const b = applyReview(createScheduler(), newCardState(now), Rating.Easy, now);
    expect(a.card.due.getTime()).toBe(b.card.due.getTime());
    expect(a.card.state).toBe(State.Review);
  });

  it('applies the 120 s latency ceiling', () => {
    const at = (ms: number | undefined) =>
      applyReview(scheduler, newCardState(now), Rating.Good, now, { responseTimeMs: ms }).log
        .responseTimeMs;
    expect(at(119_000)).toBe(119_000);
    expect(at(MAX_RESPONSE_TIME_MS)).toBe(MAX_RESPONSE_TIME_MS);
    expect(at(MAX_RESPONSE_TIME_MS + 1)).toBeNull();
    expect(at(undefined)).toBeNull();
  });

  it('still counts an interrupted review; only the latency is dropped', () => {
    const { log } = applyReview(scheduler, newCardState(now), Rating.Good, now, {
      responseTimeMs: MAX_RESPONSE_TIME_MS + 1,
    });
    expect(log.rating).toBe(Rating.Good);
  });
});

/** Figures of the 4.4a plan (R29.1, R29.3): answers at 10:00 in Luxembourg unless said otherwise. */
describe('stage 4.4a rules', () => {
  const s = createScheduler();
  const LUX_SUMMER = 120;
  const t = (iso: string) => new Date(iso);
  const days = (c: CardState, from: Date) => Math.round((c.due.getTime() - from.getTime()) / 86_400_000);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const answer = (c: CardState, g: Rating, at: Date, offsetMin = LUX_SUMMER) =>
    applyReview(s, c, g as never, at, { offsetMin }).card;

  it('no learning or relearning steps; short-term stability on', () => {
    expect(s.parameters.learning_steps).toEqual([]);
    expect(s.parameters.relearning_steps).toEqual([]);
    expect(s.parameters.enable_short_term).toBe(true);
    expect(s.parameters.request_retention).toBe(0.9);
    expect(s.parameters.enable_fuzz).toBe(false);
  });

  it('a new card: Again 1 day, Hard 1 day, Good 2 days, Easy 8 days, all in review', () => {
    const at = t('2026-10-18T08:00:00Z');
    const got = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((g) => answer(newCardState(at), g, at));
    expect(got.map((c) => days(c, at))).toEqual([1, 1, 2, 8]);
    expect(got.map((c) => c.state)).toEqual([State.Review, State.Review, State.Review, State.Review]);
    expect(got.map((c) => r2(c.stability))).toEqual([0.21, 1.29, 2.31, 8.3]);
    expect(got.map((c) => r2(c.difficulty))).toEqual([6.41, 5.11, 2.12, 1]);
  });

  it('the card keeps the zone offset of its last answer', () => {
    const at = t('2026-10-20T03:00:00Z');
    expect(answer(newCardState(at), Rating.Good, at, 300).lastReviewOffsetMin).toBe(300);
  });

  it('01:45 → 02:05 local is the same app day (UTC would say the next): short-term stability', () => {
    const a = t('2026-10-17T23:45:00Z');
    const b = t('2026-10-18T00:05:00Z');
    const second = answer(answer(newCardState(a), Rating.Good, a), Rating.Good, b);
    expect(second.elapsedDays).toBe(0);
    expect(r2(second.stability)).toBe(2.31);
    // The same pair of answers by day (10:45 → 11:05) gives the same result.
    const c = t('2026-10-18T08:45:00Z');
    const d = t('2026-10-18T09:05:00Z');
    const day = answer(answer(newCardState(c), Rating.Good, c), Rating.Good, d);
    expect(days(second, b)).toBe(days(day, d));
  });

  it('03:50 → 04:05 local is the next app day', () => {
    const a = t('2026-10-18T01:50:00Z');
    const b = t('2026-10-18T02:05:00Z');
    expect(answer(answer(newCardState(a), Rating.Good, a), Rating.Good, b).elapsedDays).toBe(1);
  });

  it('each answer counts with its own zone: Luxembourg 23:00 → Dushanbe 06:00 is one day', () => {
    const a = t('2026-10-26T22:00:00Z');
    const b = t('2026-10-27T01:00:00Z');
    const first = answer(newCardState(a), Rating.Good, a, 60);
    expect(answer(first, Rating.Good, b, 300).elapsedDays).toBe(1);
    expect(answer(first, Rating.Good, b, 60).elapsedDays).toBe(0);
  });

  it('due date = the real moment of the answer + the interval', () => {
    const at = t('2026-10-18T08:00:00Z');
    expect(answer(newCardState(at), Rating.Good, at, 300).due.toISOString()).toBe('2026-10-20T08:00:00.000Z');
  });
});
