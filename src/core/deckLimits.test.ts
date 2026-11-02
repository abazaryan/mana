import { describe, expect, it } from 'vitest';
import { deckNewLimit, spreadNewPerDay, withDeckLimit } from './deckLimits';
import { defaultSettings, type SettingsRow } from './model';

const T = new Date('2026-11-02T10:00:00Z');
const LATER = new Date('2026-11-03T10:00:00Z');
/** Settings of a device from before R47: the shared limit, no deck limits. */
const before = (newPerDay: number, newPerDeck?: Record<string, number>): SettingsRow => ({ userId: 'u', uiLang: 'tg', meaningLang: 'tg', newPerDay, newPerDeck, updatedAt: T });

describe('deck limits (R47)', () => {
  it('a deck without its own value gets 5', () => {
    expect(deckNewLimit({}, 'a')).toBe(5);
    expect(deckNewLimit({ newPerDeck: { b: 10 } }, 'a')).toBe(5);
    expect(deckNewLimit({ newPerDeck: { a: 15 } }, 'a')).toBe(15);
  });

  it('setting one deck leaves the others as they were', () => {
    const s = withDeckLimit(before(5, { a: 10 }), 'b', 20, LATER);
    expect(s.newPerDeck).toEqual({ a: 10, b: 20 });
    expect(s.updatedAt).toEqual(LATER);
  });

  it('the shared value goes to every installed deck once; a value already there stays', () => {
    const s = spreadNewPerDay(before(10, { b: 15 }), ['a', 'b', 'c'], LATER)!;
    expect(s.newPerDeck).toEqual({ a: 10, b: 15, c: 10 });
    expect(s.newPerDeckFrom).toEqual(LATER);
    expect(spreadNewPerDay(s, ['a', 'b', 'c', 'd'], LATER)).toBeNull();
    // A deck installed after the spread: the default, not the old shared value.
    expect(deckNewLimit(s, 'd')).toBe(5);
  });

  it('values of decks not installed here (from another device) are kept', () => {
    expect(spreadNewPerDay(before(10, { x: 20 }), ['a'], LATER)!.newPerDeck).toEqual({ x: 20, a: 10 });
  });

  it('a new installation has nothing to spread', () => {
    const s = defaultSettings('u', 'ru', T);
    expect(spreadNewPerDay(s, ['a'], LATER)).toBeNull();
    expect(deckNewLimit(s, 'a')).toBe(5);
  });
});
