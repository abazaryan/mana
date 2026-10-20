/**
 * Checks a Mana deck ZIP before upload: npm run deck:check -- path/to/deck.zip
 * With `--with other.zip …`: also the checks against decks already installed (Р28 п. 8,
 * К1/К2) — the same as on import; decks of another learning language and the deck
 * itself (same id) are left out.
 * Uses the same validator as the app (src/core/deckFormat.ts). Node 24+ (runs .ts directly).
 */
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { crossDeckWarnings, type OtherDeck } from '../src/core/deckContent.ts';
import { checkDeckArchive, DECK_JSON, deckNameFromFileName, deckTitle, primaryLanguage, type Localized } from '../src/core/deckFormat.ts';
import { LANGUAGE_PACKS } from '../src/core/languages.ts';

const args = process.argv.slice(2);
const at = args.indexOf('--with');
const file = (at === -1 ? args : args.slice(0, at))[0];
const withFiles = at === -1 ? [] : args.slice(at + 1);
if (!file || (at !== -1 && withFiles.length === 0)) {
  console.error('Использование: npm run deck:check -- путь/к/колоде.zip [--with установленная1.zip установленная2.zip …]');
  process.exit(2);
}

/** deck.json of another deck ZIP, or exit with a message. */
async function readOther(path: string): Promise<{ id: string; language: string; title?: Localized; entries: unknown[] }> {
  try {
    const z = await JSZip.loadAsync(await readFile(path));
    const d = JSON.parse((await z.file(DECK_JSON)?.async('string')) ?? 'null');
    if (!d || typeof d.id !== 'string' || typeof d.language !== 'string' || !Array.isArray(d.entries)) throw new Error('нет deck.json колоды');
    return d;
  } catch (e) {
    console.error(`${path}: не удалось прочитать колоду для сверки (${e instanceof Error ? e.message : String(e)}).`);
    process.exit(1);
  }
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

const cross: string[] = [];
if (r.deck && withFiles.length > 0) {
  const others: OtherDeck[] = [];
  for (const path of withFiles) {
    const d = await readOther(path);
    if (d.id === r.deck.id || primaryLanguage(d.language) !== primaryLanguage(r.deck.language)) continue;
    others.push({ name: deckTitle({ name: deckNameFromFileName(path), title: d.title }, 'ru'), entries: d.entries });
  }
  cross.push(...crossDeckWarnings(r.deck.entries, others).map((w) => w.message));
}

for (const e of r.errors) console.log(`ОШИБКА: ${e.message}`);
for (const w of r.warnings) console.log(`Предупреждение: ${w.message}`);
for (const w of cross) console.log(`Предупреждение: ${w}`);
if (r.deck) {
  const audio = r.deck.entries.filter((e) => e.audio).length;
  // Р30: the name from deck.json (in Russian, else any); the file name only without it.
  const title = deckTitle({ name: deckNameFromFileName(file), title: r.deck.title }, 'ru');
  console.log(
    `OK: «${title}» (id ${r.deck.id}, редакция ${r.deck.revision}, язык ${r.deck.language}), ` +
      `записей: ${r.deck.entries.length}, с аудио: ${audio}, размер: ${(bytes.length / 1024 / 1024).toFixed(1)} МБ.`,
  );
} else {
  console.log(`Колода не прошла проверку: ошибок ${r.errors.length}.`);
}
process.exit(r.deck ? 0 : 1);
