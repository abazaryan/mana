/**
 * Erases an account on request (R42 items 1–2): first export-account.ts, then this with that
 * file — it must be the account's copy, at most 48 hours old and with as many records as the
 * server has now. Steps as in the app (worker/accountSql.ts), with "via": "admin"; an erasure left
 * unfinished (by this script, the app or the Cron) is finished by running it again (no file
 * needed then). At the end — the read-only check that no id of the account is left anywhere.
 *   node tools/admin/delete-account.ts --user <id> --exported tools/.out/export-….json [--local]
 */
import { readFileSync } from 'node:fs';
import type { AccountExport } from '../../src/core/accountExport.ts';
import { EXPORT_SQL } from '../../worker/accountSql.ts';
import { eraseAccount, idsOf, tracesOf } from './accountAdmin.ts';
import { fail, inline, isUuid, OUT_MAX_AGE, parseArgs, query, sql } from './d1.ts';

const { flags, values } = parseArgs(process.argv.slice(2));
const userId = values.get('user');
const exported = values.get('exported');
if (!isUuid(userId)) fail('Usage: node tools/admin/delete-account.ts --user <account id> --exported <copy from export-account.ts> [--local]');

const target = { local: flags.has('local') };
const now = Date.now();
const [user] = query<{ label: string; deleting_at: number | null }>(target, `SELECT label, deleting_at FROM users WHERE id = ${sql(userId)}`);
if (!user) fail(`No account ${userId}${target.local ? ' (LOCAL database)' : ''}. Check traces with check-erased.ts.`);

let file: AccountExport | null = null;
if (exported !== undefined) {
  try {
    file = JSON.parse(readFileSync(exported, 'utf8')) as AccountExport;
  } catch {
    fail(`Cannot read ${exported}.`);
  }
}
if (user.deleting_at === null) {
  if (!file) fail('First make the copy: node tools/admin/export-account.ts --user <id>, then pass it with --exported.');
  if (file.account?.id !== userId) fail(`${exported} is not a copy of ${userId}.`);
  const age = now - Date.parse(file.exportedAt);
  if (!(age >= 0 && age <= OUT_MAX_AGE)) fail(`${exported} is older than 48 hours: make a new copy.`);
  const count = Number(query<{ n: number }>(target, inline(EXPORT_SQL.journalCount, [userId]))[0]?.n ?? 0);
  if (count !== file.records.length) fail(`The server has ${count} records, the copy ${file.records.length}: make a new copy.`);
  console.log(`Erasing ${user.label}${target.local ? ' (LOCAL database)' : ''}: ${count} records.`);
} else {
  console.log(`${user.label} is being erased since ${new Date(user.deleting_at).toISOString()}: finishing.`);
}

let written = 0;
let duration = 0;
eraseAccount(target, userId, now, (r) => {
  written += r.rowsWritten;
  duration += r.duration;
  console.log(`  step ${r.step}: ${r.changes} changes, rows_written ${r.rowsWritten}, ${r.duration.toFixed(2)} ms`);
});
console.log(`Done: rows_written ${written} in all, ${duration.toFixed(2)} ms of SQL.`);

const ids = file ? idsOf(file) : [userId];
const left = tracesOf(target, ids);
console.log(
  left.length === 0
    ? `Check (read only): none of ${ids.length} ids of the account is left in the database.`
    : `Check (read only): TRACES LEFT — ${left.map((t) => `${t.place}: ${t.n}`).join(', ')}.`,
);
if (left.length > 0) process.exitCode = 1;
