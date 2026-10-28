/**
 * Numbers of the server for the checks of 6a.6 (countRows.ts): accounts in all and, with --user,
 * the account's journal rows, devices (signed out among them), sessions, consents, earlier ids and
 * whether it is being erased. No label, no content, the id cut to 8 characters.
 * Read-only.
 *   node tools/admin/counts.ts [--user <id>] [--local]
 */
import { countsFrom, countsSql, countsText } from './countRows.ts';
import { fail, isUuid, parseArgs, query } from './d1.ts';

const { flags, values } = parseArgs(process.argv.slice(2));
const userId = values.get('user') ?? null;
if (userId !== null && !isUuid(userId)) fail('Usage: node tools/admin/counts.ts [--user <account id>] [--local]');

const target = { local: flags.has('local') };
const lines = countsText(countsFrom(query<Record<string, unknown>>(target, countsSql(userId))), userId);
if (target.local) lines[0] += ' (LOCAL database)';
for (const line of lines) console.log(line);
