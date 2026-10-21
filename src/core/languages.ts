/**
 * Language packs: everything that depends on the learning language (decision Р13).
 * A deck names its language with a BCP-47 tag ("fr-FR"); the pack is found by the primary subtag.
 *
 * Only French is implemented. The written-answer rules (stage 3) live in `writing`,
 * the sound-based check of a spoken answer and numbers (stage 4.2, Р22) in `spoken`,
 * the layout of the on-screen phone keyboard (stage 5, Р31) in `keyboard`.
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
   * Punctuation that does not count in a written answer (Р26): missing or extra, it is
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

/**
 * The on-screen phone keyboard (Р6, Р31): letter rows, the keys around the space bar
 * and the long-press variants. No digits: numbers are learnt spelt out.
 */
export interface KeyboardLayout {
  /** Letter rows, top to bottom, one key per character; the last one gets Shift and Backspace. */
  rows: readonly string[];
  /** Keys left of the space bar. */
  beforeSpace: readonly string[];
  /** Keys right of the space bar (before Enter). */
  afterSpace: readonly string[];
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
   * "In this language", ready-made for each interface language (Р27): put into the
   * `speak` instruction and field ("Ба фаронсавӣ бигӯед"). Never built from `name`:
   * the grammar differs. Absent → the plain "Say it" / "Type…".
   */
  inLanguage?: Record<UiLang, string>;
  /** "Voice check" (Р33 п. 14): a phrase the browser voice says, and the ready question after it. */
  voiceCheck?: { sample: string; question: Record<UiLang, string> };
  /** The on-screen phone keyboard (Р31). */
  keyboard: KeyboardLayout;
  /** Rules for the written answer (skill `write`, Р5). */
  writing: WritingRules;
  /** Rules for the spoken answer (skill `speak`, Р5, Р22). */
  spoken: SpokenRules;
}

/**
 * Punctuation of a French answer: never counted in a written answer (Р26) and offered
 * by a long press on "." of the on-screen keyboard (Р31). One list for both.
 */
const FRENCH_PUNCTUATION = ['.', ',', '?', '!', ':', ';', '…', '«', '»', '"', '“', '”', '„'] as const;

export const FRENCH: LanguagePack = {
  code: 'fr',
  defaultLocale: 'fr-FR',
  name: { tg: 'фаронсавӣ', ru: 'французский', en: 'French' },
  inLanguage: { tg: 'ба фаронсавӣ', ru: 'по-французски', en: 'in French' },
  voiceCheck: {
    sample: "Bonjour ! Je m'appelle Marie. Un, deux, trois.",
    question: { tg: 'Садои фаронсавиро шунидед?', ru: 'Слышен французский голос?', en: 'Did you hear a French voice?' },
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
    beforeSpace: ["'", '-'],
    afterSpace: ['.'],
    // The letters of Р6, each on its base letter.
    variants: {
      e: ['é', 'è', 'ê', 'ë'],
      a: ['à', 'â', 'æ'],
      c: ['ç'],
      i: ['î', 'ï'],
      o: ['ô', 'œ'],
      u: ['û', 'ù', 'ü'],
      '.': FRENCH_PUNCTUATION.filter((m) => m !== '.'),
    },
  },
  writing: {
    // French typography: a space before `? ! : ; »` and after `«`. Correct in print,
    // invisible on screen, not something to test the learner on.
    typographicSpace: /\s+(?=[?!:;»])|(?<=«)\s+/g,
    ignoredPunctuation: marksPattern(FRENCH_PUNCTUATION),
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
