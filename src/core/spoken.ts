/**
 * Sound-based check of a spoken answer (skill `speak`, Р5, Р22), also used for an
 * answer typed in `speak`. Language-neutral: every language rule comes from the
 * pack (src/core/languages.ts → SpokenRules).
 *
 * The same word alignment gives the verdict, the per-word marks and the display
 * blocks, so the colours cannot disagree with the rating.
 *
 * Spelling is not checked here: that is the written-answer cascade (evaluate.ts).
 */
import type { Verdict } from './evaluate';
import type { EndingRule, SpokenRules } from './languages';

/** Share of reference words that may be unsaid and still give "almost" (Р22.2). */
export const ALMOST_UNSAID_SHARE = 0.25;

/** Rule id for a number said in words and written in digits (or the other way round). */
export const DIGITS_RULE = 'Ч';

export interface SpokenToken {
  /** Comparison key: lower case, œ → oe, apostrophe kept on elided words (`l'`). */
  key: string;
  /** As written in the source (for a number: the digits, e.g. "21"). */
  text: string;
  /** Written word the token belongs to (index): elisions and hyphens stay in one word. */
  word: number;
  /** Tokens spelled out from one number share this id; null otherwise. */
  num: number | null;
}

export type SpokenStatus = 'ok' | 'sound' | 'other' | 'missing' | 'extra';

export interface SpokenOp {
  status: SpokenStatus;
  /** Index into the reference tokens (absent for `extra`). */
  ref?: number;
  /** Index into the heard tokens (absent for `missing`). */
  heard?: number;
  /** Rule that made two different spellings match (`sound`). */
  rule?: string;
}

export type SpokenErrorType = 'article' | 'extra' | 'words';

export interface SpokenCheck {
  verdict: Verdict;
  errorType: SpokenErrorType | null;
  /** The answer that was checked (the chosen recognizer alternative). */
  answer: string;
  /** Index of that alternative; 0 for a typed answer. */
  altIndex: number;
  ref: SpokenToken[];
  heard: SpokenToken[];
  ops: SpokenOp[];
  /** N: words in the reference. */
  words: number;
  /** E: reference words not heard (missing or another word). */
  unsaid: number;
  /** Extra heard words (fillers excluded). */
  extra: number;
  /** Sound rules that matched, without repeats. */
  rules: string[];
}

export interface SpokenOptions {
  /** The entry shows a `determiner` hint (Р16): a wrong or extra article is incorrect. */
  determiner?: boolean;
}

// ---------- Tokens ----------

const APOSTROPHES = /[’ʼ‘`´]/g;
/** Characters that end a written word (everything but letters, digits, apostrophe, hyphen). */
const WORD_SPLIT = /[^\p{L}\p{M}\p{N}'-]+/u;

function keyOf(s: string): string {
  return s.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');
}

/** "1 000", "1.000" → "1000" (only groups of exactly three digits). */
function joinThousands(s: string): string {
  return s.replace(/(\d)[  .](?=\d{3}(?!\d))/g, '$1');
}

function expandAbbreviations(s: string, rules: SpokenRules): string {
  let out = s;
  for (const [abbr, word] of Object.entries(rules.abbreviations)) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(^|[^\\p{L}])${escaped}(?=$|[^\\p{L}])`, 'giu'), `$1${word}`);
  }
  return out;
}

