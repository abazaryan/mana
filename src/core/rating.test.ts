import { Rating } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import {
  countWords,
  fastLimitMs,
  isFast,
  ratingForVerdict,
  suggestRating,
  type AnswerOutcome,
} from './rating';

const answer = (verdict: AnswerOutcome['verdict'], latencyMs: number | null, nWords = 2) => ({
  verdict,
  latencyMs,
  nWords,
});

describe('ratingForVerdict', () => {
  it('maps correctness to Good / Hard / Again, never Easy', () => {
    expect(ratingForVerdict('correct')).toBe(Rating.Good);
    expect(ratingForVerdict('almost')).toBe(Rating.Hard);
    expect(ratingForVerdict('incorrect')).toBe(Rating.Again);
  });
});

describe('fast', () => {
  it('is 2.5 s up to four words, plus 0.3 s per extra word', () => {
    expect(fastLimitMs(1)).toBe(2500);
    expect(fastLimitMs(4)).toBe(2500);
    expect(fastLimitMs(5)).toBe(2800);
    expect(fastLimitMs(8)).toBe(3700);
  });

  it('includes the limit itself; unknown latency is not fast', () => {
    expect(isFast(2500, 3)).toBe(true);
    expect(isFast(2501, 3)).toBe(false);
    expect(isFast(2800, 5)).toBe(true);
    expect(isFast(null, 1)).toBe(false);
  });

  it('counts words, splitting elisions', () => {
    expect(countWords('la pluie')).toBe(2);
    expect(countWords("J'ai froid.")).toBe(3);
    expect(countWords('  ')).toBe(0);
  });
});

describe('suggestRating', () => {
  const fast = answer('correct', 1800);
  const slow = answer('correct', 4000);

  it('follows correctness when the answer is not correct', () => {
    expect(suggestRating(answer('incorrect', 900), fast)).toEqual({
      rating: Rating.Again,
      reason: 'incorrect',
    });
    expect(suggestRating(answer('almost', 900), fast)).toEqual({
      rating: Rating.Hard,
      reason: 'almost',
    });
  });

  it('gives Good for a correct but slow answer', () => {
    expect(suggestRating(slow, fast)).toEqual({ rating: Rating.Good, reason: 'correct' });
  });

  it('gives Easy only when this and the previous answer were correct and fast', () => {
    expect(suggestRating(fast, fast)).toEqual({ rating: Rating.Easy, reason: 'correct-fast-twice' });
  });

  it('gives Good for the first fast answer on a pair', () => {
    expect(suggestRating(fast, null)).toEqual({ rating: Rating.Good, reason: 'correct-fast' });
  });

  it('gives Good when the previous answer was slow, unknown or not correct', () => {
    expect(suggestRating(fast, slow).rating).toBe(Rating.Good);
    expect(suggestRating(fast, answer('correct', null)).rating).toBe(Rating.Good);
    expect(suggestRating(fast, answer('almost', 1000)).rating).toBe(Rating.Good);
  });

  it('judges the previous answer by its own length', () => {
    // 2.7 s is slow for 2 words but fast for 5.
    expect(suggestRating(fast, answer('correct', 2700, 5)).rating).toBe(Rating.Easy);
    expect(suggestRating(fast, answer('correct', 2700, 2)).rating).toBe(Rating.Good);
  });
});
