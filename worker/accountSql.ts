/**
 * SQL of the export and the erasure of an account (stage 6a.5, R42), shared by the Worker and the
 * admin scripts (tools/admin/export-account.ts, delete-account.ts — they put the values in as
 * literals). Parameters are numbered: ?1 is always the account's id. No imports.
 */

/** What the export reads besides the journal; each gives rows of the account, oldest first. */
export const EXPORT_SQL = {
  account: 'SELECT id, created_at, label, minor FROM users WHERE id = ?1',
  devices: 'SELECT id, name, created_at, last_seen_at, app_version, revoked_at FROM devices WHERE user_id = ?1 ORDER BY created_at, id',
  consents: 'SELECT id, notice_version, given_by, parent_name, device_id, given_at FROM consents WHERE user_id = ?1 ORDER BY given_at, id',
  formerNumbers: 'SELECT alias_id, added_at FROM user_aliases WHERE user_id = ?1 ORDER BY added_at, alias_id',
  settings: 'SELECT key, value, server_rev, updated_at, device_id FROM user_settings WHERE user_id = ?1 ORDER BY key',
  adminActions: 'SELECT id, at, action, detail FROM admin_actions WHERE user_id = ?1 ORDER BY at, id',
  journalCount: 'SELECT count(*) AS n FROM journal WHERE user_id = ?1',
  /** One page of the journal: ?2 — after this seq, ?3 — rows. */
  journalPage: 'SELECT seq, id, body, body_hash, received_at FROM journal WHERE user_id = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3',
} as const;

/**
 * The erasure (R42 item 2). Step 1, one batch, in this order: the admin row 'delete' (no account
 * in it, ?2 — its id, ?3 — time, ?4 — detail; only while the account is not marked yet, so one per
 * erasure), the mark, then the account's sessions, codes, invitations and admin rows. Step 2: a
 * portion of the journal (?2 — rows), repeated. Step 3: the users row — the cascade takes the
 * rest and the mark.
 */
export const ERASE_SQL = {
  adminRow: `INSERT INTO admin_actions (id, at, action, user_id, detail)
    SELECT ?2, ?3, 'delete', NULL, ?4 WHERE EXISTS (SELECT 1 FROM users WHERE id = ?1 AND deleting_at IS NULL)`,
  mark: 'UPDATE users SET deleting_at = COALESCE(deleting_at, ?2) WHERE id = ?1',
  sessions: 'DELETE FROM sessions WHERE user_id = ?1',
  codes: 'DELETE FROM pairing_codes WHERE user_id = ?1',
  invites: 'DELETE FROM invites WHERE user_id = ?1',
  adminActions: 'DELETE FROM admin_actions WHERE user_id = ?1',
  portion: 'DELETE FROM journal WHERE seq IN (SELECT seq FROM journal WHERE user_id = ?1 ORDER BY seq LIMIT ?2)',
  account: 'DELETE FROM users WHERE id = ?1 AND deleting_at IS NOT NULL',
} as const;

/** Accounts marked for erasure, oldest mark first (?1 — how many). */
export const MARKED_SQL = 'SELECT id FROM users WHERE deleting_at IS NOT NULL ORDER BY deleting_at, id LIMIT ?1';

/** The way an erasure came: the app's button or the admin script (the only detail of its admin row). */
export type EraseVia = 'app' | 'admin';

export const eraseDetail = (via: EraseVia): string => JSON.stringify({ via });