/** "l'ami" → ["l'", "ami"]; "est-ce" → ["est", "ce"]. */
function splitWord(w: string): string[] {
  return w
    .split('-')
    .flatMap((part) => part.match(/[^']+'|[^']+/g) ?? [])
    .filter((p) => p !== "'");
}

/**
 * Tokens of an answer or a reference. Numbers in digits become words (21 → vingt et
 * un); fillers are dropped. Written words are split by spaces and punctuation; an
 * elision or a hyphen keeps its parts in one word (je m'appelle = 2 words).
 */
export function tokenizeSpoken(text: string, rules: SpokenRules): SpokenToken[] {
  const s = expandAbbreviations(joinThousands(text.normalize('NFC').replace(APOSTROPHES, "'")), rules);
  const raw = s.split(WORD_SPLIT).map((w) => w.replace(/^[-']+|-+$/g, '')).filter(Boolean);
  // A word ending in an apostrophe ("l' ami") belongs to the next one.
  const words: string[] = [];
  for (const w of raw) {
    const prev = words[words.length - 1];
    if (prev !== undefined && prev.endsWith("'")) words[words.length - 1] = prev + w;
    else words.push(w);
  }

  const tokens: SpokenToken[] = [];
  let word = 0;
  let num = 0;
  for (const w of words) {
    let added = false;
    for (const part of splitWord(w)) {
      const key = keyOf(part);
      if (rules.fillers.includes(key)) continue;
      const spelled = spellNumber(key, rules);
      if (spelled) {
        for (const k of spelled) tokens.push({ key: k, text: part, word, num });
        num++;
      } else {
        tokens.push({ key, text: part, word, num: null });
      }
      added = true;
    }
    if (added) word++;
  }
  return tokens;
}

function spellNumber(key: string, rules: SpokenRules): string[] | null {
  let words: string | null = null;
  if (/^\d+$/.test(key)) {
    words = rules.cardinal(Number(key));
  } else {
    const m = rules.ordinalSuffix.exec(key);
    if (m) words = rules.ordinal(Number(m[1]), rules.feminineOrdinalSuffixes.includes(m[2]!));
  }
  return words === null ? null : words.split(/[\s-]+/).filter(Boolean);
}

/** Number of written words. */
export function countSpokenWords(tokens: readonly SpokenToken[]): number {
  return new Set(tokens.map((t) => t.word)).size;
}

// ---------- Sound match ----------

function startsLiaison(tokens: readonly SpokenToken[], i: number, rules: SpokenRules): boolean {
  const next = tokens[i + 1];
  return next !== undefined && rules.liaisonNext.test(next.key);
}

/** ils / elles before tokens[i], with at most three clitics between (ils ne le parlent). */
function afterPluralSubject(tokens: readonly SpokenToken[], i: number, rules: SpokenRules): boolean {
  let k = i - 1;
  for (let skipped = 0; k >= 0 && skipped < 3 && rules.subjectClitics.includes(tokens[k]!.key); skipped++) k--;
  return k >= 0 && rules.pluralSubjects.includes(tokens[k]!.key);
}

function endingRuleMatches(
  rule: EndingRule,
  ref: readonly SpokenToken[],
  i: number,
  heard: readonly SpokenToken[],
  j: number,
  rules: SpokenRules,
): boolean {
  const r = ref[i]!.key;
  const h = heard[j]!.key;
  if (rule.exceptions && (rule.exceptions.includes(r) || rule.exceptions.includes(h))) return false;
  for (const er of rule.endings) {
    if (!r.endsWith(er)) continue;
    const stem = r.slice(0, r.length - er.length);
    if (stem.length < rule.minStem) continue;
    if (rule.stemPattern && !rule.stemPattern.test(stem)) continue;
    for (const eh of rule.endings) {
      if (eh === er || h !== stem + eh) continue;
      if (rule.pluralSubject !== undefined) {
        if (er === rule.pluralSubject && !afterPluralSubject(ref, i, rules)) continue;
        if (eh === rule.pluralSubject && !afterPluralSubject(heard, j, rules)) continue;
      }
      // One of the two ends in a consonant that liaison may sound before a vowel.
      if (rules.liaisonFinal.test(r) !== rules.liaisonFinal.test(h)) {
        if (startsLiaison(ref, i, rules) || startsLiaison(heard, j, rules)) continue;
      }
      return true;
    }
  }
  return false;
}

/**
 * Rule by which heard[j] sounds like ref[i] although spelled differently; null if
 * they are different words. Neighbours matter: ils before -ent, liaison.
 */
export function soundRule(
  ref: readonly SpokenToken[],
  i: number,
  heard: readonly SpokenToken[],
  j: number,
  rules: SpokenRules,
): string | null {
  const r = ref[i]!.key;
  const h = heard[j]!.key;
  if (r === h) return null;
  for (const c of rules.wordClasses) if (c.words.includes(r) && c.words.includes(h)) return c.id;
  for (const rule of rules.endingRules) if (endingRuleMatches(rule, ref, i, heard, j, rules)) return rule.id;
  return null;
}

// ---------- Alignment ----------

/**
 * Word alignment: a match (exact or by sound) costs 0, a missing or an extra word 1,
 * another word 2 (= one missing + one extra). So the alignment keeps as many matches
 * as possible, which is what the verdict counts (E = reference words not matched).
 * On a tie a substitution beats a missing + extra pair (shown as "recognised as
 * another word"), and words are matched as early as possible (reading order):
 * "très très bien" ← "très bien" marks the second "très" missing.
 *
 * Done on reversed sequences and traced back from their end — i.e. from the start
 * of the originals — so the early choices are the preferred ones.
 */
export function alignSpoken(
  ref: readonly SpokenToken[],
  heard: readonly SpokenToken[],
  rules: SpokenRules,
): SpokenOp[] {
  const n = ref.length;
  const m = heard.length;
  // Reversed index → original index.
  const ri = (k: number) => n - 1 - k;
  const hj = (k: number) => m - 1 - k;
  const match: (string | null | false)[][] = [];
  // match[a][b]: '' exact, rule id by sound, false different; a, b reversed indices.
  for (let a = 0; a < n; a++) {
    const row: (string | false)[] = [];
    for (let b = 0; b < m; b++) {
      const i = ri(a);
      const j = hj(b);
      if (ref[i]!.key === heard[j]!.key) row.push('');
      else row.push(soundRule(ref, i, heard, j, rules) ?? false);
    }
    match.push(row);
  }
  const cost = (a: number, b: number) => (match[a]![b] === false ? 2 : 0);

  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let a = 0; a <= n; a++) d[a]![0] = a;
  for (let b = 0; b <= m; b++) d[0]![b] = b;
  for (let a = 1; a <= n; a++) {
    for (let b = 1; b <= m; b++) {
      d[a]![b] = Math.min(d[a - 1]![b]! + 1, d[a]![b - 1]! + 1, d[a - 1]![b - 1]! + cost(a - 1, b - 1));
    }
  }

  const ops: SpokenOp[] = [];
  let a = n;
  let b = m;
  while (a > 0 || b > 0) {
    if (a > 0 && b > 0 && d[a]![b] === d[a - 1]![b - 1]! + cost(a - 1, b - 1)) {
      const mt = match[a - 1]![b - 1]!;
      const i = ri(a - 1);
      const j = hj(b - 1);
      if (mt === false) ops.push({ status: 'other', ref: i, heard: j });
      else if (mt !== '') ops.push({ status: 'sound', ref: i, heard: j, rule: mt });
      // Same word, but one side was digits (21 = vingt et un): shown as matched by sound.
      else if ((ref[i]!.num === null) !== (heard[j]!.num === null)) ops.push({ status: 'sound', ref: i, heard: j, rule: DIGITS_RULE });
      else ops.push({ status: 'ok', ref: i, heard: j });
      a--;
      b--;
    } else if (a > 0 && d[a]![b] === d[a - 1]![b]! + 1) {
      ops.push({ status: 'missing', ref: ri(a - 1) });
      a--;
    } else {
      ops.push({ status: 'extra', heard: hj(b - 1) });
      b--;
    }
  }
  return ops;
}

// ---------- Verdict ----------

const VERDICT_RANK: Record<Verdict, number> = { correct: 0, almost: 1, incorrect: 2 };

function judge(
  ref: readonly SpokenToken[],
  heard: readonly SpokenToken[],
  ops: readonly SpokenOp[],
  rules: SpokenRules,
  opts: SpokenOptions,
): Pick<SpokenCheck, 'verdict' | 'errorType' | 'words' | 'unsaid' | 'extra'> {
  const isArticle = (t: SpokenToken) => rules.articles.includes(t.key);
  const words = countSpokenWords(ref);
  const unsaidOps = ops.filter((o) => o.status === 'missing' || o.status === 'other');
  const unsaid = new Set(unsaidOps.map((o) => ref[o.ref!]!.word)).size;
  const extraOps = ops.filter((o) => o.status === 'extra');
  const extra = extraOps.length;
  const base = { words, unsaid, extra };

  if (opts.determiner) {
    const wrongArticle = unsaidOps.some((o) => o.status === 'other' && isArticle(ref[o.ref!]!));
    const extraArticle = extraOps.some((o) => isArticle(heard[o.heard!]!));
    if (wrongArticle || extraArticle) return { ...base, verdict: 'incorrect', errorType: 'article' };
  }
  if (unsaid === 0 && extra === 0) return { ...base, verdict: 'correct', errorType: null };
  if (unsaid === 0) return { ...base, verdict: 'almost', errorType: 'extra' };
  if (unsaidOps.length === 1 && isArticle(ref[unsaidOps[0]!.ref!]!)) {
    return { ...base, verdict: 'almost', errorType: 'article' };
  }
  if (unsaid <= Math.floor(ALMOST_UNSAID_SHARE * words)) return { ...base, verdict: 'almost', errorType: 'words' };
  return { ...base, verdict: 'incorrect', errorType: 'words' };
}

function checkOne(expected: string, answer: string, altIndex: number, rules: SpokenRules, opts: SpokenOptions): SpokenCheck {
  const ref = tokenizeSpoken(expected, rules);
  const heard = tokenizeSpoken(answer, rules);
  const ops = alignSpoken(ref, heard, rules);
  const found = ops.flatMap((o) => (o.rule ? [o.rule] : []));
  return { answer, altIndex, ref, heard, ops, rules: [...new Set(found)], ...judge(ref, heard, ops, rules, opts) };
}

/**
 * Checks the recognizer alternatives (or one typed answer) against the reference and
 * keeps the best: by verdict, then fewer unsaid words, then fewer extra words, then
 * the recognizer's own order. No alternatives = nothing heard.
 */
export function checkSpoken(
  expected: string,
  alternatives: readonly string[],
  rules: SpokenRules,
  opts: SpokenOptions = {},
): SpokenCheck {
  const alts = alternatives.length > 0 ? alternatives : [''];
  let best: SpokenCheck | null = null;
  alts.forEach((alt, k) => {
    const c = checkOne(expected, alt, k, rules, opts);
    if (
      best === null ||
      VERDICT_RANK[c.verdict] < VERDICT_RANK[best.verdict] ||
      (VERDICT_RANK[c.verdict] === VERDICT_RANK[best.verdict] &&
        (c.unsaid < best.unsaid || (c.unsaid === best.unsaid && c.extra < best.extra)))
    ) {
      best = c;
    }
  });
  return best!;
}

// ---------- Live progress (intro "say it aloud") ----------

/**
 * While the learner is still speaking: which reference tokens are already heard
 * (exactly or by sound). The not-yet-said end of the reference is no error, so the
 * alignment lets it go free; nothing is judged here — the final result is.
 */
export function liveHeard(expected: string, interim: string, rules: SpokenRules): boolean[] {
  const ref = tokenizeSpoken(expected, rules);
  const heard = tokenizeSpoken(interim, rules);
  const marks = new Array<boolean>(ref.length).fill(false);
  if (heard.length === 0) return marks;
  // Best prefix of the reference to align the interim text against.
  let bestLen = 0;
  let bestCost = Infinity;
  for (let len = 0; len <= ref.length; len++) {
    const ops = alignSpoken(ref.slice(0, len), heard, rules);
    const c = ops.filter((o) => o.status !== 'ok' && o.status !== 'sound').length;
    if (c < bestCost) {
      bestCost = c;
      bestLen = len;
    }
  }
  for (const o of alignSpoken(ref.slice(0, bestLen), heard, rules)) {
    if ((o.status === 'ok' || o.status === 'sound') && o.ref !== undefined) marks[o.ref] = true;
  }
  return marks;
}

// ---------- Display blocks ----------

/** One column of a block: what was heard (top) over the reference (bottom). */
export interface SpokenCell {
  status: SpokenStatus;
  /** Heard text; null = empty cell (the word was not said). */
  top: string | null;
  /** Reference text; null = empty cell (an extra word). */
  bottom: string | null;
  rule?: string;
}

/**
 * Display blocks (Р22.9г): a block holds the cells of one written word on either
 * side and wraps as a whole, so the heard text always stays over the reference.
 * A number spelled out from digits shows its digits once ("21" over "vingt et un").
 */
export function spokenBlocks(c: Pick<SpokenCheck, 'ref' | 'heard' | 'ops'>): SpokenCell[][] {
  const blocks: SpokenCell[][] = [];
  let prev: SpokenOp | null = null;
  for (const op of c.ops) {
    const r = op.ref !== undefined ? c.ref[op.ref]! : null;
    const h = op.heard !== undefined ? c.heard[op.heard]! : null;
    const pr = prev?.ref !== undefined ? c.ref[prev.ref]! : null;
    const ph = prev?.heard !== undefined ? c.heard[prev.heard]! : null;
    const sameWord = (r !== null && pr !== null && r.word === pr.word) || (h !== null && ph !== null && h.word === ph.word);
    const top = h === null ? null : h.num !== null && ph !== null && ph.num === h.num ? '' : h.text;
    const bottom = r === null ? null : r.num !== null && pr !== null && pr.num === r.num ? '' : r.text;
    const cell: SpokenCell = { status: op.status, top, bottom, ...(op.rule ? { rule: op.rule } : {}) };
    if (sameWord && blocks.length > 0) blocks[blocks.length - 1]!.push(cell);
    else blocks.push([cell]);
    prev = op;
  }
  return blocks;
}
