/**
 * Deleting the account on the device (stage 6a.5b, R42 items 1, 8): what an answer of the server
 * means. Before the request the device marks `meta.pendingDeletion`; the server ends every session
 * of the account in its first step, so a 401 after the mark means the erasure has begun — the
 * Cron finishes it (worker/account.ts). Pure.
 */

/** An API answer as the device sees it (a failure's status 0 — no network). */
export type Answer = { ok: true } | { ok: false; status: number };

/** deleted — the account is gone (or going); failed — nothing known, try again; update — this build is too old (426). */
export type DeleteOutcome = 'deleted' | 'failed' | 'update';

/** The answer to POST /api/account/delete, sent with the mark in place. */
export function deleteOutcome(answer: Answer): DeleteOutcome {
  if (answer.ok || answer.status === 401) return 'deleted';
  if (answer.status === 426) return 'update';
  return 'failed';
}

/**
 * At start with the mark (the answer was lost): GET /api/auth/me. 401 — deleted; 200 — the
 * request never reached the server (`notDone`, R42 item 8); no network or another error —
 * `unknown`, ask again next start.
 */
export type PendingOutcome = 'deleted' | 'notDone' | 'unknown';

export function pendingOutcome(answer: Answer): PendingOutcome {
  if (answer.ok) return 'notDone';
  return answer.status === 401 ? 'deleted' : 'unknown';
}
