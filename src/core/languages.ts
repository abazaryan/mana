/**
 * Language packs: everything that depends on the learning language (decision Р13).
 * A deck names its language with a BCP-47 tag ("fr-FR"); the pack is found by the primary subtag.
 *
 * Only French is implemented. The written-answer rules (stage 3) live in `writing`,
 * the sound-based check of a spoken answer and numbers (stage 4.2, Р22) in `spoken`;
 * the custom keyboard row is used at stage 5.
 * Before the first deck in a new language, check speech recognition and TTS for it
 * on the user's devices (especially lb-LU).
 *
 * Type-only imports, or `.ts` imports: this file is also run directly by Node in
 * scripts/validate-deck.ts.
 */
import type { LanguageSupport, UiLang } from './deckFormat';
import { FRENCH_SPOKEN } from './frenchSpoken.ts';
import { soundsSame } from './spoken.ts';

/**
 * Language rules of the written-answer cascade (src/core/evaluate.ts) and of print
 * conventions (src/core/printConventions.ts). The algorithms are language-neutral;
 * everything that depends on the language is here.
 */
export interface WritingRules {
  /**
   * Spaces that are typography rather than language, e.g. the French space before
   * `? ! : ;`. Removed from both sides before comparing; must have the `g` flag.
   */
  typographicSpace: RegExp | null;
  /**
   * A leading article/determiner. An answer equal to the reference without it is
   * "almost" with error type `article` (the article carries the gender).
   */
  leadingArticle: RegExp | null;
  /** One typo edit allowed per this many characters of the reference. */
  typoCharsPerEdit: number;
  /** Upper bound on typo edits, however long the reference. */
  typoMaxEdits: number;
  /** Articles that may stand round a bare slash at the start: `le/la X(e)`. */
  slashArticles: readonly string[];
  /** Punctuation that takes no space before it in this language. */
  noSpaceBefore: string;
}

/**
 * Two spellings that sound the same when they differ only in the ending:
 * `stem + one ending` vs `stem + another ending` from the same list.
 */
export interface EndingRule {
  /** Rule id written to the journal (`soundRules`). */
  id: string;
  endings: readonly string[];
  /** Shortest stem the rule applies to (le ≠ les: stem "l" is too short). */
  minStem: number;
  /** The stem must match (e.g. end in a vowel). */
  stemPattern?: RegExp;
  /** Closed list: if either word is here, the rule does not apply. */
  exceptions?: readonly string[];
  /** The word with this ending must follow a plural subject (ils parlent). */
  pluralSubject?: string;
}

/** Whole words that sound the same (a = à, ces = ses). */
export interface WordClass {
  id: string;
  words: readonly string[];
}

/**
 * Rules of the sound-based check of a spoken (or typed in `speak`) answer
 * (src/core/spoken.ts, Р5, Р22). Keys are lower case, œ → oe, æ → ae, one kind of
 * apostrophe; an elided word keeps its apostrophe (`l'`).
 */
export interface SpokenRules {
  /** Articles: a missing one alone is "almost"; with a `determiner` hint a wrong one is "incorrect". */
  articles: readonly string[];
  /** Hesitation sounds the recognizer may write; ignored. */
  fillers: readonly string[];
  /** Abbreviation (lower case, with its dot if it has one) → word. */
  abbreviations: Readonly<Record<string, string>>;
  /** Number → words; null if out of range. */
  cardinal(n: number): string | null;
  ordinal(n: number, feminine: boolean): string | null;
  /** Digits + ordinal suffix; group 1 = the number, group 2 = the suffix. */
  ordinalSuffix: RegExp;
  feminineOrdinalSuffixes: readonly string[];
  endingRules: readonly EndingRule[];
  wordClasses: readonly WordClass[];
  /** Silent-ending rules do not apply when one word ends like this… */
  liaisonFinal: RegExp;
  /** …and the next word starts like this (the final consonant may be heard). */
  liaisonNext: RegExp;
  pluralSubjects: readonly string[];
  /** Words allowed between the plural subject and the verb (ils ne le parlent). */
  subjectClitics: readonly string[];
}

export interface LanguagePack extends LanguageSupport {
  /** Locale for speech recognition and TTS when the deck tag has no region. */
  defaultLocale: string;
  /** Language name in each interface language. */
  name: Record<UiLang, string>;
  /** Extra letters for the custom phone keyboard (Р6). */
  keyboardRow: readonly string[];
  /** Rules for the written answer (skill `write`, Р5). */
  writing: WritingRules;
  /** Rules for the spoken answer (skill `speak`, Р5, Р22). */
  spoken: SpokenRules;
}

export const FRENCH: LanguagePack = {
  code: 'fr',
  defaultLocale: 'fr-FR',
  name: { tg: 'фаронсавӣ', ru: 'французский', en: 'French' },
  genders: ['m', 'f'],
  sameSound: (a, b) => soundsSame(a, b, FRENCH_SPOKEN),
  keyboardRow: ['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'î', 'ï', 'ô', 'û', 'ù', 'ü', 'œ', 'æ', "'", '-'],
  writing: {
    // French typography: a space before `? ! : ; »` and after `«`. Correct in print,
    // invisible on screen, not something to test the learner on.
    typographicSpace: /\s+(?=[?!:;»])|(?<=«)\s+/g,
    // Elision first so it wins over the two-letter forms.
    leadingArticle: /^(l'|le |la |les |un |une |des )/,
    // Words of 5 characters or less get no typo tolerance: one edit on a short
    // French word usually lands on another real word (mer/mur, sel/sol).
    typoCharsPerEdit: 6,
    typoMaxEdits: 3,
    slashArticles: ['le', 'la', "l'", 'un', 'une', 'les'],
    // `? ! : ;` keep their leading space in French; `.` and `,` do not.
    noSpaceBefore: '.,',
  },
  spoken: FRENCH_SPOKEN,
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
