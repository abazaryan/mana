/**
 * The export of an account between the server and its readers (stage 6a.5, R42 item 5): the
 * account's rows as the Worker's routes and tools/admin/export-account.ts give them. Built from
 * the rows of the same queries (worker/accountSql.ts) in both places. No imports: the Worker
 * bundles this file. Times are milliseconds UTC here; the file has ISO strings (accountExport.ts).
 */

/**
 * Records in one page of the journal export from the app, at most and by default (like the sync
 * pull: a larger limit is cut). 200 from 27.10.2026 (step "CPU of sign-in routes").
 */
export const EXPORT_PAGE = 200;

export interface ExportHead {
  account: { id: string; createdAt: number; label: string; minor: boolean };
  /** Every device, the removed and signed-out ones too. */
  devices: { id: string; name: string; createdAt: number; lastSeenAt: number; appVersion: number | null; revokedAt: number | null }[];
  consents: { id: string; noticeVersion: number; givenBy: string; parentName: string | null; deviceId: string; givenAt: number }[];
  formerNumbers: { aliasId: string; addedAt: number }[];
  settings: { key: string; value: unknown; serverRev: number; updatedAt: number; deviceId: string }[];
  adminActions: { id: string; at: number; action: string; detail: unknown }[];
  /** Records of the account on the server when the head was read. */
  journalCount: number;
}

/** What the server keeps about a record beside the record itself. */
export interface ServerRecord {
  id: string;
  seq: number;
  receivedAt: number;
  bodyHash: string;
}

export interface ExportJournalPage {
  /** The records as the server keeps them (canonical JSON), in seq order. */
  records: unknown[];
  server: ServerRecord[];
  /** The cursor after this page. */
  next: number;
  more: boolean;
}

type Row = Record<string, unknown>;

const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string => String(v);

/** JSON text as stored (a setting's value, an admin row's detail); the text itself if it is not JSON. */
function parsed(v: unknown): unknown {
  if (typeof v !== 'string') return v ?? null;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    return v;
  }
}

export interface HeadRows {
  account: Row;
  devices: Row[];
  consents: Row[];
  formerNumbers: Row[];
  settings: Row[];
  adminActions: Row[];
  journalCount: number;
}

/** The head of the export from the rows of EXPORT_SQL (snake_case columns). */
export function headFromRows(rows: HeadRows): ExportHead {
  const a = rows.account;
  return {
    account: { id: str(a.id), createdAt: num(a.created_at), label: str(a.label), minor: num(a.minor) === 1 },
    devices: rows.devices.map((d) => ({
      id: str(d.id),
      name: str(d.name),
      createdAt: num(d.created_at),
      lastSeenAt: num(d.last_seen_at),
      appVersion: numOrNull(d.app_version),
      revokedAt: numOrNull(d.revoked_at),
    })),
    consents: rows.consents.map((c) => ({
      id: str(c.id),
      noticeVersion: num(c.notice_version),
      givenBy: str(c.given_by),
      parentName: c.parent_name === null || c.parent_name === undefined ? null : str(c.parent_name),
      deviceId: str(c.device_id),
      givenAt: num(c.given_at),
    })),
    formerNumbers: rows.formerNumbers.map((f) => ({ aliasId: str(f.alias_id), addedAt: num(f.added_at) })),
    settings: rows.settings.map((s) => ({ key: str(s.key), value: parsed(s.value), serverRev: num(s.server_rev), updatedAt: num(s.updated_at), deviceId: str(s.device_id) })),
    adminActions: rows.adminActions.map((r) => ({ id: str(r.id), at: num(r.at), action: str(r.action), detail: parsed(r.detail) })),
    journalCount: rows.journalCount,
  };
}

/** What the server keeps about a record, from a row of EXPORT_SQL.journalPage. */
export function serverRecordFromRow(r: Row): ServerRecord {
  return { id: str(r.id), seq: num(r.seq), receivedAt: num(r.received_at), bodyHash: str(r.body_hash) };
}
