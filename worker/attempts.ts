/**
 * Counters of failed code attempts in D1 (STAGE6_RESEARCH 7.3, R37): per IP hash and all
 * together. Rows with an IP hash live as long as their window and are erased by the hourly
 * cleanup (cleanup.ts) and here, at every failure — the notice promises "within a day at most".
 * Invitations have no counter: a 256-bit token cannot be guessed, and the notice promises the
 * IP hash only for failed code attempts.
 */
import { GLOBAL_LOCK, GLOBAL_MAX_FAILURES, GLOBAL_WINDOW, IP_MAX_FAILURES, IP_WINDOW } from './config.ts';
import { ipKey, pepperedHex } from './tokens.ts';

export const GLOBAL_BUCKET = 'pair:global';
const IP_PREFIX = 'pair:ip:';

/** The bucket of the request's address: HMAC with the pepper, cut to 128 bits. */
export async function ipBucket(pepper: string, headers: Headers): Promise<string> {
  return IP_PREFIX + (await pepperedHex(pepper, `ip:${ipKey(headers.get('CF-Connecting-IP'))}`)).slice(0, 32);
}

/** Milliseconds until codes may be tried again from this address, or 0. */
export async function waitBeforeAttempt(db: D1Database, bucket: string, now: number): Promise<number> {
  const { results } = await db
    .prepare('SELECT bucket, window_start, count, locked_until FROM auth_attempts WHERE bucket IN (?, ?)')
    .bind(GLOBAL_BUCKET, bucket)
    .all<{ bucket: string; window_start: number; count: number; locked_until: number | null }>();
  let wait = 0;
  for (const row of results) {
    if (row.bucket === GLOBAL_BUCKET) {
      if (row.locked_until !== null && row.locked_until > now) wait = Math.max(wait, row.locked_until - now);
    } else if (row.window_start > now - IP_WINDOW && row.count >= IP_MAX_FAILURES) {
      wait = Math.max(wait, row.window_start + IP_WINDOW - now);
    }
  }
  return wait;
}

function count(db: D1Database, bucket: string, window: number, now: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO auth_attempts (bucket, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT (bucket) DO UPDATE SET
         count = CASE WHEN auth_attempts.window_start > ?3 THEN auth_attempts.count + 1 ELSE 1 END,
         window_start = CASE WHEN auth_attempts.window_start > ?3 THEN auth_attempts.window_start ELSE ?2 END`,
    )
    .bind(bucket, now, now - window);
}

/** IP rows whose window is over; they are useless and must not outlive a day. */
export function eraseOldIpRows(db: D1Database, now: number): D1PreparedStatement {
  return db.prepare(`DELETE FROM auth_attempts WHERE bucket LIKE '${IP_PREFIX}%' AND window_start <= ?`).bind(now - IP_WINDOW);
}

/** One failure: both counters up, the global lock on at the limit, old IP rows out — one batch. */
export async function recordFailure(db: D1Database, bucket: string, now: number): Promise<void> {
  await db.batch([
    eraseOldIpRows(db, now),
    count(db, bucket, IP_WINDOW, now),
    count(db, GLOBAL_BUCKET, GLOBAL_WINDOW, now),
    db
      .prepare('UPDATE auth_attempts SET locked_until = ? WHERE bucket = ? AND count >= ? AND (locked_until IS NULL OR locked_until <= ?)')
      .bind(now + GLOBAL_LOCK, GLOBAL_BUCKET, GLOBAL_MAX_FAILURES, now),
  ]);
}
