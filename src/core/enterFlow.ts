/**
 * What the Enter key does in a study step (Р26, replaces Р22 п. 5). Android's Gboard
 * delivers `keydown` Enter unreliably, so the field sits in a form and Enter is the
 * form's submit:
 *
 *   Enter in the field = "Check"; then the focus moves to "Next" (the keyboard goes
 *   down on a phone, the marks are in view);
 *   Enter on "Next"    = "Next", but not sooner than ENTER_NEXT_DELAY_MS after the
 *   result appeared, so a double press cannot skip the marks and the rating correction.
 *   A tap or a mouse click on "Next" works at once.
 *
 * `enterAction` stays for the field itself: tapped again after the check, it still
 * goes on with the same delay.
 */

/** The second Enter is ignored for this long after the result is shown. */
export const ENTER_NEXT_DELAY_MS = 700;

export type EnterAction = 'check' | 'next' | 'ignore';

export interface EnterState {
  /** The field holds something other than blanks. */
  hasText: boolean;
  /** A result is on screen. */
  checked: boolean;
  /** Milliseconds since the result appeared; null when none is shown. */
  sinceCheckedMs: number | null;
}

/** A press of "Next": from the keyboard, ignored until ENTER_NEXT_DELAY_MS after it became available. */
export function nextPress(p: { byKeyboard: boolean; sinceShownMs: number }): 'next' | 'ignore' {
  return p.byKeyboard && p.sinceShownMs < ENTER_NEXT_DELAY_MS ? 'ignore' : 'next';
}

export function enterAction(s: EnterState): EnterAction {
  if (!s.checked) return s.hasText ? 'check' : 'ignore';
  if (s.sinceCheckedMs === null || s.sinceCheckedMs < ENTER_NEXT_DELAY_MS) return 'ignore';
  return 'next';
}
