/**
 * A new account's invitation (STAGE6_RESEARCH 3.1, R37): 256-bit token, 48 hours, one use; the
 * database gets only its SHA-256. The link goes to the clipboard and tools/.out/, not the terminal.
 *   node tools/admin/invite.ts --label "test-edge-1" [--minor] [--local]
 * --minor: under 16 — the app asks for a parent's or guardian's consent.
 * Until stage 6a.5 only test accounts: the label must start with "test-".
 */
import { INVITE_TTL, ORIGIN } from '../../worker/config.ts';
import { newToken, sha256Hex } from '../../worker/tokens.ts';
import { adminAction, fail, handOverLink, siteOrigin, parseArgs, run, sql, TEST_PREFIX } from './d1.ts';

const { flags, values } = parseArgs(process.argv.slice(2));
const label = values.get('label')?.trim();
if (!label) fail('Usage: node tools/admin/invite.ts --label "test-…" [--minor] [--local]');
if (!label.startsWith(TEST_PREFIX)) fail(`Until stage 6a.5 only test accounts: the label must start with "${TEST_PREFIX}".`);
if (label.length > 60) fail('Label: 60 characters at most.');

const target = { local: flags.has('local') };
const minor = flags.has('minor') ? 1 : 0;
const now = Date.now();
const expiresAt = now + INVITE_TTL;
const token = newToken();

run(target, [
  `INSERT INTO invites (token_hash, kind, user_id, label, minor, created_at, expires_at)
   VALUES (${sql(await sha256Hex(token))}, 'account', NULL, ${sql(label)}, ${minor}, ${now}, ${expiresAt})`,
  adminAction('invite', null, { kind: 'account', minor, expiresAt, local: target.local }, now),
]);

const where = handOverLink(target, `${siteOrigin(target, ORIGIN)}/#/join/${token}`, `invite-${label}`, now, INVITE_TTL);
console.log(`Invitation for ${label} (${minor ? 'under 16' : '16 or older'}${target.local ? ', LOCAL database' : ''}).`);
console.log(`${where}. Valid until ${new Date(expiresAt).toISOString().replace('T', ' ').slice(0, 16)} UTC, once.`);
