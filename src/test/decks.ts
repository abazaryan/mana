/** Test decks and ZIP archives built in memory. */
import JSZip from 'jszip';
import type { Deck, DeckEntry } from '../core/deckFormat';

export function entry(id: string, extra: Partial<DeckEntry> = {}): DeckEntry {
  return {
    id,
    text: id.replace(/-/g, ' '),
    ipa: 'a',
    meaning: { ru: `значение ${id}`, tg: `маъно ${id}` },
    audio: `audio/${id}.mp3`,
    skills: ['listen', 'speak'],
    ...extra,
  };
}

export function deck(revision: number, ids: string[], extra: Partial<Deck> = {}): Deck {
  return {
    format: 'sluh-deck',
    version: 1,
    id: 'fr-test-01',
    revision,
    language: 'fr-FR',
    tags: { word: { ru: 'слово' } },
    entries: ids.map((id) => entry(id, { tags: ['word'] })),
    ...extra,
  };
}

/** Distinct bytes per file, so a replaced audio is visible. */
export function fakeAudio(path: string, revision: number): Uint8Array {
  return new TextEncoder().encode(`${path}#${revision}`);
}

export async function deckZip(d: Deck, audioSeed = d.revision): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('deck.json', JSON.stringify(d));
  for (const e of d.entries) if (e.audio) zip.file(e.audio, fakeAudio(e.audio, audioSeed));
  return zip.generateAsync({ type: 'uint8array' });
}
