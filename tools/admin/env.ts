/**
 * Reads the admin token and account id from tools/.env without putting them into this
 * process's environment: the values only go to the child wrangler (see wrangler.ts).
 * Never print what this returns.
 */
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

export interface AdminEnv {
  token: string;
  account: string;
}

export function readAdminEnv(): AdminEnv {
  let text: string;
  try {
    text = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  } catch {
    console.error('Файла tools/.env нет.');
    process.exit(1);
  }
  const vars = parseEnv(text);
  const token = vars.MANA_ADMIN_API_TOKEN?.trim();
  const account = vars.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (!token || !account) {
    const missing = [!token && 'MANA_ADMIN_API_TOKEN', !account && 'CLOUDFLARE_ACCOUNT_ID'].filter(Boolean);
    console.error(`В tools/.env не задано: ${missing.join(', ')}.`);
    process.exit(1);
  }
  return { token, account };
}
