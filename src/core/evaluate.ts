/**
 * Written-answer cascade (skill `write`, Р5). Ported from LivreVivant
 * (src/lib/learning/evaluate.ts @ 503f4af); language rules moved into the
 * language pack (Р13).
 *
 * fold (case / spaces / apostrophes / comma / closing stop / typographic spaces)
 * → missing article → diacritics only → small typo (bounded edit distance).
 * A diacritic slip or a small typo is "almost", never a plain fail.
 *
 * Spelling only: never use this for the spoken answer. Homophones (vert/verre)
 * sound the same, and a sound-correct answer would score `incorrect` here.
 */
import type { WritingRules } from './languages';
import type { Alternate } from './printConventions';

export type Verdict = 'correct' | 'almost' | 'incorrect';
export type ErrorType = 'diacritic' | 'typo' | 'article';

export interface Evaluation {
  verdict: Verdict;
  /** Set only when `almost`; goes to the review log. */
  errorType?: ErrorType;
  /**
   * Set only when `correct`: right, but typed without the typographic space the
   * reference carries (`ça va?` for `ça va ?`). A hint for the UI, never an error.
   */
  typographyNote?: true;
}

/**
 * A run of full stops and/or ellipses (U+2026) closing the string, with the
 * spaces hugging it. Anchored at the end: an ellipsis mid-phrase is content.
 */
const TRAILING_STOP = /\s*[.…][\s.…]*$/;

/**
 * Differences that still count as `correct`: NFC; no-break spaces (U+00A0,
 * U+202F) → plain space (no phone keyboard types them); the comma and the
 * spaces around it → one space (printed punctuation, not recalled); case;
 * curly/modifier apostrophes; repeated spaces; a closing full stop or ellipsis.
 * `?` and `!` stay: they carry the sentence type.
 *
 * Known limit: an abbreviation folds too, so `M.` equals `M`.
 */
function foldBasic(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[  ]/g, ' ')
    .replace(/\s*,\s*/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[’ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(TRAILING_STOP, '');
}

function stripTypographicSpaces(s: string, rules: WritingRules): string {
  return rules.typographicSpace ? s.replace(rules.typographicSpace, '') : s;
}

function countTypographicSpaces(s: string, rules: WritingRules): number {
  return rules.typographicSpace ? (s.match(rules.typographicSpace) ?? []).length : 0;
}

/** Full folding: everything two answers may differ in and still both be right. */
export function normalize(s: string, rules: WritingRules): string {
  return stripTypographicSpaces(foldBasic(s), rules);
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Damerau edit distance, optimal string alignment: an adjacent transposition
 * (`bonjuor`) is one edit, as it is the most common real typo.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const d: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  const at = (i: number, j: number): number => d[i]![j]!;
  for (let i = 0; i <= a.length; i++) d[i]![0] = i;
  for (let j = 0; j <= b.length; j++) d[0]![j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, at(i - 2, j - 2) + 1);
      }
      d[i]![j] = v;
    }
  }
  return at(a.length, b.length);
}

/** Rank for picking the kindest verdict across several accepted forms. */
const VERDICT_RANK: Record<Verdict, number> = { correct: 0, almost: 1, incorrect: 2 };

/**
 * Grade a typed answer against the reference and every accepted alternate.
 *
 * An alternate with a `form` tag is not accepted: it has its own card, and
 * accepting it here would mean that form is never asked for. The best verdict
 * wins; the reference breaks ties.
 *
 * Note (Р3, Р16): a Sluh deck entry has exactly one correct answer, so the app
 * passes no alternates; the parameter is kept from the ported module.
 */
export function evaluate(
  expected: string,
  actual: string,
  rules: WritingRules,
  alternates: readonly Alternate[] = [],
): Evaluation {
  let best = evaluateAgainst(expected, actual, rules);
  for (const alt of alternates) {
    if (best.verdict === 'correct') break;
    if (alt.form !== undefined) continue;
    const candidate = evaluateAgainst(alt.text, actual, rules);
    if (VERDICT_RANK[candidate.verdict] < VERDICT_RANK[best.verdict]) best = candidate;
  }
  return best;
}

function evaluateAgainst(expected: string, actual: string, rules: WritingRules): Evaluation {
  const eFolded = foldBasic(expected);
  const aFolded = foldBasic(actual);
  const e = stripTypographicSpaces(eFolded, rules);
  const a = stripTypographicSpaces(aFolded, rules);

  if (a.length === 0) return { verdict: 'incorrect' };
  if (e === a) {
    // Any remaining difference is the typographic spaces; note it only when the
    // reference has more of them than the answer.
    return countTypographicSpaces(eFolded, rules) > countTypographicSpaces(aFolded, rules)
      ? { verdict: 'correct', typographyNote: true }
      : { verdict: 'correct' };
  }

  // The word is there, the article is not: recalled, but the gender is missing.
  if (rules.leadingArticle) {
    const withoutArticle = e.replace(rules.leadingArticle, '');
    if (withoutArticle !== e && withoutArticle === a) {
      return { verdict: 'almost', errorType: 'article' };
    }
  }

  if (stripDiacritics(e) === stripDiacritics(a)) {
    return { verdict: 'almost', errorType: 'diacritic' };
  }

  const maxTypo = Math.min(rules.typoMaxEdits, Math.floor(e.length / rules.typoCharsPerEdit));
  if (editDistance(e, a) <= maxTypo) {
    return { verdict: 'almost', errorType: 'typo' };
  }

  return { verdict: 'incorrect' };
}
