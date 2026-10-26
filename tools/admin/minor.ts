/**
 * Clears the "under 16" mark of an account on request (R42 item 10), e.g. after the person
 * turned 16. The consent a parent gave stays valid (with the mark off any consent of the
 * current notice counts). Writes admin_actions.
 *   node tools/admin/minor.ts --user <id> --clear [--local]
 */
import { accountLabel, adminAction, fail, isUuid, parseArgs, run, sql } from './d1.ts';

const { flags, values } = parseArgs(process.argv.slice(2));
const userId = values.get('user');
if (!isUuid(userId) || !flags.has('clear')) fail('Usage: node tools/admin/minor.ts --user <account id> --clear [--local]');

const target = { local: flags.has('local') };
const label = accountLabel(target, userId);
const now = Date.now();
run(target, [
  `UPDATE users SET minor = 0 WHERE id = ${sql(userId)} AND deleting_at IS NULL`,
  adminAction('minor-clear', userId, { local: target.local }, now),
]);
console.log(`Under-16 mark cleared for ${label}${target.local ? ' (LOCAL database)' : ''}.`);
