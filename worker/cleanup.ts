/**
 * Hourly cleanup (Cron Trigger in wrangler.jsonc, R37 item 5): IP rows of the counters whose
 * window is over — so none lives longer than about 1 h 10 min (the notice promises a day at
 * most); expired sessions, codes and invitations (an invitation carries a person's label) — a used
 * code or invitation not before RETRY_WINDOW after its use (the retry of a lost answer, auth.ts).
 * Then erasures of accounts left unfinished (R42 items 2–3), within the queries left of the
 * invocation (cronBudget: this batch is one).
 */
import { cronBudget, finishErasures, type EraseBudget } from './account.ts';
import { eraseOldIpRows } from './attempts.ts';
import { RETRY_WINDOW } from './config.ts';

export async function cleanup(db: D1Database, now: number, budget: EraseBudget = cronBudget()): Promise<void> {
  await db.batch([
    eraseOldIpRows(db, now),
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM pairing_codes WHERE expires_at <= ?1 AND (used_at IS NULL OR used_at < ?2)').bind(now, now - RETRY_WINDOW),
    db.prepare('DELETE FROM invites WHERE expires_at <= ?1 AND (used_at IS NULL OR used_at < ?2)').bind(now, now - RETRY_WINDOW),
  ]);
  await finishErasures(db, budget);
}
