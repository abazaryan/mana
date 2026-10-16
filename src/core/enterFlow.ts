/**
 * What the Enter key does in a text field of a study step (amendment of 16.10.2026).
 * Android's Gboard delivers `keydown` Enter unreliably, so the field sits in a form
 * and Enter is the form's submit; this pure function decides what that submit means:
 *
 *   first Enter  = "Check";
 *   second Enter = "Next", but not sooner than ENTER_NEXT_DELAY_MS after the result
 *   appeared, so a double press cannot skip the marks and the rating correction.
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

export function enterAction(s: EnterState): EnterAction {
  if (!s.checked) return s.hasText ? 'check' : 'ignore';
  if (s.sinceCheckedMs === null || s.sinceCheckedMs < ENTER_NEXT_DELAY_MS) return 'ignore';
  return 'next';
}
