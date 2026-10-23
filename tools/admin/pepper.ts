/**
 * The Worker secret AUTH_PEPPER (R37 item 3): key of the HMAC for pairing codes and IP addresses.
 * The admin token may only touch D1, so the owner adds the secret in the Cloudflare dashboard
 * (docs/DEPLOY.md). The value is never printed.
 *   node tools/admin/pepper.ts           — a new value onto the clipboard
 *   node tools/admin/pepper.ts --clear   — empties the clipboard after pasting
 *   node tools/admin/pepper.ts --dev     — a separate value into .dev.vars for wrangler dev
 * Losing the value is harmless: make a new one (live codes, 10 minutes, and counters, 1 hour, are lost).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fail, parseArgs, toClipboard } from './d1.ts';

const { flags } = parseArgs(process.argv.slice(2));

function value(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
}

if (flags.has('clear')) {
  if (!toClipboard('')) fail('Could not empty the clipboard.');
  console.log('Clipboard emptied. If Windows clipboard history (Win+V) is on, clear it there too.');
} else if (flags.has('dev')) {
  const file = fileURLToPath(new URL('../../.dev.vars', import.meta.url));
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l !== '' && !l.startsWith('AUTH_PEPPER=')) : [];
  writeFileSync(file, [...lines, `AUTH_PEPPER=${value()}`, ''].join('\n'), 'utf8');
  console.log('AUTH_PEPPER written to .dev.vars (local only, not in git).');
} else {
  if (!toClipboard(value())) fail('Could not reach the clipboard (clip.exe).');
  console.log('A new AUTH_PEPPER is on the clipboard (not shown). Paste it in the dashboard:');
  console.log('Workers & Pages → mana → Settings → Variables and Secrets → Add → Type: Secret, name AUTH_PEPPER → Deploy.');
  console.log('Then run: node tools/admin/pepper.ts --clear');
}
