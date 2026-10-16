import { describe, expect, it } from 'vitest';
import { FRENCH } from './languages';
import type { FinalRating, ReviewRecord } from './model';
import { canChoose, canClaimMisrecognized, chooseRating, claimMisrecognized, previousOutcome, suggestSpeak, suggestWrite } from './review';
import { checkSpoken } from './spoken';

const prev = (final: FinalRating, latencyMs: number | null, wordCount = 2) =>
  ({ final, latencyMs, wordCount, expected: 'le nom' }) as ReviewRecord;

describe('correction (Р4)', () => {
  it('lowering is free', () => {
    expect(chooseRating(3, 1)).toEqual({ final: 1, correction: 'lowered' });
    expect(chooseRating(4, 2)).toEqual({ final: 2, correction: 'lowered' });
  });

  it('keeping the suggestion is no correction', () => {
    expect(chooseRating(2, 2)).toEqual({ final: 2, correction: null });
  });

  it('raising from Hard or Good is allowed and marked', () => {
    expect(chooseRating(2, 3)).toEqual({ final: 3, correction: 'raised' });
    expect(chooseRating(3, 4)).toEqual({ final: 4, correction: 'raised' });
  });

  it('raising from Again is not allowed with the buttons', () => {
    for (const g of [2, 3, 4] as const) {
      expect(canChoose(1, g)).toBe(false);
      expect(chooseRating(1, g)).toBeNull();
    }
  });

  it('"I was misrecognised": only after a voice answer rated Again → Good', () => {
    expect(claimMisrecognized(1, 'voice')).toEqual({ final: 3, correction: 'misrecognized' });
    expect(canClaimMisrecognized(1, 'typed')).toBe(false);
    expect(canClaimMisrecognized(1, 'skip')).toBe(false);
    expect(canClaimMisrecognized(2, 'voice')).toBe(false);
    expect(claimMisrecognized(1, 'typed')).toBeNull();
  });
});

describe('suggestSpeak', () => {
  const check = (heard: string) => checkSpoken('le nom', [heard], FRENCH.spoken);

  it('verdict → rating', () => {
    expect(suggestSpeak(check('le nom'), 4000, null)).toEqual({ rating: 3, reason: 'correct' });
    expect(suggestSpeak(check('nom'), 1000, null)).toEqual({ rating: 2, reason: 'almost' });
    expect(suggestSpeak(check('la table'), 1000, null)).toEqual({ rating: 1, reason: 'incorrect' });
  });

  it('"I don\'t know" is Again', () => {
    expect(suggestSpeak(null, null, null)).toEqual({ rating: 1, reason: 'incorrect' });
  });

  it('Easy needs a previous correct and fast answer, read from its final rating', () => {
    expect(suggestSpeak(check('le nom'), 1500, null).reason).toBe('correct-fast');
    expect(suggestSpeak(check('le nom'), 1500, prev(3, 1200))).toEqual({ rating: 4, reason: 'correct-fast-twice' });
    // Accepted with "I was misrecognised": final Good → counts as correct.
    expect(suggestSpeak(check('le nom'), 1500, prev(3, 2000)).rating).toBe(4);
    expect(suggestSpeak(check('le nom'), 1500, prev(2, 1200)).rating).toBe(3);
    expect(suggestSpeak(check('le nom'), 1500, prev(3, 4000)).rating).toBe(3);
    expect(suggestSpeak(check('le nom'), 1500, prev(3, null)).rating).toBe(3);
  });

  it('no Easy after retries or unrecognised attempts on this card', () => {
    expect(suggestSpeak(check('le nom'), 1500, prev(3, 1200), true)).toEqual({ rating: 3, reason: 'correct-retried' });
    expect(suggestSpeak(check('le nom'), 1500, null, true)).toEqual({ rating: 3, reason: 'correct-fast' });
    expect(suggestSpeak(check('nom'), 1500, prev(3, 1200), true)).toEqual({ rating: 2, reason: 'almost' });
  });

  it('Easy is possible for the reference repeated: latency to the first word, words of the reference', () => {
    const twice = checkSpoken('sept', ['sept sept'], FRENCH.spoken);
    expect(twice.words).toBe(1);
    expect(suggestSpeak(twice, 1500, { final: 3, latencyMs: 1200, wordCount: 1, expected: 'sept' } as ReviewRecord)).toEqual({
      rating: 4,
      reason: 'correct-fast-twice',
    });
  });

  it('previousOutcome', () => {
    expect(previousOutcome(null)).toBeNull();
    expect(previousOutcome(prev(4, 900, 5))).toEqual({ verdict: 'correct', latencyMs: 900, nWords: 5 });
    expect(previousOutcome(prev(1, 900))?.verdict).toBe('incorrect');
  });
});

describe('stage 4.3 (Р25)', () => {
  const check = (heard: string) => checkSpoken('le nom', [heard], FRENCH.spoken);

  it('`listen` is rated Good at most, with its own reason', () => {
    expect(suggestSpeak(check('le nom'), 1500, prev(3, 1200), false, 'listen')).toEqual({ rating: 3, reason: 'listen-no-easy' });
    expect(suggestSpeak(check('le nom'), 1500, null, false, 'listen')).toEqual({ rating: 3, reason: 'correct-fast' });
    expect(suggestSpeak(check('nom'), 1500, null, false, 'listen')).toEqual({ rating: 2, reason: 'almost' });
    // A raise by the user stays allowed (Р4).
    expect(chooseRating(3, 4)).toEqual({ final: 4, correction: 'raised' });
  });

  it('an answer that came back after Again is never "correct and fast" for the next Easy', () => {
    const returned = { ...prev(3, 1200), requeue: 1 } as ReviewRecord;
    expect(previousOutcome(returned)?.latencyMs).toBeNull();
    expect(suggestSpeak(check('le nom'), 1500, returned)).toEqual({ rating: 3, reason: 'correct-fast' });
    expect(suggestWrite('correct', 1500, 2, returned)).toEqual({ rating: 3, reason: 'correct-fast' });
    expect(suggestSpeak(check('le nom'), 1500, { ...prev(3, 1200), requeue: 0 } as ReviewRecord).rating).toBe(4);
  });

  it('`write`: verdict → rating, Easy by the latency to the first key; "I don\'t know" is Again', () => {
    expect(suggestWrite('correct', 4000, 2, null)).toEqual({ rating: 3, reason: 'correct' });
    expect(suggestWrite('almost', 1000, 2, null)).toEqual({ rating: 2, reason: 'almost' });
    expect(suggestWrite('incorrect', 1000, 2, null)).toEqual({ rating: 1, reason: 'incorrect' });
    expect(suggestWrite('correct', 1500, 2, prev(3, 1200))).toEqual({ rating: 4, reason: 'correct-fast-twice' });
    expect(suggestWrite(null, null, 2, prev(3, 1200))).toEqual({ rating: 1, reason: 'incorrect' });
  });
});
