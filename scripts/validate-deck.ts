/**
 * Checks a Sluh deck ZIP before upload: npm run deck:check -- path/to/deck.zip
 * Uses the same validator as the app (src/core/deckFormat.ts). Node 24+ (runs .ts directly).
 */
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { checkDeckArchive, DECK_JSON, deckNameFromFileName } from '../src/core/deckFormat.ts';
import { LANGUAGE_PACKS } from '../src/core/languages.ts';

const file = process.argv[2];
if (!file) {
  console.error('Использование: npm run deck:check -- путь/к/колоде.zip');
  process.exit(2);
}

let zip: JSZip;
let bytes: Buffer;
try {
  bytes = await readFile(file);
  zip = await JSZip.loadAsync(bytes);
} catch (e) {
  console.error(`${file}: не удалось открыть как ZIP-архив (${e instanceof Error ? e.message : String(e)}).`);
  process.exit(1);
}

const paths = Object.keys(zip.files);
const json = await zip.file(DECK_JSON)?.async('string');
const r = checkDeckArchive(paths, json, { languages: LANGUAGE_PACKS, archiveBytes: bytes.length });

for (const e of r.errors) console.log(`ОШИБКА: ${e.message}`);
for (const w of r.warnings) console.log(`Предупреждение: ${w.message}`);
if (r.deck) {
  const audio = r.deck.entries.filter((e) => e.audio).length;
  const title = deckNameFromFileName(file);
  console.log(
    `OK: «${title}» (id ${r.deck.id}, редакция ${r.deck.revision}, язык ${r.deck.language}), ` +
      `записей: ${r.deck.entries.length}, с аудио: ${audio}, размер: ${(bytes.length / 1024 / 1024).toFixed(1)} МБ.`,
  );
} else {
  console.log(`Колода не прошла проверку: ошибок ${r.errors.length}.`);
}
process.exit(r.deck ? 0 : 1);
