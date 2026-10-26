/**
 * Read only: is any id of an erased account still in the database (R42 item 2)? The ids come
 * from the account's copy (export-account.ts): the account, its devices, its earlier ids.
 *   node tools/admin/check-erased.ts --exported tools/.out/export-….json [--local]
 */
import { readFileSync } from 'node:fs';
import type { AccountExport } from '../../src/core/accountExport.ts';
import { idsOf, tracesOf } from './accountAdmin.ts';
import { fail, parseArgs } from './d1.ts';

const { flags, values } = parseArgs(process.argv.slice(2));
const exported = values.get('exported');
if (!exported) fail('Usage: node tools/admin/check-erased.ts --exported <copy from export-account.ts> [--local]');

let file: AccountExport;
try {
  file = JSON.parse(readFileSync(exported, 'utf8')) as AccountExport;
} catch {
  fail(`Cannot read ${exported}.`);
}
const ids = idsOf(file);
const left = tracesOf({ local: flags.has('local') }, ids);
console.log(left.length === 0 ? `None of ${ids.length} ids is left in the database.` : `TRACES LEFT — ${left.map((t) => `${t.place}: ${t.n}`).join(', ')}.`);
if (left.length > 0) process.exitCode = 1;
