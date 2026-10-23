export interface DeckCard {
  /** Prompt in Russian. */
  ru: string;
  /** Reference answer in French. */
  fr: string;
}

export { DEFAULT_DECK_TEXT } from './cyrillicData';

/** One card per line: "ru | fr" (a tab also works as separator). */
export function parseDeck(text: string): DeckCard[] {
  const out: DeckCard[] = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const parts = line.split(/\s*[|\t]\s*/);
    const ru = parts[0]?.trim() ?? '';
    const fr = parts.slice(1).join(' | ').trim();
    if (parts.length >= 2 && ru && fr) out.push({ ru, fr });
  }
  return out;
}

/** Fisher–Yates; rng injectable for tests. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}
