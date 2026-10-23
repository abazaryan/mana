import { describe, expect, it } from 'vitest';
import { LEGACY_LINES } from './support/cyrillic-legacy.ts';
import { scanAll, violatingLines } from './support/cyrillic.ts';

/**
 * CLAUDE.md, "Cyrillic in code": code, comments, test names, error messages, tool output and
 * UI labels in code are English. Cyrillic is allowed only as data: src/ui/strings.ts (and the
 * table generated from the glossary), documents, string literals in tests that check how
 * Cyrillic is handled, and the files listed in DATA_FILES (tests/support/cyrillic.ts: .ts / .tsx / .js / .json / .jsonc /
 * .html / .css / .py / .webmanifest are scanned). The files in LEGACY_LINES are old debt with a ceiling on the number
 * of lines.
 */
describe('no Cyrillic in code', () => {
  const found = scanAll();

  it('no new Cyrillic: a file outside the list has none, a listed file has no more lines than listed', () => {
    const grown = Object.entries(found)
      .filter(([path, lines]) => lines.length > (LEGACY_LINES[path] ?? 0))
      .map(([path, lines]) => `${path}: ${lines.length} lines (allowed ${LEGACY_LINES[path] ?? 0}), at ${lines.join(', ')}`);
    expect(grown, 'Cyrillic outside the allowed places; write English or put the text into src/ui/strings.ts').toEqual([]);
  });

  it('the legacy list is not stale: fewer lines than listed means lower the number or delete the entry', () => {
    const stale = Object.entries(LEGACY_LINES)
      .filter(([path, n]) => (found[path]?.length ?? 0) < n)
      .map(([path, n]) => `${path}: ${found[path]?.length ?? 0} lines now, listed ${n}`);
    expect(stale).toEqual([]);
  });

  it('what counts: Cyrillic in a comment or a test name fails, in a test-data string it does not', () => {
    const cy = '\u044f';
    expect(violatingLines('src/core/x.ts', `const a = 1; // ${cy}`)).toEqual([1]);
    expect(violatingLines('src/core/x.ts', `const a = '${cy}';`)).toEqual([1]);
    expect(violatingLines('src/core/x.test.ts', `expect(f('${cy}')).toBe(/${cy}+/);`)).toEqual([]);
    expect(violatingLines('src/core/x.test.ts', `it('${cy}', () => {});`)).toEqual([1]);
    expect(violatingLines('src/core/x.test.ts', `// ${cy}\nconst a = \`${cy}\`;`)).toEqual([1]);
    expect(violatingLines('src/ui/strings.ts', `const a = '${cy}'; // ${cy}`)).toEqual([]);
    expect(violatingLines('src/core/x.json', `{"a": "${cy}"}`)).toEqual([1]);
    expect(violatingLines('index.html', `<title>${cy}</title>`)).toEqual([1]);
    expect(violatingLines('src/ui/x.css', `/* ${cy} */`)).toEqual([1]);
    expect(violatingLines('scripts/x.py', `x = "${cy}"`)).toEqual([1]);
    expect(violatingLines('pages-moved/index.html', `<p>${cy}</p>`)).toEqual([]);
  });
});
