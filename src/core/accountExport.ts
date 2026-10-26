/**
 * The file "a copy of the account's data" (stage 6a.5, R42 item 5): everything the server keeps
 * for an account in one file. On top — the journal file's own format (backup.ts), so restore from
 * a file takes it as it is; beside it — the other parts. Built the same way in the app (from the
 * export routes) and in tools/admin/export-account.ts (from the same queries). Times are ISO
 * strings here. Pure.
 */
import type { ExportHead, ExportJournalPage } from './accountRows.ts';
import { BACKUP_FORMAT, BACKUP_VERSION } from './backup.ts';

const iso = (ms: number): string => new Date(ms).toISOString();
const isoOrNull = (ms: number | null): string | null => (ms === null ? null : iso(ms));

export interface AccountExport {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  /** The account's id: the records' userId. */
  userId: string;
  /** The device that made the copy; "admin" for the admin script. */
  deviceId: string;
  /** The records as the server keeps them, without server fields inside. */
  records: unknown[];
  account: { id: string; createdAt: string; label: string; minor: boolean };
  devices: { id: string; name: string; createdAt: string; lastSeenAt: string; appVersion: number | null; revokedAt: string | null }[];
  consents: { id: string; noticeVersion: number; givenBy: string; parentName: string | null; deviceId: string; givenAt: string }[];
  formerNumbers: { aliasId: string; addedAt: string }[];
  settings: { key: string; value: unknown; serverRev: number; updatedAt: string; deviceId: string }[];
  serverRecords: { id: string; seq: number; receivedAt: string; bodyHash: string }[];
  adminActions: { id: string; at: string; action: string; detail: unknown }[];
}

/** The deviceId of a copy the admin script makes. */
export const ADMIN_EXPORT_DEVICE = 'admin';

export function buildAccountExport(head: ExportHead, pages: readonly ExportJournalPage[], exportedAt: Date, deviceId: string): AccountExport {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    userId: head.account.id,
    deviceId,
    records: pages.flatMap((p) => p.records),
    account: { ...head.account, createdAt: iso(head.account.createdAt) },
    devices: head.devices.map((d) => ({ ...d, createdAt: iso(d.createdAt), lastSeenAt: iso(d.lastSeenAt), revokedAt: isoOrNull(d.revokedAt) })),
    consents: head.consents.map((c) => ({ ...c, givenAt: iso(c.givenAt) })),
    formerNumbers: head.formerNumbers.map((f) => ({ ...f, addedAt: iso(f.addedAt) })),
    settings: head.settings.map((s) => ({ ...s, updatedAt: iso(s.updatedAt) })),
    serverRecords: pages.flatMap((p) => p.server).map((r) => ({ ...r, receivedAt: iso(r.receivedAt) })),
    adminActions: head.adminActions.map((a) => ({ ...a, at: iso(a.at) })),
  };
}

export function serializeAccountExport(file: AccountExport): string {
  return JSON.stringify(file, null, 1);
}

/** "mana-journal-account-2026-10-26.json" (local date): the journal files' pattern, so .gitignore keeps it out too. */
export function accountExportFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${BACKUP_FORMAT}-account-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}
