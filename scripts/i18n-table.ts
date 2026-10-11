/**
 * Writes docs/I18N_TG.md — every Tajik interface string for the user's check:
 * npm run i18n:table. Node 24+ (runs .ts directly).
 */
import { writeFile } from 'node:fs/promises';
import { FORM_LABELS } from '../src/core/deckFormat.ts';
import { LANGUAGE_PACKS } from '../src/core/languages.ts';
import { tableExtras, tajikTable } from '../src/ui/strings.ts';

const out = new URL('../docs/I18N_TG.md', import.meta.url);
await writeFile(out, tajikTable(tableExtras(FORM_LABELS, LANGUAGE_PACKS)), 'utf8');
console.log('docs/I18N_TG.md обновлён.');
