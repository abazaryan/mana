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

    expect(card.state).toBe(State.Learning);
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
    expect(second.log.state).toBe(State.Learning);
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
