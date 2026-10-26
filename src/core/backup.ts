/**
 * Journal backup: "save the journal to a file" and "restore from a file". Restore
 * only adds records, skipping UUIDs already present (the journal is append-only, R10).
 *
 * A backup belongs to one local user. Restoring into an installation with an empty
 * journal adopts that user (e.g. after clearing site data). Without sign-in, merging the
 * journals of two installations that both have answers is refused. Signed in (stage 6a.4,
 * R40), a file of the account or of an earlier id of it joins the account's journal.
 */
import { isoTime, reviveRecord as reviveJson } from './journalRecord.ts';
import type { LogRecord } from './model';

export const BACKUP_FORMAT = 'mana-journal';
export const BACKUP_VERSION = 1;

export interface JournalBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: Date;
  userId: string;
  deviceId: string;
  records: LogRecord[];
}

export function serializeBackup(b: Omit<JournalBackup, 'format' | 'version'>): string {
  const out = { format: BACKUP_FORMAT, version: BACKUP_VERSION, ...b };
  return JSON.stringify(out, null, 1);
}

/** Backup file name, e.g. "mana-journal-2026-10-11.json" (local date). */
export function backupFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${BACKUP_FORMAT}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

export type BackupError = 'json' | 'format' | 'version' | 'records';
export type ParsedBackup = { ok: true; backup: JournalBackup } | { ok: false; error: BackupError };

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function date(v: unknown): Date | null {
  const ms = isoTime(v);
  return ms === null ? null : new Date(ms);
}

/**
 * One record from JSON, dates revived; null if it is not a valid record of `userId`. The check
 * is the server's (journalRecord.ts): a later record type is kept whole (stage 6a.3).
 */
function reviveRecord(v: unknown, userId: string): LogRecord | null {
  return reviveJson(v, userId) as LogRecord | null;
}

export function parseBackup(text: string): ParsedBackup {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, error: 'json' };
  }
  if (!isObject(v) || v.format !== BACKUP_FORMAT) return { ok: false, error: 'format' };
  if (v.version !== BACKUP_VERSION) return { ok: false, error: 'version' };
  const exportedAt = date(v.exportedAt);
  if (!exportedAt || !str(v.userId) || !str(v.deviceId) || !Array.isArray(v.records)) {
    return { ok: false, error: 'format' };
  }
  const userId = v.userId;
  const records: LogRecord[] = [];
  for (const r of v.records) {
    const rec = reviveRecord(r, userId);
    if (!rec) return { ok: false, error: 'records' };
    records.push(rec);
  }
  return {
    ok: true,
    backup: { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, userId, deviceId: v.deviceId, records },
  };
}

export type RestorePlan =
  | { ok: true; adoptUserId: string | null; add: LogRecord[]; skipped: number }
  | { ok: false; error: 'otherUser' };

/**
 * What a restore adds. `localUserId` / `localHasRecords` describe this installation,
 * `existingIds` are the journal ids already stored.
 */
export function planRestore(
  backup: JournalBackup,
  localUserId: string,
  localHasRecords: boolean,
  existingIds: ReadonlySet<string>,
): RestorePlan {
  let adoptUserId: string | null = null;
  if (backup.userId !== localUserId) {
    if (localHasRecords) return { ok: false, error: 'otherUser' };
    adoptUserId = backup.userId;
  }
  const seen = new Set(existingIds);
  const add: LogRecord[] = [];
  for (const r of backup.records) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    add.push(r);
  }
  return { ok: true, adoptUserId, add, skipped: backup.records.length - add.length };
}

/** Whose file it is for a signed-in device (R40): the account's (its id or an earlier id), or unknown. */
export function backupOwner(backup: JournalBackup, accountId: string, formerUserIds: readonly string[]): 'account' | 'unknown' {
  return backup.userId === accountId || formerUserIds.includes(backup.userId) ? 'account' : 'unknown';
}

export type AccountRestorePlan = { ok: true; add: LogRecord[]; skipped: number } | { ok: false; error: 'unknownUser' };

/**
 * What a restore adds on a signed-in device (R40, replaces the refusal of R18 item 3 there): a
 * file of the account or of one of its earlier ids. Its records become the account's — only the
 * userId changes (the server never held records under an earlier id); ids already here are
 * skipped. A file of an unknown id must first become an earlier id of the account (the server).
 */
export function planAccountRestore(
  backup: JournalBackup,
  accountId: string,
  formerUserIds: readonly string[],
  existingIds: ReadonlySet<string>,
): AccountRestorePlan {
  if (backupOwner(backup, accountId, formerUserIds) !== 'account') return { ok: false, error: 'unknownUser' };
  const seen = new Set(existingIds);
  const add: LogRecord[] = [];
  for (const r of backup.records) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    add.push(r.userId === accountId ? r : { ...r, userId: accountId });
  }
  return { ok: true, add, skipped: backup.records.length - add.length };
}
