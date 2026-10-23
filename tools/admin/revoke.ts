/**
 * Signs out a device (STAGE6_RESEARCH 3.3): its sessions are deleted, its next request gets 401;
 * the account and what the device sent stay. --user signs out all devices of an account.
 *   node tools/admin/revoke.ts --device <id> [--local]
 *   node tools/admin/revoke.ts --user <id> [--local]
 */
import { adminAction, fail, isUuid, parseArgs, query, run, sql, testAccountLabel } from './d1.ts';

const { flags, values } = parseArgs(process.argv.slice(2));
const deviceId = values.get('device');
const userArg = values.get('user');
if (isUuid(deviceId) === isUuid(userArg)) fail('Usage: node tools/admin/revoke.ts --device <device id> | --user <account id> [--local]');

const target = { local: flags.has('local') };
const now = Date.now();

if (isUuid(deviceId)) {
  const [device] = query<{ user_id: string }>(target, `SELECT user_id FROM devices WHERE id = ${sql(deviceId)}`);
  if (!device) fail(`No device ${deviceId}.`);
  const label = testAccountLabel(target, device.user_id);
  run(target, [
    `DELETE FROM sessions WHERE device_id = ${sql(deviceId)}`,
    `UPDATE devices SET revoked_at = ${now} WHERE id = ${sql(deviceId)} AND revoked_at IS NULL`,
    adminAction('revoke', device.user_id, { device: deviceId, local: target.local }, now),
  ]);
  console.log(`Device ${deviceId} of ${label} signed out.`);
} else {
  const userId = userArg!;
  const label = testAccountLabel(target, userId);
  run(target, [
    `DELETE FROM sessions WHERE user_id = ${sql(userId)}`,
    `UPDATE devices SET revoked_at = ${now} WHERE user_id = ${sql(userId)} AND revoked_at IS NULL`,
    adminAction('revoke', userId, { all: true, local: target.local }, now),
  ]);
  console.log(`All devices of ${label} signed out.`);
}
