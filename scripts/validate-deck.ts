/**
 * Checks a Sluh deck ZIP before upload: npm run deck:check -- path/to/deck.zip
 * Uses the same validator as the app (src/core/deckFormat.ts). Node 24+ (runs .ts directly).
 */
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { checkDeckArchive, DECK_JSON } from '../src/core/deckFormat.ts';

const file = process.argv[2];
if (!file) {
  console.error('Использование: npm run deck:check -- путь/к/колоде.zip');
  process.exit(2);
}

let zip: JSZip;
try {
  zip = await JSZip.loadAsync(await readFile(file));
} catch (e) {
  console.error(`${file}: не удалось открыть как ZIP-архив (${e instanceof Error ? e.message : String(e)}).`);
  process.exit(1);
}

const paths = Object.keys(zip.files);
const json = await zip.file(DECK_JSON)?.async('string');
const r = checkDeckArchive(paths, json);

for (const e of r.errors) console.log(`ОШИБКА: ${e.message}`);
for (const w of r.warnings) console.log(`Предупреждение: ${w.message}`);
if (r.deck) {
  const audio = r.deck.entries.filter((e) => e.audio).length;
  console.log(`OK: «${r.deck.title}» (id ${r.deck.id}), записей: ${r.deck.entries.length}, с аудио: ${audio}.`);
} else {
  console.log(`Колода не прошла проверку: ошибок ${r.errors.length}.`);
}
process.exit(r.deck ? 0 : 1);
