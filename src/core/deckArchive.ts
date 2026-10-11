/**
 * Reads a deck ZIP (JSZip) and checks it with the same validator as `npm run deck:check`.
 * Returns the checked deck and the audio files its entries use.
 */
import JSZip from 'jszip';
import { checkDeckArchive, DECK_JSON, deckNameFromFileName, type DeckCheck } from './deckFormat';
import { LANGUAGE_PACKS } from './languages';

export interface DeckAudio {
  path: string;
  type: string;
  data: ArrayBuffer;
}

export interface DeckArchive {
  /** Deck name: the file name without .zip (Р15). */
  name: string;
  check: DeckCheck;
  /** Audio used by the entries; empty when the deck has errors. */
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
    return { name, archiveBytes, audio: [], check: { deck: null, errors: [{ level: 'error', path: '', message }], warnings: [] } };
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
