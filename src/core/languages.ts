/**
 * Language packs: everything that depends on the learning language (decision Р13).
 * A deck names its language with a BCP-47 tag ("fr-FR"); the pack is found by the primary subtag.
 *
 * Only French is implemented. Text normalization, sound-based comparison and numbers
 * move into the pack at stages 3–4; the custom keyboard row is used at stage 5.
 * Before the first deck in a new language, check speech recognition and TTS for it
 * on the user's devices (especially lb-LU).
 *
 * Type-only imports: this file is also run directly by Node in scripts/validate-deck.ts.
 */
import type { LanguageSupport, UiLang } from './deckFormat';

export interface LanguagePack extends LanguageSupport {
  /** Locale for speech recognition and TTS when the deck tag has no region. */
  defaultLocale: string;
  /** Language name in each interface language. */
  name: Record<UiLang, string>;
  /** Extra letters for the custom phone keyboard (Р6). */
  keyboardRow: readonly string[];
}

export const FRENCH: LanguagePack = {
  code: 'fr',
  defaultLocale: 'fr-FR',
  name: { tg: 'фаронсавӣ', ru: 'французский', en: 'French' },
  genders: ['m', 'f'],
  keyboardRow: ['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'î', 'ï', 'ô', 'û', 'ù', 'ü', 'œ', 'æ', "'", '-'],
};

export const LANGUAGE_PACKS: readonly LanguagePack[] = [FRENCH];

/** "fr-FR" / "fr" / "FR-fr" → French pack; unknown language → undefined. */
export function findLanguagePack(tag: string): LanguagePack | undefined {
  const code = tag.split('-')[0]!.toLowerCase();
  return LANGUAGE_PACKS.find((p) => p.code === code);
}

/** Locale for speech APIs: the deck tag if it has a region, else the pack default. */
export function speechLocale(tag: string): string | undefined {
  const pack = findLanguagePack(tag);
  if (!pack) return undefined;
  return /-([A-Z]{2}|[0-9]{3})$/.test(tag) ? tag : pack.defaultLocale;
}
