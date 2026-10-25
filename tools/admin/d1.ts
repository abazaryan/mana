/**
 * Shared part of the admin scripts (STAGE6_RESEARCH 3.6, R37): SQL against the D1 database
 * `mana` through the token wrapper (wrangler.ts) — or, with --local, against the local copy
 * of `wrangler dev` (no token). Writes go through a temporary .sql file (deleted afterwards);
 * the SQL holds only hashes, never a token or a code. Every action also writes admin_actions.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const wrapper = fileURLToPath(new URL('./wrangler.ts', import.meta.url));
const wranglerBin = fileURLToPath(new URL('../../node_modules/wrangler/bin/wrangler.js', import.meta.url));

import { labelAllowed, TEST_ONLY_MESSAGE, TEST_PREFIX } from './testOnly.ts';

export { TEST_PREFIX };

export interface Target {
  local: boolean;
}

export function parseArgs(argv: string[]): { flags: Set<string>; values: Map<string, string> } {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) fail(`Unexpected argument: ${arg}`);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      values.set(arg.slice(2), next);
      i++;
    } else {
      flags.add(arg.slice(2));
    }
  }
  return { flags, values };
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** A string literal for SQL. */
export function sql(value: string | number | null): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(Math.trunc(value));
  return `'${value.replace(/'/g, "''")}'`;
}

export const isUuid = (value: string | undefined): value is string =>
  value !== undefined && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

function wrangler(target: Target, args: string[]): string {
  const command = target.local ? [wranglerBin, ...args, '--local'] : [wrapper, ...args, '--remote'];
  const result = spawnSync(process.execPath, command, { cwd: root, encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  if (result.status !== 0) {
    // wrangler's own error text (the wrapper has already replaced any token in it)
    fail(`wrangler failed (${result.status}):\n${(result.stderr || result.stdout || '').trim()}`);
  }
  return result.stdout;
}

/** Rows of a read-only query (no secrets in it). */
export function query<T>(target: Target, text: string): T[] {
  const out = wrangler(target, ['d1', 'execute', 'mana', '--json', '--command', text]);
  const json = JSON.parse(out.slice(out.indexOf('['))) as { results: T[] }[];
  return json.flatMap((r) => r.results);
}

/** Statements that write: one temporary file, run as a whole, then deleted. */
export function run(target: Target, statements: string[]): void {
  const dir = mkdtempSync(join(tmpdir(), 'mana-admin-'));
  const file = join(dir, 'action.sql');
  try {
    writeFileSync(file, statements.map((s) => `${s.trim().replace(/;$/, '')};`).join('\n'), 'utf8');
    // wrangler's prompt before a remote file answers itself "yes" when not run interactively
    wrangler(target, ['d1', 'execute', 'mana', '--file', file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The admin_actions row for an action: user id without a name, detail without personal data. */
export function adminAction(action: string, userId: string | null, detail: Record<string, unknown>, now: number): string {
  return `INSERT INTO admin_actions (id, at, action, user_id, detail) VALUES (${sql(crypto.randomUUID())}, ${now}, ${sql(action)}, ${sql(userId)}, ${sql(JSON.stringify(detail))})`;
}

/** Puts text on the Windows clipboard without printing it; '' empties the clipboard. */
export function toClipboard(text: string): boolean {
  const result = spawnSync('clip', { input: text });
  return result.status === 0;
}

/** Where sign-in links point: the site, or `wrangler dev` for --local. */
export function siteOrigin(target: Target, site: string): string {
  return target.local ? 'http://127.0.0.1:8787' : site;
}

/**
 * A sign-in link for the owner to send: onto the clipboard and into tools/.out/ (outside git),
 * never into the terminal. Files there older than an invitation's life are deleted first.
 * A --local link (wrangler dev) only goes to the file: the clipboard is left alone.
 */
export function handOverLink(target: Target, link: string, name: string, now: number, maxAge: number): string {
  const dir = fileURLToPath(new URL('../.out/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (now - statSync(path).mtimeMs > maxAge) rmSync(path, { force: true });
  }
  const stamp = new Date(now).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const file = join(dir, `${name.replace(/[^A-Za-z0-9_-]/g, '_')}-${stamp}.txt`);
  writeFileSync(file, `${link}\n`, 'utf8');
  const where = `tools/.out/${file.slice(dir.length)}`;
  if (target.local) return `Link saved to ${where}`;
  return `${toClipboard(link) ? 'Link copied to the clipboard and saved' : 'Clipboard not available; link saved'} to ${where}`;
}

/** The account's label, or a refusal: unknown account, or not a test account while only those are allowed (testOnly.ts). */
export function testAccountLabel(target: Target, userId: string): string {
  const [user] = query<{ label: string }>(target, `SELECT label FROM users WHERE id = ${sql(userId)}`);
  if (!user) fail(`No account ${userId}.`);
  if (!labelAllowed(user.label)) fail(`Account ${userId} is not a test account. ${TEST_ONLY_MESSAGE}`);
  return user.label;
}
