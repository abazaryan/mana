/**
 * Earlier local userIds of an account (stage 6a.4, R40; STAGE6_RESEARCH 5.9): an installation
 * whose answers were added to the account under another id, or a backup file of such an
 * installation. An earlier id is never an account's id, and belongs to one account only: so the
 * server never holds a record under an earlier id, and a device may rewrite its records of that
 * id before their first push.
 */
import { NOTICE_VERSION } from '../src/core/notice.ts';

/**
 * A local userId as a device sends it for an account or an earlier id: a UUID in lower case,
 * exactly as the records carry it (crypto.randomUUID) — the case is not changed, the account's
 * id must equal the records' string.
 */
export function isLocalUserId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

/**
 * The account agreed to the current notice (R39 item 18): a consent of version NOTICE_VERSION or
 * later, given by a parent or guardian when the account is under 16 (R37 item 9). Needed for the
 * journal, the settings and an earlier id (R40). A query of its own, not part of the session read.
 */
export async function hasConsent(db: D1Database, userId: string): Promise<boolean> {
  const row = await db.prepare(`SELECT 1 AS ok FROM users u WHERE u.id = ?1 AND ${CONSENT_OF_U}`).bind(userId, NOTICE_VERSION).first();
  return row !== null;
}

/** SQL: the account `u` has the consent it needs to notice version ?2 or later (see hasConsent). */
export const CONSENT_OF_U = `EXISTS (
  SELECT 1 FROM consents c WHERE c.user_id = u.id AND c.notice_version >= ?2 AND (u.minor = 0 OR c.given_by = 'parent'))`;

/** The account's earlier ids, oldest first (`results` of one query, for a batch). */
export function aliasesStatement(db: D1Database, userId: string): D1PreparedStatement {
  return db.prepare('SELECT alias_id FROM user_aliases WHERE user_id = ? ORDER BY added_at, alias_id').bind(userId);
}

export async function aliasesOf(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await aliasesStatement(db, userId).all<{ alias_id: string }>();
  return results.map((r) => r.alias_id);
}

/**
 * What a local userId `id` is for account `account`: the account itself, already one of its
 * earlier ids, free (nobody's), or taken — another account's id or another account's earlier id.
 */
export type AliasStatus = 'same' | 'known' | 'free' | 'taken';

export async function aliasStatus(db: D1Database, id: string, account: string): Promise<AliasStatus> {
  if (id === account) return 'same';
  const row = await db
    .prepare('SELECT (SELECT user_id FROM user_aliases WHERE alias_id = ?1) AS owner, EXISTS (SELECT 1 FROM users WHERE id = ?1) AS user')
    .bind(id)
    .first<{ owner: string | null; user: number }>();
  if (row?.user) return 'taken';
  if (row?.owner === account) return 'known';
  return row?.owner ? 'taken' : 'free';
}

/** A new account may take `id`: it is no account's id and no account's earlier id. */
export async function freeForAccount(db: D1Database, id: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT EXISTS (SELECT 1 FROM users WHERE id = ?1) OR EXISTS (SELECT 1 FROM user_aliases WHERE alias_id = ?1) AS taken')
    .bind(id)
    .first<{ taken: number }>();
  return !row?.taken;
}

/**
 * SQL that holds while `id` may become an earlier id of `account` (or is it, or is the account) —
 * a guard inside a batch, so a race between two requests cannot give one id to two accounts.
 * For a new account (`account` null): `id` is no account's and no earlier id at all.
 */
export function freeClause(id: string, account: string | null): { sql: string; args: string[] } {
  if (account === null) {
    return { sql: 'NOT EXISTS (SELECT 1 FROM users WHERE id = ?) AND NOT EXISTS (SELECT 1 FROM user_aliases WHERE alias_id = ?)', args: [id, id] };
  }
  return {
    sql: 'NOT EXISTS (SELECT 1 FROM users WHERE id = ? AND id <> ?) AND NOT EXISTS (SELECT 1 FROM user_aliases WHERE alias_id = ? AND user_id <> ?)',
    args: [id, account, id, account],
  };
}

/** A broken UNIQUE or PRIMARY KEY of a batch: the last guard against two accounts taking one id. */
export function isKeyClash(e: unknown): boolean {
  return e instanceof Error && /UNIQUE|PRIMARY KEY|constraint/i.test(e.message);
}
