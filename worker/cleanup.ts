/**
 * Hourly cleanup (Cron Trigger in wrangler.jsonc, R37 item 5): IP rows of the counters whose
 * window is over — so none lives longer than about 1 h 10 min (the notice promises a day at
 * most); expired sessions, codes and invitations (an invitation carries a person's label).
 */
import { eraseOldIpRows } from './attempts.ts';

export async function cleanup(db: D1Database, now: number): Promise<void> {
  await db.batch([
    eraseOldIpRows(db, now),
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM pairing_codes WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM invites WHERE expires_at <= ?').bind(now),
  ]);
}
