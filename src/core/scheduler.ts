/**
 * ts-fsrs adapter. FSRS state lives per (entry × skill) pair. Scheduling itself
 * is never reimplemented; this module only maps between Mana's record shape
 * (camelCase, `lastReview: null`) and the ts-fsrs `Card` (snake_case,
 * `last_review?: Date`), and turns one review into the new state plus a review
 * log snapshot. Ported from LivreVivant (src/lib/learning/fsrs.ts @ 503f4af);
 * storage (Dexie transaction) is stage 4.
 *
 * Stage 4.4a (Р29): no steps in minutes — every answer sets a due date in days — and
 * ts-fsrs counts app days (local, from 04:00, in the zone of each answer) instead of
 * UTC dates. The time shift that does it lives here and nowhere else; stored dates
 * are real moments.
 */
import {
  createEmptyCard,
  fsrs,
  type Card as FsrsCard,
  type FSRS,
  type Grade,
  type Rating,
  type State,
} from 'ts-fsrs';
import { believableLatency } from './latency';
import { fsrsShiftMs, LEGACY_ZONE, offsetAt } from './zone';

export type Skill = 'listen' | 'speak' | 'write';

/** FSRS state of one (entry × skill) pair, as stored. */
export interface CardState {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  /** Required by ts-fsrs v5: without it the short-step position is lost. */
  learningSteps: number;
  state: State;
  lastReview: Date | null;
  /** Zone offset (minutes east of UTC) of the last answer: its app day (Р29.3). Null before the first one. */
  lastReviewOffsetMin: number | null;
}

/**
 * Version of the scheduling rules written into every answer (Р29.4). A replay applies
 * the rules of each record's version; records without one get the current rules.
 * 2 = stage 4.4a: no steps in minutes, app days by the zone of the answer.
 */
export const RULES_VERSION = 2;

/**
 * Default scheduler (Р29.1): no learning or relearning steps, short-term stability on
 * (an answer on the same app day), target retention 0.9 and FSRS-6 parameters by
 * default. Fuzz off keeps due dates (and tests) deterministic.
 */
export function createScheduler(): FSRS {
  return fsrs({ enable_fuzz: false, learning_steps: [], relearning_steps: [], enable_short_term: true });
}

export function newCardState(now: Date): CardState {
  return fromFsrsCard(createEmptyCard(now));
}

export function toFsrsCard(s: CardState): FsrsCard {
  return {
    due: s.due,
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    reps: s.reps,
    lapses: s.lapses,
    learning_steps: s.learningSteps,
    state: s.state,
    last_review: s.lastReview ?? undefined,
  };
}

export function fromFsrsCard(c: FsrsCard, lastReviewOffsetMin: number | null = null): CardState {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    learningSteps: c.learning_steps,
    state: c.state,
    lastReview: c.last_review ?? null,
    lastReviewOffsetMin,
  };
}

/**
 * The FSRS part of a review-log record: a full copy of the ts-fsrs ReviewLog
 * with the card state *before* the review, so a review can be undone. Stage 4
 * adds id, userId, the suggested and final rating and the reason (Р4, Р10).
 */
export interface ReviewSnapshot {
  /** 1 = Again, 2 = Hard, 3 = Good, 4 = Easy. */
  rating: Rating;
  /** State before the review. */
  state: State;
  reviewedAt: Date;
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  lastElapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  /** Latency in ms; null when unknown or over the 120 s ceiling. */
  responseTimeMs: number | null;
  /** Error type from the answer check, or null. */
  errorType: string | null;
}

export interface ReviewMeta {
  responseTimeMs?: number | null;
  errorType?: string | null;
  /** Zone offset of this answer (minutes east of UTC); default: Luxembourg at `now` (Р29.3). */
  offsetMin?: number;
}

const shift = (d: Date, ms: number) => new Date(d.getTime() + ms);

/**
 * Apply one review: the new card state and the log snapshot. Pure.
 *
 * ts-fsrs counts days between UTC dates. Each moment it sees is moved by
 * (its zone offset − 04:00) — the last answer by its own offset, this one by its
 * own — so its UTC date is the app day of the answer; the result is moved back.
 * Elapsed days are then app days, and the due date is the real moment of this
 * answer + the interval.
 */
export function applyReview(
  scheduler: FSRS,
  card: CardState,
  grade: Grade,
  now: Date,
  meta: ReviewMeta = {},
): { card: CardState; log: ReviewSnapshot } {
  const offNow = meta.offsetMin ?? offsetAt(LEGACY_ZONE, now);
  const offLast = card.lastReviewOffsetMin ?? (card.lastReview ? offsetAt(LEGACY_ZONE, card.lastReview) : offNow);
  const sNow = fsrsShiftMs(offNow);
  const fc = toFsrsCard(card);
  const input: FsrsCard = {
    ...fc,
    due: shift(fc.due, sNow),
    last_review: fc.last_review ? shift(fc.last_review, fsrsShiftMs(offLast)) : undefined,
  };
  const next = scheduler.next(input, shift(now, sNow), grade);
  const out: FsrsCard = {
    ...next.card,
    due: shift(next.card.due, -sNow),
    last_review: next.card.last_review ? shift(next.card.last_review, -sNow) : undefined,
  };
  const log = next.log;
  return {
    card: fromFsrsCard(out, offNow),
    log: {
      rating: log.rating,
      state: log.state,
      reviewedAt: now,
      due: card.lastReview ?? card.due,
      stability: log.stability,
      difficulty: log.difficulty,
      elapsedDays: log.elapsed_days,
      lastElapsedDays: log.last_elapsed_days,
      scheduledDays: log.scheduled_days,
      learningSteps: log.learning_steps,
      responseTimeMs: believableLatency(meta.responseTimeMs),
      errorType: meta.errorType ?? null,
    },
  };
}
