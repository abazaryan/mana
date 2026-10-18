/**
 * Writes src/core/tgDeckTerms.ts from the table «Проверка колоды: отклонённые слова»
 * in docs/GLOSSARY_TG.md (Р28): npm run glossary:terms. Node 24+ (runs .ts directly).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseDeckTerms, renderDeckTerms } from '../src/core/glossaryTerms.ts';

const md = await readFile(new URL('../docs/GLOSSARY_TG.md', import.meta.url), 'utf8');
const terms = parseDeckTerms(md);
await writeFile(new URL('../src/core/tgDeckTerms.ts', import.meta.url), renderDeckTerms(terms), 'utf8');
console.log(`src/core/tgDeckTerms.ts обновлён: слов ${terms.length}.`);
