/**
 * The admin side of an account's export and erasure (stage 6a.5, R42): the same SQL as the Worker
 * (worker/accountSql.ts) with the values as literals, through wrangler (d1.ts). Used by
 * export-account.ts, delete-account.ts and check-erased.ts.
 */
import { buildAccountExport, ADMIN_EXPORT_DEVICE, serializeAccountExport, type AccountExport } from '../../src/core/accountExport.ts';
import { EXPORT_PAGE, headFromRows, serverRecordFromRow, type ExportJournalPage } from '../../src/core/accountRows.ts';
import { ERASE_SQL, eraseDetail, EXPORT_SQL } from '../../worker/accountSql.ts';
import { ERASE_PORTION } from '../../worker/config.ts';
import { execute, inline, query, saveOut, type ExecuteMeta, type Target } from './d1.ts';
import { traceSql, tracesFrom } from './traces.ts';

type Row = Record<string, unknown>;

/** The account's copy, as the app's "save a copy" makes it (deviceId "admin"). */
export function readAccountExport(target: Target, userId: string, now: number): AccountExport {
  return exportFrom((text) => query<Row>(target, text), userId, now);
}

/** The copy from rows that `read` gives for a statement with literals (wrangler, or a test database). */
export function exportFrom(read: (text: string) => Row[], userId: string, now: number): AccountExport {
  const rows = (text: string, ...more: (string | number)[]) => read(inline(text, [userId, ...more]));
  const [account] = rows(EXPORT_SQL.account);
  if (!account) throw new Error(`No account ${userId}.`);
  const head = headFromRows({
    account,
    devices: rows(EXPORT_SQL.devices),
    consents: rows(EXPORT_SQL.consents),
    formerNumbers: rows(EXPORT_SQL.formerNumbers),
    settings: rows(EXPORT_SQL.settings),
    adminActions: rows(EXPORT_SQL.adminActions),
    journalCount: Number(rows(EXPORT_SQL.journalCount)[0]?.n ?? 0),
  });
  const pages: ExportJournalPage[] = [];
  let after = 0;
  for (;;) {
    const got = rows(EXPORT_SQL.journalPage, after, EXPORT_PAGE + 1);
    const page = got.slice(0, EXPORT_PAGE);
    pages.push({ records: page.map((r) => JSON.parse(String(r.body)) as unknown), server: page.map(serverRecordFromRow), next: 0, more: false });
    if (got.length <= EXPORT_PAGE) break;
    after = Number(page[page.length - 1]!.seq);
  }
  return buildAccountExport(head, pages, new Date(now), ADMIN_EXPORT_DEVICE);
}

/** The copy into tools/.out/ (no label in the name); returns its path. */
export function saveAccountExport(file: AccountExport, now: number): string {
  return saveOut('export', 'json', serializeAccountExport(file), now);
}

/** The ids an erased account must not leave anywhere: its own, its devices', its earlier ids. */
export function idsOf(file: AccountExport): string[] {
  return [file.account.id, ...file.devices.map((d) => d.id), ...file.formerNumbers.map((f) => f.aliasId)];
}

/** Where any of `ids` still occurs (read only, one query); empty — no traces. */
export function tracesOf(target: Target, ids: readonly string[]): { place: string; n: number }[] {
  return tracesFrom(query<Record<string, unknown>>(target, traceSql(ids)));
}

export interface StepReport {
  step: string;
  duration: number;
  rowsWritten: number;
  changes: number;
}

const report = (step: string, metas: readonly ExecuteMeta[]): StepReport => ({
  step,
  duration: metas.reduce((s, m) => s + (m.duration ?? 0), 0),
  rowsWritten: metas.reduce((s, m) => s + (m.rows_written ?? 0), 0),
  changes: metas.reduce((s, m) => s + (m.changes ?? 0), 0),
});

/** The statements of step 1 for an admin erasure, as one command. */
export function startSql(userId: string, now: number, rowId: string = crypto.randomUUID()): string {
  return [
    inline(ERASE_SQL.adminRow, [userId, rowId, now, eraseDetail('admin')]),
    inline(ERASE_SQL.mark, [userId, now]),
    inline(ERASE_SQL.sessions, [userId]),
    inline(ERASE_SQL.codes, [userId]),
    inline(ERASE_SQL.invites, [userId]),
    inline(ERASE_SQL.adminActions, [userId]),
  ].join(';\n');
}

/**
 * A portion for the script: the Worker's statement with RETURNING, so the rows erased are counted
 * from the answer — wrangler --local gives no `changes` in its meta (26.10.2026).
 */
export const portionSql = (userId: string): string => `${inline(ERASE_SQL.portion, [userId, ERASE_PORTION])} RETURNING seq`;

/**
 * Steps 1–3 (R42 item 2), each through wrangler with D1's numbers; `onStep` hears each as it
 * ends. Step 1 again on a marked account changes nothing; the run goes on where the last one ended.
 */
export function eraseAccount(target: Target, userId: string, now: number, onStep: (r: StepReport) => void): StepReport[] {
  const steps: StepReport[] = [];
  const done = (r: StepReport) => {
    steps.push(r);
    onStep(r);
  };
  done(report('1: mark, sessions, codes, invitations, admin rows', execute(target, startSql(userId, now)).map((r) => r.meta)));
  for (let portion = 1; ; portion++) {
    const [result] = execute<{ seq: number }>(target, portionSql(userId));
    const erased = result?.results.length ?? 0;
    done({ ...report(`2: journal portion ${portion}`, result ? [result.meta] : []), changes: erased });
    if (erased < ERASE_PORTION) break;
  }
  done(report('3: the account (cascade)', execute(target, inline(ERASE_SQL.account, [userId])).map((r) => r.meta)));
  return steps;
}
