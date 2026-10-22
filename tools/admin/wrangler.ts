/**
 * Runs the project's wrangler with the admin token from tools/.env (MANA_ADMIN_API_TOKEN).
 * The token goes to the child process only, as CLOUDFLARE_API_TOKEN; any occurrence of it in
 * the output is replaced by ***. Telemetry off; log level never "debug" (it prints API requests).
 *   node tools/admin/wrangler.ts d1 info mana
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readAdminEnv } from './env.ts';

const { token, account } = readAdminEnv();
const bin = fileURLToPath(new URL('../../node_modules/wrangler/bin/wrangler.js', import.meta.url));

const child = spawn(process.execPath, [bin, ...process.argv.slice(2)], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    CLOUDFLARE_API_TOKEN: token,
    CLOUDFLARE_ACCOUNT_ID: account,
    WRANGLER_SEND_METRICS: 'false',
    WRANGLER_LOG: 'log',
  },
});

// Line-buffered, so a token split between two chunks is still caught.
function redact(from: NodeJS.ReadableStream, to: NodeJS.WriteStream): Promise<void> {
  let rest = '';
  const clean = (s: string) => s.split(token).join('***');
  from.setEncoding('utf8');
  from.on('data', (chunk: string) => {
    const lines = (rest + chunk).split('\n');
    rest = lines.pop() ?? '';
    for (const line of lines) to.write(clean(line) + '\n');
  });
  return new Promise((done) =>
    from.on('end', () => {
      if (rest) to.write(clean(rest));
      done();
    }),
  );
}

const streams = Promise.all([redact(child.stdout, process.stdout), redact(child.stderr, process.stderr)]);
child.on('close', async (code) => {
  await streams;
  process.exit(code ?? 1);
});
