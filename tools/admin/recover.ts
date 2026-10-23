/**
 * A sign-in link for an existing account (STAGE6_RESEARCH 3.3): an invitation of kind "device",
 * 48 hours, one use — for a lost device or a new one without a code. --revoke-all first signs out
 * every device of the account. The link goes to the clipboard and tools/.out/.
 *   node tools/admin/recover.ts --user <id> [--revoke-all] [--local]
 */
import { INVITE_TTL, ORIGIN } from '../../worker/config.ts';
import { newToken, sha256Hex } from '../../worker/tokens.ts';
import { adminAction, fail, handOverLink, siteOrigin, isUuid, parseArgs, run, sql, testAccountLabel } from './d1.ts';

const { flags, values } = parseArgs(process.argv.slice(2));
const userId = values.get('user');
if (!isUuid(userId)) fail('Usage: node tools/admin/recover.ts --user <account id> [--revoke-all] [--local]');

const target = { local: flags.has('local') };
const label = testAccountLabel(target, userId);
const revokeAll = flags.has('revoke-all');
const now = Date.now();
const expiresAt = now + INVITE_TTL;
const token = newToken();

run(target, [
  ...(revokeAll
    ? [
        `DELETE FROM sessions WHERE user_id = ${sql(userId)}`,
        `UPDATE devices SET revoked_at = ${now} WHERE user_id = ${sql(userId)} AND revoked_at IS NULL`,
      ]
    : []),
  `INSERT INTO invites (token_hash, kind, user_id, label, minor, created_at, expires_at)
   VALUES (${sql(await sha256Hex(token))}, 'device', ${sql(userId)}, NULL, 0, ${now}, ${expiresAt})`,
  adminAction('recover', userId, { revokeAll, expiresAt, local: target.local }, now),
]);

const where = handOverLink(target, `${siteOrigin(target, ORIGIN)}/#/join/${token}`, `recover-${label}`, now, INVITE_TTL);
console.log(`Sign-in link for ${label}${revokeAll ? '; all its devices signed out' : ''}${target.local ? ' (LOCAL database)' : ''}.`);
console.log(`${where}. Valid until ${new Date(expiresAt).toISOString().replace('T', ' ').slice(0, 16)} UTC, once.`);
