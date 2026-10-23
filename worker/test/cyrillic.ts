import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'vite';

/**
 * Finds Cyrillic where the project forbids it (CLAUDE.md, "Cyrillic in code"). Code, comments,
 * test names, error messages and tool output are English. Cyrillic is data only: the string
 * table, documents, and string literals inside tests that check how Cyrillic is handled.
 */

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const CYRILLIC = /[Ѐ-ӿ]/g;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'reference', 'apkg', 'decks', 'coverage']);
const EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|json|jsonc)$/;

/** Files where any Cyrillic is data: the string table (tg / ru / en) and the table generated from the glossary. */
export const DATA_FILES = ['src/ui/strings.ts', 'src/core/tgDeckTerms.ts'];

/** Test files: Cyrillic may stand in string and regex literals (test data), but not in comments or in test names. */
export function isTestFile(path: string): boolean {
  return /\.test\.ts$/.test(path) || path.startsWith('src/test/') || path.startsWith('worker/test/');
}

export function listSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (EXTENSIONS.test(e.name)) out.push(relative(ROOT, p).split(sep).join('/'));
    }
  };
  walk(ROOT);
  return out.sort();
}

type Range = [number, number];
interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

const TEST_FUNCTIONS = new Set(['describe', 'it', 'test']);

/** Ranges of string, template and regex literals, and of the names given to describe / it / test. */
export function literalRanges(code: string, path: string): { literals: Range[]; titles: Range[] } {
  const lang = path.endsWith('.tsx') ? 'tsx' : /\.(ts)$/.test(path) ? 'ts' : 'js';
  const literals: Range[] = [];
  const titles: Range[] = [];
  const visit = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(visit);
    const node = n as Node;
    if (node.type === 'Literal' || node.type === 'TemplateElement') literals.push([node.start, node.end]);
    if (node.type === 'CallExpression') {
      const callee = node.callee as Node | undefined;
      const first = (node.arguments as Node[] | undefined)?.[0];
      const name = callee?.type === 'Identifier' ? (callee.name as string) : (callee?.object as Node | undefined)?.name;
      if (first && typeof name === 'string' && TEST_FUNCTIONS.has(name) && (first.type === 'Literal' || first.type === 'TemplateLiteral')) {
        titles.push([first.start, first.end]);
      }
    }
    for (const [k, v] of Object.entries(node)) if (k !== 'type' && typeof v === 'object') visit(v);
  };
  visit(parseAst(code, { lang }));
  return { literals, titles };
}

const inside = (ranges: Range[], pos: number) => ranges.some(([a, b]) => pos >= a && pos < b);

/** 1-based numbers of the lines that break the rule. */
export function violatingLines(path: string, code: string): number[] {
  if (DATA_FILES.includes(path)) return [];
  const bad = new Set<number>();
  const lineAt = (pos: number) => code.slice(0, pos).split('\n').length;
  const positions = [...code.matchAll(CYRILLIC)].map((m) => m.index ?? 0);
  if (positions.length === 0) return [];
  if (/\.(ts|tsx|js|mjs|cjs)$/.test(path) && isTestFile(path)) {
    const { literals, titles } = literalRanges(code, path);
    for (const pos of positions) if (!inside(literals, pos) || inside(titles, pos)) bad.add(lineAt(pos));
  } else {
    for (const pos of positions) bad.add(lineAt(pos));
  }
  return [...bad].sort((a, b) => a - b);
}

/** Violating lines per file, for every file that has any. */
export function scanAll(): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const path of listSources()) {
    const lines = violatingLines(path, readFileSync(join(ROOT, path), 'utf8'));
    if (lines.length) result[path] = lines;
  }
  return result;
}
