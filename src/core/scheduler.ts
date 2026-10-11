/**
 * ts-fsrs adapter. FSRS state lives per (entry × skill) pair. Scheduling itself
 * is never reimplemented; this module only maps between Sluh's record shape
 * (camelCase, `lastReview: null`) and the ts-fsrs `Card` (snake_case,
 * `last_review?: Date`), and turns one review into the new state plus a review
 * log snapshot. Ported from LivreVivant (src/lib/learning/fsrs.ts @ 503f4af);
 * storage (Dexie transaction) is stage 4.
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
}

/** Default scheduler. Fuzz off keeps due dates (and tests) deterministic. */
export function createScheduler(): FSRS {
  return fsrs({ enable_fuzz: false });
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

export function fromFsrsCard(c: FsrsCard): CardState {
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
}

/** Apply one review: the new card state and the log snapshot. Pure. */
export function applyReview(
  scheduler: FSRS,
  card: CardState,
  grade: Grade,
  now: Date,
  meta: ReviewMeta = {},
): { card: CardState; log: ReviewSnapshot } {
  const next = scheduler.next(toFsrsCard(card), now, grade);
  const log = next.log;
  return {
    card: fromFsrsCard(next.card),
    log: {
      rating: log.rating,
      state: log.state,
      reviewedAt: log.review,
      due: log.due,
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
