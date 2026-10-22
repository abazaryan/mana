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
    console.error(`Сеть: ${e instanceof Error ? e.name : 'ошибка'}`);
    process.exit(1);
  }
}

// Personal tokens verify under /user, account-owned ones under /accounts.
let r = await verify('https://api.cloudflare.com/client/v4/user/tokens/verify');
if (r.status !== 200) {
  const acc = await verify(`https://api.cloudflare.com/client/v4/accounts/${account}/tokens/verify`);
  if (acc.status === 200) r = acc;
}
console.log('Токен в tools/.env: есть; CLOUDFLARE_ACCOUNT_ID: есть');
console.log(`Проверка: HTTP ${r.status}, статус «${r.body?.result?.status ?? 'не удалось проверить'}»`);
console.log(`Срок действия: ${r.body?.result ? (r.body.result.expires_on ?? 'НЕ ЗАДАН (бессрочный)') : 'неизвестен'}`);
if (r.body && !r.body.success) console.log('Ошибки:', r.body.errors?.map((e) => e.message).join('; '));
// exitCode, not exit(): exiting while fetch closes its handles trips a libuv assertion on Windows.
process.exitCode = r.body?.result?.status === 'active' ? 0 : 1;
