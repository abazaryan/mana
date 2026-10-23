/**
 * Rating a `speak` answer and the user's correction of it (R4, R22.6). Pure.
 */
import { Rating } from 'ts-fsrs';
import { suggestRating, type AnswerOutcome, type RatingSuggestion } from './rating';
import type { AnswerMode, Correction, FinalRating, ReviewRecord } from './model';
import type { Verdict } from './evaluate';
import type { SpokenCheck } from './spoken';

/**
 * The previous answer on the same (entry × skill) pair as the Easy rule sees it.
 * "Correct" is read from the final rating, after the user's correction (R4):
 * an answer accepted with "I was misrecognised" counts as correct.
 */
export function previousOutcome(prev: ReviewRecord | null): AnswerOutcome | null {
  if (!prev) return null;
  return {
    verdict: prev.final >= 3 ? 'correct' : 'incorrect',
    // A return after Again (R25) came minutes after the reference was shown: never "fast".
    latencyMs: (prev.requeue ?? 0) > 0 ? null : prev.latencyMs,
    nWords: prev.wordCount ?? prev.expected.split(/\s+/).filter(Boolean).length,
  };
}

/**
 * Suggested rating of a checked answer; "I don't know" is always Again.
 * `troubled`: on this card the answer came only after retries or attempts with
 * nothing recognised — then Easy is not offered (Good instead).
 */
export function suggestSpeak(
  check: SpokenCheck | null,
  latencyMs: number | null,
  previous: ReviewRecord | null,
  troubled = false,
  skill: 'speak' | 'listen' = 'speak',
): RatingSuggestion {
  if (!check) return suggestRating({ verdict: 'incorrect', latencyMs: null, nWords: 0 }, null);
  const s = suggestRating({ verdict: check.verdict, latencyMs, nWords: check.words }, previousOutcome(previous));
  if (troubled && s.rating === Rating.Easy) return { rating: Rating.Good, reason: 'correct-retried' };
  // R25: `listen` is not rated Easy automatically (a raise by the user is allowed, R4).
  if (skill === 'listen' && s.rating === Rating.Easy) return { rating: Rating.Good, reason: 'listen-no-easy' };
  return s;
}

/**
 * Suggested rating of a `write` answer (R4, R21, R24): the written verdict, the
 * latency to the first key; null check = "I don't know" (Again).
 */
export function suggestWrite(
  verdict: Verdict | null,
  latencyMs: number | null,
  nWords: number,
  previous: ReviewRecord | null,
): RatingSuggestion {
  if (!verdict) return suggestRating({ verdict: 'incorrect', latencyMs: null, nWords: 0 }, null);
  return suggestRating({ verdict, latencyMs, nWords }, previousOutcome(previous));
}

export interface RatingChoice {
  final: FinalRating;
  correction: Correction | null;
}

/**
 * Whether the user may pick `chosen` over `suggested` with the four buttons (R4):
 * lowering is free; raising is allowed except from Again (that takes the
 * "I was misrecognised" button).
 */
export function canChoose(suggested: FinalRating, chosen: FinalRating): boolean {
  return chosen <= suggested || suggested !== 1;
}

/** The final rating for a button press; null if the press is not allowed. */
export function chooseRating(suggested: FinalRating, chosen: FinalRating): RatingChoice | null {
  if (!canChoose(suggested, chosen)) return null;
  if (chosen === suggested) return { final: chosen, correction: null };
  return { final: chosen, correction: chosen < suggested ? 'lowered' : 'raised' };
}

/**
 * "I was misrecognised" (R4): only after a voice answer rated Again; accepted as
 * Good and marked in the journal. A typed answer or "I don't know" had no
 * recognition to blame (R22.6).
 */
export function canClaimMisrecognized(suggested: FinalRating, mode: AnswerMode): boolean {
  return suggested === 1 && mode === 'voice';
}

export function claimMisrecognized(suggested: FinalRating, mode: AnswerMode): RatingChoice | null {
  return canClaimMisrecognized(suggested, mode) ? { final: 3, correction: 'misrecognized' } : null;
}
