/**
 * Journal backup: "save the journal to a file" and "restore from a file". Restore
 * only adds records, skipping UUIDs already present (the journal is append-only, Р10).
 *
 * A backup belongs to one local user. Restoring into an installation with an empty
 * journal adopts that user (e.g. after clearing site data). Merging the journals of
 * two installations that both have answers is stage 6 (sync); restore refuses it.
 */
import { SKILLS, type Skill } from './deckFormat';
import type { FinalRating, LogRecord } from './model';

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
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rating(v: unknown): v is FinalRating {
  return v === 1 || v === 2 || v === 3 || v === 4;
}

/** One record from JSON, dates revived; null if it is not a valid record of `userId`. */
function reviveRecord(v: unknown, userId: string): LogRecord | null {
  if (!isObject(v)) return null;
  const at = date(v.at);
  if (!at || !str(v.id) || v.userId !== userId || !str(v.deviceId) || !str(v.deckId) || !str(v.entryId)) return null;
  if (typeof v.deckRevision !== 'number' || !str(v.sessionId)) return null;
  if (v.type === 'intro') {
    if (v.skill !== null) return null;
    return { ...(v as unknown as LogRecord), at };
  }
  if (v.type === 'drill') {
    if (!(SKILLS as readonly unknown[]).includes(v.skill as Skill) || !str(v.reviewId)) return null;
    return { ...(v as unknown as LogRecord), at };
  }
  if (v.type !== 'review') return null;
  if (!(SKILLS as readonly unknown[]).includes(v.skill as Skill)) return null;
  if (!rating(v.final) || !rating(v.suggested) || !isObject(v.fsrs)) return null;
  const dueBefore = date(v.fsrs.dueBefore);
  const nextDue = date(v.fsrs.nextDue);
  if (!dueBefore || !nextDue) return null;
  return { ...(v as unknown as LogRecord), at, fsrs: { ...(v.fsrs as object), dueBefore, nextDue } } as LogRecord;
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
