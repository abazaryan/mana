/**
 * Verdict → FSRS rating (decision Р4).
 *
 * Correctness decides: incorrect → Again, almost → Hard, correct → Good.
 * Easy: correct and fast, provided the previous answer on the same
 * (entry × skill) pair was also correct and fast. Fast = no longer than
 * 2.5 s + 0.3 s per word beyond four. Initial thresholds, calibrated by the log.
 *
 * Ported from LivreVivant (`ratingForVerdict`, src/lib/learning/fsrs.ts @ 503f4af);
 * the Easy rule is Sluh's own — LivreVivant never awards Easy.
 */
import { Rating, type Grade } from 'ts-fsrs';
import type { Verdict } from './evaluate';

/** Base "fast" limit for an answer of up to FAST_BASE_WORDS words. */
export const FAST_BASE_MS = 2500;
/** Added to the limit for every word beyond FAST_BASE_WORDS. */
export const FAST_MS_PER_EXTRA_WORD = 300;
export const FAST_BASE_WORDS = 4;

/** Correctness-only mapping: Easy is never returned here. */
export function ratingForVerdict(verdict: Verdict): Grade {
  switch (verdict) {
    case 'correct':
      return Rating.Good;
    case 'almost':
      return Rating.Hard;
    case 'incorrect':
      return Rating.Again;
  }
}

/** Words in a reference answer; an apostrophe splits elisions (j'ai → 2). */
export function countWords(text: string): number {
  return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean).length;
}

/** The "fast" limit for an answer of `nWords` words, in ms. */
export function fastLimitMs(nWords: number): number {
  return FAST_BASE_MS + Math.max(0, nWords - FAST_BASE_WORDS) * FAST_MS_PER_EXTRA_WORD;
}

/** Unknown latency (null) is never fast. */
export function isFast(latencyMs: number | null, nWords: number): boolean {
  return latencyMs !== null && latencyMs <= fastLimitMs(nWords);
}

/** One answer as the rating rule sees it. */
export interface AnswerOutcome {
  verdict: Verdict;
  /** Time to the start of the answer; null when unknown (see believableLatency). */
  latencyMs: number | null;
  /** Words in the reference answer. */
  nWords: number;
}

export function isCorrectAndFast(a: AnswerOutcome): boolean {
  return a.verdict === 'correct' && isFast(a.latencyMs, a.nWords);
}

/** Why the rating was suggested; the UI translates it (Р8). */
export type RatingReason = 'incorrect' | 'almost' | 'correct' | 'correct-fast' | 'correct-fast-twice';

export interface RatingSuggestion {
  rating: Grade;
  reason: RatingReason;
}

/**
 * Suggested rating for `current`. `previous` is the previous answer on the same
 * (entry × skill) pair, or null if there is none.
 */
export function suggestRating(
  current: AnswerOutcome,
  previous: AnswerOutcome | null,
): RatingSuggestion {
  if (current.verdict !== 'correct') {
    return { rating: ratingForVerdict(current.verdict), reason: current.verdict };
  }
  if (!isCorrectAndFast(current)) return { rating: Rating.Good, reason: 'correct' };
  if (previous !== null && isCorrectAndFast(previous)) {
    return { rating: Rating.Easy, reason: 'correct-fast-twice' };
  }
  return { rating: Rating.Good, reason: 'correct-fast' };
}
