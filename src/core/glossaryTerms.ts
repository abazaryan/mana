/**
 * Tajik words the glossary rejects for deck text (R28): docs/GLOSSARY_TG.md is the one
 * source. `npm run glossary:terms` turns its table into src/core/tgDeckTerms.ts (read
 * by the deck check in the app and in `deck:check`); a test keeps the two in step.
 */

import { DECK_TERMS_HEADING } from './cyrillicData.ts';

export interface DeckTerm {
  /** Start of the rejected word, any case ("<word>" also catches its plural). */
  word: string;
  /** What to write instead. */
  use: string;
}

export { DECK_TERMS_HEADING };

/** The table under DECK_TERMS_HEADING: the first column is the word, the second what to use. */
export function parseDeckTerms(markdown: string): DeckTerm[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === DECK_TERMS_HEADING);
  if (start < 0) throw new Error(`The glossary has no section "${DECK_TERMS_HEADING}".`);
  const terms: DeckTerm[] = [];
  let inTable = false;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (!line.trim().startsWith('|')) {
      if (inTable) break;
      continue;
    }
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (!inTable) {
      inTable = true; // header row
      continue;
    }
    if (cells.every((c) => /^-+$/.test(c))) continue; // separator
    const [word, use] = cells;
    if (word && use) terms.push({ word: word.toLowerCase(), use });
  }
  return terms;
}

/** Source of src/core/tgDeckTerms.ts. */
export function renderDeckTerms(terms: readonly DeckTerm[]): string {
  const rows = terms.map((t) => `  { word: ${JSON.stringify(t.word)}, use: ${JSON.stringify(t.use)} },`).join('\n');
  return `// Generated from docs/GLOSSARY_TG.md («${DECK_TERMS_HEADING.slice(3)}») by npm run glossary:terms. Do not edit.
import type { DeckTerm } from './glossaryTerms';

export const TG_DECK_TERMS: readonly DeckTerm[] = [
${rows}
];
`;
}
