/**
 * Checks the admin token from tools/.env: present, active, expiry date. Never prints the
 * token, its id or the account id.
 *   node tools/admin/check-token.ts
 */
import { readAdminEnv } from './env.ts';

const { token, account } = readAdminEnv();
const headers = { Authorization: `Bearer ${token}` };

interface Verify {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: { status: string; expires_on?: string };
}

async function verify(url: string): Promise<{ status: number; body: Verify | null }> {
  try {
    const res = await fetch(url, { headers });
    return { status: res.status, body: (await res.json().catch(() => null)) as Verify | null };
  } catch (e) {
    console.error(`Network: ${e instanceof Error ? e.name : 'error'}`);
    process.exit(1);
  }
}

// Personal tokens verify under /user, account-owned ones under /accounts.
let r = await verify('https://api.cloudflare.com/client/v4/user/tokens/verify');
if (r.status !== 200) {
  const acc = await verify(`https://api.cloudflare.com/client/v4/accounts/${account}/tokens/verify`);
  if (acc.status === 200) r = acc;
}
console.log('Token in tools/.env: present; CLOUDFLARE_ACCOUNT_ID: present');
console.log(`Check: HTTP ${r.status}, status "${r.body?.result?.status ?? 'could not be checked'}"`);
console.log(`Expires: ${r.body?.result ? (r.body.result.expires_on ?? 'NOT SET (no expiry)') : 'unknown'}`);
if (r.body && !r.body.success) console.log('Errors:', r.body.errors?.map((e) => e.message).join('; '));
// exitCode, not exit(): exiting while fetch closes its handles trips a libuv assertion on Windows.
process.exitCode = r.body?.result?.status === 'active' ? 0 : 1;
