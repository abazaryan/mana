/**
 * A copy of everything the server keeps for an account (R42 item 5) — the same file as the app's
 * "save a copy of the account data", deviceId "admin". For a request by e-mail, and before every
 * delete-account.ts. Read-only. The file goes to tools/.out/ (outside git; no label in the name)
 * and is deleted with the other files there after 48 hours: send it to the person before that.
 *   node tools/admin/export-account.ts --user <id> [--local]
 */
import { idsOf, readAccountExport, saveAccountExport } from './accountAdmin.ts';
import { accountLabel, fail, isUuid, parseArgs } from './d1.ts';

const { flags, values } = parseArgs(process.argv.slice(2));
const userId = values.get('user');
if (!isUuid(userId)) fail('Usage: node tools/admin/export-account.ts --user <account id> [--local]');

const target = { local: flags.has('local') };
const label = accountLabel(target, userId);
const now = Date.now();
const file = readAccountExport(target, userId, now);
const where = saveAccountExport(file, now);
console.log(`Copy of ${label}${target.local ? ' (LOCAL database)' : ''}: ${file.records.length} records, ${file.devices.length} devices, ${file.consents.length} consents, ${file.formerNumbers.length} earlier ids, ${file.settings.length} settings, ${file.adminActions.length} admin rows.`);
console.log(`Saved to ${where} (personal data: send it to the person within 48 hours; it is deleted after that).`);
console.log(`Ids the erasure must leave nowhere: ${idsOf(file).length}.`);
