import { describe, expect, it } from 'vitest';
import { ENTER_NEXT_DELAY_MS, enterAction, nextPress } from './enterFlow';

describe('Enter in a text field', () => {
  it('delay constant', () => expect(ENTER_NEXT_DELAY_MS).toBe(700));

  it('first Enter checks; an empty field is ignored', () => {
    expect(enterAction({ hasText: true, checked: false, sinceCheckedMs: null })).toBe('check');
    expect(enterAction({ hasText: false, checked: false, sinceCheckedMs: null })).toBe('ignore');
  });

  it('second Enter goes next only after the delay', () => {
    const at = (ms: number | null) => enterAction({ hasText: true, checked: true, sinceCheckedMs: ms });
    expect(at(0)).toBe('ignore');
    expect(at(150)).toBe('ignore');
    expect(at(ENTER_NEXT_DELAY_MS - 1)).toBe('ignore');
    expect(at(ENTER_NEXT_DELAY_MS)).toBe('next');
    expect(at(5000)).toBe('next');
  });

  it('a result without a known time is never skipped', () => {
    expect(enterAction({ hasText: true, checked: true, sinceCheckedMs: null })).toBe('ignore');
  });

  it('after the check the text no longer matters', () => {
    expect(enterAction({ hasText: false, checked: true, sinceCheckedMs: 2000 })).toBe('next');
  });

  it('the whole order: check → (too early) → next', () => {
    const steps = [
      { hasText: true, checked: false, sinceCheckedMs: null },
      { hasText: true, checked: true, sinceCheckedMs: 120 },
      { hasText: true, checked: true, sinceCheckedMs: 900 },
    ].map(enterAction);
    expect(steps).toEqual(['check', 'ignore', 'next']);
  });
});

describe('"Next" after the check (Р26)', () => {
  it('Enter on the focused button goes next only after the delay', () => {
    expect(nextPress({ byKeyboard: true, sinceShownMs: 0 })).toBe('ignore');
    expect(nextPress({ byKeyboard: true, sinceShownMs: 699 })).toBe('ignore');
    expect(nextPress({ byKeyboard: true, sinceShownMs: 700 })).toBe('next');
  });

  it('a tap or a mouse click goes next at once', () => {
    expect(nextPress({ byKeyboard: false, sinceShownMs: 0 })).toBe('next');
  });
});
