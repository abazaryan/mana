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
/** `elision`: `le hôpital` for `l'hôpital` (Р24) — the written check only, never the ported cascade. */
export type ErrorType = 'diacritic' | 'typo' | 'article' | 'elision';

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
 * Note (Р3, Р16): a Mana deck entry has exactly one correct answer, so the app
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

// ---------- Character marks (Р22.9а) ----------

export type CharStatus = 'ok' | 'wrong' | 'missing' | 'extra' | 'diacritic';

/** One column: the typed character (top) over the reference character (bottom). */
export interface CharCell {
  status: CharStatus;
  /** Typed character as typed (case kept); null = empty cell (missing). */
  top: string | null;
  /** Reference character; null = empty cell (extra). */
  bottom: string | null;
}

export interface TypedCheck {
  evaluation: Evaluation;
  cells: CharCell[];
}

/** A folded character: `c` is compared, `d` is displayed (original case). */
interface FoldedChar {
  c: string;
  d: string;
}

/** Applies `re` (global) to the compared text: each match is removed or becomes one space. */
function replaceFolded(chars: FoldedChar[], re: RegExp, rep: '' | ' '): FoldedChar[] {
  const text = chars.map((x) => x.c).join('');
  const out: FoldedChar[] = [];
  let last = 0;
  for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
    out.push(...chars.slice(last, m.index));
    if (rep === ' ') out.push({ c: ' ', d: ' ' });
    last = m.index + m[0].length;
  }
  out.push(...chars.slice(last));
  return out;
}

/**
 * `normalize` with every kept character traced back to what was typed. The steps
 * mirror foldBasic + stripTypographicSpaces one for one; a test checks the compared
 * text always equals `normalize`.
 */
export function foldTraced(s: string, rules: WritingRules): FoldedChar[] {
  let chars: FoldedChar[] = s
    .normalize('NFC')
    .split('')
    .map((ch) => {
      const space = /[  ]/.test(ch);
      return { c: space ? ' ' : ch, d: space ? ' ' : ch };
    });
  chars = replaceFolded(chars, /\s*,\s*/g, ' ');
  chars = replaceFolded(chars, /^\s+|\s+$/g, '');
  chars = chars.map((x) => {
    const low = x.c.toLowerCase();
    return { c: low.length === 1 ? low : x.c, d: x.d };
  });
  chars = chars.map((x) => (/[’ʼ]/.test(x.c) ? { c: "'", d: x.d } : x));
  chars = replaceFolded(chars, /\s+/g, ' ');
  chars = replaceFolded(chars, TRAILING_STOP, '');
  if (rules.typographicSpace) chars = replaceFolded(chars, rules.typographicSpace, '');
  return chars;
}

function baseOf(c: string): string {
  return stripDiacritics(c);
}

function pairCell(a: FoldedChar, e: FoldedChar): CharCell {
  if (a.c === e.c) return { status: 'ok', top: a.d, bottom: e.d };
  return { status: baseOf(a.c) === baseOf(e.c) ? 'diacritic' : 'wrong', top: a.d, bottom: e.d };
}

/**
 * Character alignment over the same Damerau (optimal string alignment) distance the
 * verdict uses, so the number of marked edits equals `editDistance`. Done on reversed
 * strings, traced from their end (= the start of the originals): on a tie characters
 * are matched as early as possible and a gap goes as late as possible
 * ("apelle" for "appelle" marks the second p missing).
 */
function alignChars(e: FoldedChar[], a: FoldedChar[]): CharCell[] {
  const er = [...e].reverse();
  const ar = [...a].reverse();
  const n = er.length;
  const m = ar.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i]![0] = i;
  for (let j = 0; j <= m; j++) d[0]![j] = j;
  const same = (i: number, j: number) => er[i]!.c === ar[j]!.c;
  const swap = (i: number, j: number) =>
    i > 1 && j > 1 && er[i - 1]!.c === ar[j - 2]!.c && er[i - 2]!.c === ar[j - 1]!.c && !same(i - 1, j - 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (same(i - 1, j - 1) ? 0 : 1));
      if (swap(i, j)) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  const cells: CharCell[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const here = d[i]![j]!;
    if (i > 0 && j > 0 && same(i - 1, j - 1) && here === d[i - 1]![j - 1]!) {
      cells.push(pairCell(ar[j - 1]!, er[i - 1]!));
      i--;
      j--;
    } else if (i > 0 && j > 0 && here === d[i - 1]![j - 1]! + 1) {
      cells.push(pairCell(ar[j - 1]!, er[i - 1]!));
      i--;
      j--;
    } else if (swap(i, j) && here === d[i - 2]![j - 2]! + 1) {
      // A transposition is one edit; both characters are shown wrong.
      cells.push({ status: 'wrong', top: ar[j - 1]!.d, bottom: er[i - 1]!.d });
      cells.push({ status: 'wrong', top: ar[j - 2]!.d, bottom: er[i - 2]!.d });
      i -= 2;
      j -= 2;
    } else if (i > 0 && here === d[i - 1]![j]! + 1) {
      cells.push({ status: 'missing', top: null, bottom: er[i - 1]!.d });
      i--;
    } else {
      cells.push({ status: 'extra', top: ar[j - 1]!.d, bottom: null });
      j--;
    }
  }
  return cells;
}

