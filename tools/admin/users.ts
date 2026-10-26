/**
 * Accounts at a glance (STAGE6_RESEARCH 3.6): id, label, under 16, consent (who, version),
 * devices with their last sign-in, number of earlier ids (R40), an erasure in progress (R42). No
 * study content, no parent's name.
 * Read-only.
 *   node tools/admin/users.ts [--local]
 */
import { parseArgs, query } from './d1.ts';

const { flags } = parseArgs(process.argv.slice(2));
const target = { local: flags.has('local') };

interface Row {
  id: string;
  label: string;
  minor: number;
  created_at: number;
  deleting_at: number | null;
  given_by: string | null;
  notice_version: number | null;
  aliases: number;
}
interface DeviceRow {
  id: string;
  user_id: string;
  name: string;
  last_seen_at: number;
  revoked_at: number | null;
  live: number;
}

const day = (ms: number | null) => (ms === null ? '—' : new Date(ms).toISOString().replace('T', ' ').slice(0, 16));

const users = query<Row>(
  target,
  `SELECT u.id, u.label, u.minor, u.created_at, u.deleting_at,
     (SELECT given_by FROM consents c WHERE c.user_id = u.id ORDER BY given_at DESC LIMIT 1) AS given_by,
     (SELECT notice_version FROM consents c WHERE c.user_id = u.id ORDER BY given_at DESC LIMIT 1) AS notice_version,
     (SELECT count(*) FROM user_aliases a WHERE a.user_id = u.id) AS aliases
   FROM users u ORDER BY u.created_at`,
);
const devices = query<DeviceRow>(
  target,
  `SELECT d.id, d.user_id, d.name, d.last_seen_at, d.revoked_at,
     (SELECT count(*) FROM sessions s WHERE s.device_id = d.id) AS live
   FROM devices d ORDER BY d.last_seen_at DESC`,
);

if (users.length === 0) console.log(`No accounts${target.local ? ' (LOCAL database)' : ''}.`);
for (const u of users) {
  const consent = u.given_by ? `${u.given_by}, notice v${u.notice_version}` : 'none';
  console.log(`${u.id}  ${u.label}  ${u.minor ? 'under 16' : '16+'}  consent: ${consent}  earlier ids: ${u.aliases}  created ${day(u.created_at)} UTC${u.deleting_at !== null ? `  BEING ERASED since ${day(u.deleting_at)} UTC` : ''}`);
  for (const d of devices.filter((x) => x.user_id === u.id)) {
    const state = d.revoked_at !== null ? `signed out ${day(d.revoked_at)}` : d.live > 0 ? 'signed in' : 'session expired';
    console.log(`    ${d.id}  ${d.name}  last sign-in ${day(d.last_seen_at)} UTC  ${state}`);
  }
}
