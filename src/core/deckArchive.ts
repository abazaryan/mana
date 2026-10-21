/**
 * Reads a deck — a ZIP, or deck.json alone (a .json file or pasted text, Р33 п. 15) —
 * and checks it with the same validator as `npm run deck:check`. Returns the checked
 * deck and the audio files its entries use.
 */
import JSZip from 'jszip';
import { checkDeckArchive, checkDeckJson, DECK_JSON, deckNameFromFileName, type DeckCheck } from './deckFormat';
import { LANGUAGE_PACKS } from './languages';

export interface DeckAudio {
  path: string;
  type: string;
  data: ArrayBuffer;
}

export interface DeckArchive {
  /** Deck name: the file name without .zip / .json (Р15); the deck id for pasted text. */
  name: string;
  check: DeckCheck;
  /** Audio used by the entries; empty when the deck has errors or came without an archive. */
  audio: DeckAudio[];
  archiveBytes: number;
}

const AUDIO_TYPES: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav' };

export function audioType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_TYPES[ext] ?? 'application/octet-stream';
}

export async function readDeckArchive(data: ArrayBuffer | Uint8Array, fileName: string): Promise<DeckArchive> {
  const name = deckNameFromFileName(fileName);
  const archiveBytes = data.byteLength;
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    const message = `Файл «${fileName}» не открывается как ZIP-архив.`;
    return { name, archiveBytes, audio: [], check: { deck: null, errors: [{ level: 'error', path: '', message }], warnings: [], notes: [] } };
  }

  const json = await zip.file(DECK_JSON)?.async('string');
  const check = checkDeckArchive(Object.keys(zip.files), json, { languages: LANGUAGE_PACKS, archiveBytes });
  if (!check.deck) return { name, archiveBytes, audio: [], check };

  const paths = [...new Set(check.deck.entries.flatMap((e) => (e.audio ? [e.audio] : [])))];
  const audio = await Promise.all(
    paths.map(async (path) => {
      const bytes = await zip.file(path)!.async('uint8array');
      // A standalone copy: the stored ArrayBuffer must hold just this file.
      const copy = bytes.slice().buffer as ArrayBuffer;
      return { path, type: audioType(path), data: copy };
    }),
  );
  return { name, archiveBytes, audio, check };
}

/**
 * The deck.json object in text an AI answered with: the first ```json block if there
 * is one, else everything from the first "{" to the last "}". Other text is left as is
 * (the validator then reports invalid JSON).
 */
export function extractDeckJson(text: string): string {
  const fenced = /```(?:json)?[^\S\n]*\n([\s\S]*?)```/i.exec(text);
  if (fenced) return fenced[1]!;
  const from = text.indexOf('{');
  const to = text.lastIndexOf('}');
  return from !== -1 && to > from ? text.slice(from, to + 1) : text;
}

/**
 * deck.json without an archive (Р33 п. 15): from a .json file (`fileName`) or pasted
 * text (`fileName` null — the deck id names it until its title does, Р30). Audio paths
 * are dropped from the entries: without files every entry plays the browser voice.
 */
export function readDeckJson(text: string, fileName: string | null): DeckArchive {
  const json = fileName === null ? extractDeckJson(text) : text;
  const check = checkDeckJson(json, { languages: LANGUAGE_PACKS });
  const archiveBytes = new TextEncoder().encode(json).byteLength;
  if (check.deck) {
    check.deck = { ...check.deck, entries: check.deck.entries.map(({ audio: _audio, ...e }) => e) };
  }
  const name = fileName !== null ? deckNameFromFileName(fileName) : (check.deck?.id ?? '');
  return { name, archiveBytes, audio: [], check };
}

/** A chosen file: a ZIP (by its first bytes or the name) or deck.json. */
export async function readDeckFile(data: ArrayBuffer, fileName: string): Promise<DeckArchive> {
  const head = new Uint8Array(data, 0, Math.min(2, data.byteLength));
  const zip = (head[0] === 0x50 && head[1] === 0x4b) || /\.zip$/i.test(fileName);
  if (zip) return readDeckArchive(data, fileName);
  return readDeckJson(new TextDecoder().decode(data), fileName);
}