/**
 * The written-answer verdict together with its character marks (Р22.9а). The marks
 * are built from the step of the cascade that decided the verdict, on the same
 * folded text, so the colours cannot disagree with it:
 * correct → all ok; article → the article missing, the rest ok; diacritic → only
 * diacritic cells; typo / incorrect → the alignment of the edit distance.
 * Characters the folding ignores (comma, closing stop, typographic space) are not shown.
 */
export function checkTyped(expected: string, actual: string, rules: WritingRules): TypedCheck {
  const evaluation = evaluate(expected, actual, rules);
  const e = foldTraced(expected, rules);
  const a = foldTraced(actual, rules);
  const positional = () => e.map((x, k) => pairCell(a[k]!, x));

  if (evaluation.verdict === 'correct') return { evaluation, cells: positional() };
  if (evaluation.errorType === 'article') {
    const k = e.length - a.length;
    const cells: CharCell[] = e.slice(0, k).map((x) => ({ status: 'missing', top: null, bottom: x.d }));
    e.slice(k).forEach((x, idx) => cells.push(pairCell(a[idx]!, x)));
    return { evaluation, cells };
  }
  if (evaluation.errorType === 'diacritic' && e.length === a.length) return { evaluation, cells: positional() };
  return { evaluation, cells: alignChars(e, a) };
}

/**
 * Display blocks (Р22.9г): cells grouped by word so a block wraps as a whole and the
 * typed text stays over the reference. A block ends where either line has a space;
 * a space that is itself an error (missing, extra, or against a letter) is kept as
 * a block of its own so it stays visible.
 */
export function charBlocks(cells: readonly CharCell[]): CharCell[][] {
  const blocks: CharCell[][] = [];
  let cur: CharCell[] = [];
  const flush = () => {
    if (cur.length > 0) blocks.push(cur);
    cur = [];
  };
  for (const cell of cells) {
    if (cell.top === ' ' || cell.bottom === ' ') {
      flush();
      if (cell.status !== 'ok') blocks.push([cell]);
    } else {
      cur.push(cell);
    }
  }
  flush();
  return blocks;
}

// ---------- The article in `write` (Р24) ----------

/** What the entry says about the article it asks for (Р16, Р24). */
export interface ArticleForm {
  /** The entry has the hint `form.determiner`: the article is part of the question. */
  determiner: boolean;
  /** Gender of the word (`form.gender`, else the entry's `gender`): tells `le hôpital` from `la hôpital`. */
  gender?: 'm' | 'f' | 'n';
}

const ELIDED = "l'";
const ELIDABLE: Readonly<Record<string, 'm' | 'f'>> = { le: 'm', la: 'f' };

function splitArticle(s: string, rules: WritingRules): { article: string; rest: string } | null {
  if (!rules.leadingArticle) return null;
  const m = s.match(rules.leadingArticle);
  return m ? { article: m[1]!.trim(), rest: s.slice(m[0].length) } : null;
}

/**
 * The verdict of a written answer (skill `write`, intro copy-out) with Р24 on top of
 * the ported cascade. The article carries the gender, and `write` is the only skill
 * that checks it (Р23.4):
 *   another article → incorrect (`article`), with or without the form hint;
 *   no article where the entry has the hint → incorrect (`article`);
 *   no article without the hint → almost (`article`), as in the cascade;
 *   `le`/`la` where the word takes `l'` (or the other way) → almost (`elision`),
 *   unless the gender of the entry says `le`/`la` itself is wrong.
 * Stricter than the voice rule (Р22.2), which stays as it is.
 */
export function checkWritten(expected: string, actual: string, rules: WritingRules, form: ArticleForm): TypedCheck {
  const base = checkTyped(expected, actual, rules);
  const e = normalize(expected, rules);
  const a = normalize(actual, rules);
  const re = splitArticle(e, rules);
  if (!re || a.length === 0) return base;
  const align = (evaluation: Evaluation): TypedCheck => ({
    evaluation,
    cells: alignChars(foldTraced(expected, rules), foldTraced(actual, rules)),
  });
  const ra = splitArticle(a, rules);
  if (ra) {
    if (ra.article === re.article) return base;
    const restOk = evaluate(re.rest, ra.rest, rules).verdict !== 'incorrect';
    if (ra.rest === re.rest) {
      const typedGender = ELIDABLE[ra.article];
      if (re.article === ELIDED && typedGender && (!form.gender || form.gender === typedGender)) {
        return align({ verdict: 'almost', errorType: 'elision' });
      }
      if (ra.article === ELIDED && ELIDABLE[re.article]) return align({ verdict: 'almost', errorType: 'elision' });
    }
    return align(restOk ? { verdict: 'incorrect', errorType: 'article' } : { verdict: 'incorrect' });
  }
  if (base.evaluation.errorType === 'article' && form.determiner) {
    return { evaluation: { verdict: 'incorrect', errorType: 'article' }, cells: base.cells };
  }
  return base;
}
