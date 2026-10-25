/**
 * Language packs: everything that depends on the learning language (decision R13).
 * A deck names its language with a BCP-47 tag ("fr-FR"); the pack is found by the primary subtag.
 *
 * Only French is implemented. The written-answer rules (stage 3) live in `writing`,
 * the sound-based check of a spoken answer and numbers (stage 4.2, R22) in `spoken`,
 * the layout of the on-screen phone keyboard (stage 5, R31) in `keyboard`.
 * Before the first deck in a new language, check speech recognition and TTS for it
 * on the user's devices (especially lb-LU).
 *
 * Type-only imports, or `.ts` imports: this file is also run directly by Node in
 * scripts/validate-deck.ts.
 */
import { FRENCH_TEXTS } from './cyrillicData.ts';
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
   * Punctuation that does not count in a written answer (R26): missing or extra, it is
   * shown in a neutral colour and the verdict ignores it. Apostrophe and hyphen are
   * spelling and are not here. Must have the `g` flag.
   */
  ignoredPunctuation: RegExp | null;
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
 * (src/core/spoken.ts, R5, R22). Keys are lower case, œ → oe, æ → ae, one kind of
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

/**
 * A key of the bottom row (R41). Widths are in letter keys (a letter row is 10);
 * the space bar takes the rest of the row.
 */
export type BottomKey =
  | { kind: 'char'; char: string; width: number }
  | { kind: 'space' }
  | { kind: 'enter'; width: number };

/**
 * The on-screen phone keyboard (R6, R31, R41): letter rows, the bottom row and the
 * long-press variants. No digits: numbers are learnt spelt out.
 */
export interface KeyboardLayout {
  /** Letter rows, top to bottom, one key per character; the last one gets Shift and Backspace. */
  rows: readonly string[];
  /**
   * The bottom row, left to right: one space bar, one Enter, any character keys.
   * Absent or invalid (src/core/keyboard.ts, `bottomRowProblems`) → space and Enter only.
   */
  bottom?: readonly BottomKey[];
  /** Long press on a key offers these, in this order; the first is preselected. */
  variants: Readonly<Record<string, readonly string[]>>;
}

/** A character class matching any of these marks, with the `g` flag. */
export function marksPattern(marks: readonly string[]): RegExp {
  return new RegExp(`[${marks.map((m) => m.replace(/[\\\]^-]/g, '\\$&')).join('')}]`, 'g');
}

export interface LanguagePack extends LanguageSupport {
  /** Locale for speech recognition and TTS when the deck tag has no region. */
  defaultLocale: string;
  /** Language name in each interface language. */
  name: Record<UiLang, string>;
  /**
   * "In this language", ready-made for each interface language (R27): put into the
   * `speak` instruction and field ("Say it in French"). Never built from `name`:
   * the grammar differs. Absent → the plain "Say it" / "Type…".
   */
  inLanguage?: Record<UiLang, string>;
  /** "Voice check" (R33 item 14): a phrase the browser voice says, and the ready question after it. */
  voiceCheck?: { sample: string; question: Record<UiLang, string> };
  /** The on-screen phone keyboard (R31). */
  keyboard: KeyboardLayout;
  /** Rules for the written answer (skill `write`, R5). */
  writing: WritingRules;
  /** Rules for the spoken answer (skill `speak`, R5, R22). */
  spoken: SpokenRules;
}

/**
 * Punctuation never counted in a written French answer (R26, R41): these 13 marks,
 * unchanged since stage 5. Not the keyboard's list: the keyboard has its own (R41).
 */
const FRENCH_IGNORED_PUNCTUATION = ['.', ',', '?', '!', ':', ';', '…', '«', '»', '"', '“', '”', '„'] as const;

export const FRENCH: LanguagePack = {
  code: 'fr',
  defaultLocale: 'fr-FR',
  name: FRENCH_TEXTS.name,
  inLanguage: FRENCH_TEXTS.inLanguage,
  voiceCheck: {
    sample: "Bonjour ! Je m'appelle Marie. Un, deux, trois.",
    question: FRENCH_TEXTS.voiceCheckQuestion,
  },
  genders: ['m', 'f'],
  sameSound: (a, b) => soundsSame(a, b, FRENCH_SPOKEN),
  deckRules: {
    articles: ['le', 'la', "l'", 'les', 'un', 'une', 'des'],
    genderlessArticles: ["l'"],
    indefiniteArticles: ['un', 'une'],
    subjectPronouns: ['il', 'elle', 'ils', 'elles'],
    impersonal: [
      'il y a',
      'il faut',
      'il pleut',
      'il neige',
      'il fait',
      'il est temps',
      'il est tard',
      'il est tôt',
      'il vaut mieux',
      "il s'agit",
      'il manque',
      'il reste',
      'il semble',
      'il paraît',
      'il suffit',
    ],
    genderedNumbers: ['un', 'une'],
    genderEndings: [
      ['eux', 'euse'],
      ['eur', 'euse'],
      ['teur', 'trice'],
      ['if', 'ive'],
      ['er', 'ère'],
      ['on', 'onne'],
      ['en', 'enne'],
      ['et', 'ette'],
      ['el', 'elle'],
      ['', 'e'],
    ],
    informal: ['tu', 'toi', 'te', "t'", 'ton', 'ta', 'tes'],
    formal: ['vous', 'votre', 'vos'],
    notAddress: ['rendez-vous'],
  },
  keyboard: {
    rows: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
    // As Gboard on the owner's phone (R41): apostrophe in the place of ?123, Enter in the
    // place of search; the space bar takes its own place, the globe's and the rest.
    bottom: [
      { kind: 'char', char: "'", width: 1.35 },
      { kind: 'char', char: ',', width: 1 },
      { kind: 'space' },
      { kind: 'char', char: '.', width: 1 },
      { kind: 'enter', width: 1.4 },
    ],
    // The letters of R6, each on its base letter; on the apostrophe the hyphen first,
    // then the marks that "." offered before R41 except "," and ".".
    variants: {
      e: ['é', 'è', 'ê', 'ë'],
      a: ['à', 'â', 'æ'],
      c: ['ç'],
      i: ['î', 'ï'],
      o: ['ô', 'œ'],
      u: ['û', 'ù', 'ü'],
      "'": ['-', '?', '!', ':', ';', '…', '«', '»', '"', '“', '”', '„'],
    },
  },
  writing: {
    // French typography: a space before `? ! : ; »` and after `«`. Correct in print,
    // invisible on screen, not something to test the learner on.
    typographicSpace: /\s+(?=[?!:;»])|(?<=«)\s+/g,
    ignoredPunctuation: marksPattern(FRENCH_IGNORED_PUNCTUATION),
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
