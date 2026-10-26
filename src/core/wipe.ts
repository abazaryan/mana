/**
 * Clearing the data on this device (stage 6a.5b, R42 item 7): what goes and in which order. Pure;
 * the browser side is src/platform/wipe.ts.
 *
 * Order: (1) signed in — send the queue; what is not sent is shown, with the file offered;
 * (2) signed in — sign out (no network — refused: the session must end first); (3) the mark
 * `mana.wipePending` and a signal to the other windows; (4) the databases; (5) the keys of the
 * browser's storage; (6) the mark goes, the page opens afresh. A page closed between 3 and 6 is
 * finished at the next start, before the database is opened.
 */

/** The app's IndexedDB databases: the data (`mana`, db.ts) and the old recognizer lab (legacyCleanup.ts). */
export const WIPE_DATABASES = ['mana', 'mana-lab'] as const;

/** localStorage / sessionStorage keys of the app: its own, and the prototype's of stage 1 (`sluh.settings`, `sluh.log`). */
export const WIPE_KEY_PREFIXES = ['mana.', 'sluh.'] as const;

/** Set before anything is deleted, removed last. */
export const WIPE_PENDING_KEY = 'mana.wipePending';

/** The channel the other windows hear the wipe on; messages: WipeSignal. */
export const WIPE_CHANNEL = 'mana-wipe';
export type WipeSignal = 'start' | 'done';

/** The keys to remove, the pending mark last (so a page closed midway finishes at the next start). */
export function keysToWipe(keys: readonly string[]): string[] {
  const ours = keys.filter((k) => WIPE_KEY_PREFIXES.some((p) => k.startsWith(p)));
  return [...ours.filter((k) => k !== WIPE_PENDING_KEY), ...ours.filter((k) => k === WIPE_PENDING_KEY)];
}

/** Sign-out before a wipe: 200 or 401 (no session any more) — go on; no network or a server error — refuse. */
export function signOutAllowsWipe(answer: { ok: true } | { ok: false; status: number }): boolean {
  return answer.ok || answer.status === 401;
}
