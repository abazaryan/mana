/**
 * The data notice has one copy: docs/NOTICE.md, read at build time (R37 item 1). No long line of
 * it may be written again in the code, the app's files or the Worker.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const SCANNED = ['src', 'worker', 'public', 'scripts', 'tools', 'index.html'];
const SKIP = new Set(['node_modules', 'worker-configuration.d.ts', '.out']);

function files(path: string): string[] {
  const full = join(ROOT, path);
  if (statSync(full).isFile()) return [path];
  return readdirSync(full).flatMap((name) => (SKIP.has(name) ? [] : files(join(path, name))));
}

describe('docs/NOTICE.md is the only copy of the notice', () => {
  const notice = readFileSync(join(ROOT, 'docs', 'NOTICE.md'), 'utf8');
  const body = notice.split('\n');
  const lines = body
    .slice(body.indexOf('## tg'))
    .map((l) => l.replace(/^\s*[–·-]\s+/, '').replace(/\*\*/g, '').trim())
    .filter((l) => l.length >= 60);

  it('the notice has long lines to look for', () => {
    expect(lines.length).toBeGreaterThan(30);
  });

  it('none of them is in src/, worker/, public/, scripts/, tools/, index.html', () => {
    const found: string[] = [];
    for (const file of SCANNED.flatMap(files)) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      for (const line of lines) if (text.includes(line)) found.push(`${file}: ${line.slice(0, 40)}`);
    }
    expect(found).toEqual([]);
  });
});
