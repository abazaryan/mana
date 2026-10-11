/**
 * Print conventions: compact ways a word list prints two forms of one item —
 * `enchanté(e)`, `A ? / B ?`, `le/la X(e)`. A learner never types a bracket or a
 * slash. This module turns such a printed form into the reference form plus the
 * alternates it packed, and reports what it did so the gloss can be given the
 * same treatment. Ported from LivreVivant (src/lib/content/print-conventions.ts
 * @ 503f4af) without the curated annotation-synonym list; language rules come
 * from the language pack (Р13).
 *
 * Note (Р3, Р16): Sluh decks do not use print conventions — every form is its
 * own entry with a `form` hint, and the validator warns about `(` or `/` left in
 * `text`. The app does not use this module today; it is kept, with its tests,
 * for one-off converters of printed word lists and for `lexemeKey`.
 */
import type { WritingRules } from './languages';

export type AlternateSource = 'bracket' | 'slash' | 'manual';

/** One accepted form beside the reference, with the convention it came from. */
export interface Alternate {
  text: string;
  /** Mechanical provenance only — never a grammatical claim. */
  source: AlternateSource;
  /**
   * A grammatical form practised on its own card (e.g. a feminine). A tagged
   * alternate is not accepted as the answer of the reference card.
   */
  form?: string;
}

/** Which conventions were applied to the reference's own part. */
export interface AppliedConventions {
  /** A bracket packing a form was expanded (`italien(ne)`). */
  bracket: boolean;
  /** A spaced slash was split (`A / B`). */
  slash: boolean;
}

export interface Expansion {
  canon: string;
  alternates: Alternate[];
  applied: AppliedConventions;
  /**
   * A slash with no spaces round it. Two objects (`Paris/Lyon`) or two forms of
   * one word (`voisin/voisine`) is a meaning call — see `splitByMeaning`.
   */
  bareSlash: boolean;
  /** Brackets dropped without yielding a form, e.g. `(m.)` in `l'arbre (m.)`. */
  droppedAnnotations: string[];
}

/** The separator of two phrasings: a slash *with spaces*. */
const SLASH = ' / ';

const BRACKET = /\(([^)]*)\)/g;

/**
 * Comparison form of a text: NFC, lowercase, straight apostrophes, single
 * spaces, trimmed. Diacritics survive on purpose: `e` and `é` are different
 * letters.
 */
export function foldText(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whitespace tidy-up by the language's rule: no space before `rules.noSpaceBefore`. */
function tidyText(s: string, rules: WritingRules): string {
  const out = s.replace(/\s+/g, ' ');
  if (rules.noSpaceBefore.length === 0) return out.trim();
  const before = new RegExp(`\\s+([${escapeRegExp(rules.noSpaceBefore)}])`, 'g');
  return out.replace(before, '$1').trim();
}

/** Tidy-up for a gloss (tg / ru / en): no punctuation takes a leading space. */
function tidyGloss(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:)])/g, '$1')
    .trim();
}

/**
 * A bracket packs a form when it is attached to the word (`italien(ne)`, no
 * space before it) and holds letters only. A detached or punctuated bracket is
 * an annotation (`l'arbre (m.)`): inlining it would invent `l'arbrem.`.
 */
function packsAForm(part: string, match: RegExpMatchArray): boolean {
  const start = match.index ?? 0;
  const attached = start > 0 && !/\s/.test(part[start - 1] ?? '');
  return attached && /^\p{L}+$/u.test(match[1] ?? '');
}

interface PartExpansion {
  /** Every reading, the canonical one (all brackets dropped) first. */
  variants: string[];
  hadForm: boolean;
  annotations: string[];
}

function expandPart(part: string, rules: WritingRules): PartExpansion {
  const matches = [...part.matchAll(BRACKET)];
  if (matches.length === 0) {
    return { variants: [tidyText(part, rules)], hadForm: false, annotations: [] };
  }

  const forms = matches.filter((m) => packsAForm(part, m));
  const annotations = matches.filter((m) => !packsAForm(part, m)).map((m) => m[0]);

  const variants: string[] = [];
  for (let mask = 0; mask < 1 << forms.length; mask++) {
    let out = '';
    let cursor = 0;
    let formIndex = 0;
    for (const m of matches) {
      const start = m.index ?? 0;
      out += part.slice(cursor, start);
      if (forms.includes(m)) {
        if (mask & (1 << formIndex)) out += m[1] ?? '';
        formIndex++;
      }
      cursor = start + m[0].length;
    }
    out += part.slice(cursor);
    variants.push(tidyText(out, rules));
  }
  return { variants, hadForm: forms.length > 0, annotations };
}

/** `^(le|la|…)/(le|la|…)\s+(.+)$` for the language's articles; null if it has none. */
export function articleSlashPattern(rules: WritingRules): RegExp | null {
  if (rules.slashArticles.length === 0) return null;
  const alt = rules.slashArticles.map(escapeRegExp).join('|');
  return new RegExp(`^(${alt})\\/(${alt})\\s+(.+)$`, 'u');
}

/**
 * Two articles round a bare slash at the very start: `le/la voisin(e)`. The
 * first reading drops every bracket, the second inlines all of them — together,
 * so the gender agrees: `le/la petit(e) voisin(e)` never yields
 * `le petite voisin`.
 */
function expandArticleSlash(
  text: string,
  rules: WritingRules,
): { canon: string; alternate: string } | null {
  const pattern = articleSlashPattern(rules);
  const m = pattern?.exec(text.trim());
  if (!m) return null;

  const [, first, second, rest = ''] = m;
  const bare = tidyText(rest.replace(BRACKET, ''), rules);
  const inlined = tidyText(
    rest.replace(BRACKET, (_whole, inner: string) => inner),
    rules,
  );
  if (bare.length === 0 || inlined.length === 0) return null;

  return {
    canon: tidyText(`${first} ${bare}`, rules),
    alternate: tidyText(`${second} ${inlined}`, rules),
  };
}

/**
 * Expand the print conventions of a form.
 *
 * `ravi(e)`                         → `ravi` + `ravie`
 * `Vous venez d'où ? / Tu viens d'où ?` → first phrasing + the other
 * `le/la voisin(e)`                 → `le voisin` + `la voisine`
 * `voisin/voisine`, `la pluie`      → unchanged, no alternates
 *
 * The canon is the first reading of the first part. Duplicates collapse, and a
 * form equal to the canon is never repeated as an alternate.
 */
export function expandPrintConventions(text: string, rules: WritingRules): Expansion {
  const articleSlash = expandArticleSlash(text, rules);
  if (articleSlash !== null) {
    const { canon, alternate } = articleSlash;
    return {
      canon,
      alternates: alternate === canon ? [] : [{ text: alternate, source: 'slash' }],
      // The canon is the first of two readings, as with the spaced slash.
      applied: { bracket: false, slash: true },
      bareSlash: false,
      droppedAnnotations: [],
    };
  }

  const parts = text.split(SLASH);
  const expanded = parts.map((p) => expandPart(p, rules));

  // The canon is an identity and a display form: never empty.
  const canon = expanded[0]?.variants[0] || tidyText(text, rules);

  const alternates: Alternate[] = [];
  const seen = new Set([canon]);
  expanded.forEach(({ variants }, partIndex) => {
    for (const variant of variants) {
      if (variant.length === 0 || seen.has(variant)) continue;
      seen.add(variant);
      // The outer convention wins: past the first part it came through the slash.
      alternates.push({ text: variant, source: partIndex > 0 ? 'slash' : 'bracket' });
    }
  });

  return {
    canon,
    alternates,
    applied: {
      // What happened to the canon's own part: in `A / B(e)` the gloss keeps
      // its brackets.
      bracket: expanded[0]?.hadForm ?? false,
      slash: parts.length > 1,
    },
    bareSlash: parts.some((part) => part.includes('/')),
    droppedAnnotations: expanded.flatMap((e) => e.annotations),
  };
}

/**
 * Apply to the gloss the conventions applied to the text. Brackets first, then
 * the slash (a slash may hide inside a gloss bracket). With nothing applied the
 * gloss comes back byte for byte.
 */
export function mirrorGloss(gloss: string, applied: AppliedConventions): string {
  if (!applied.bracket && !applied.slash) return gloss;

  let out = gloss;
  if (applied.bracket) out = out.replace(BRACKET, '');
  if (applied.slash) out = out.split(SLASH)[0] ?? '';
  return tidyGloss(out);
}

const PROPER_NOUN = /^\p{Lu}/u;

/**
 * Split a bare slash between two *objects*: `le train Paris/Lyon` becomes two
 * entries, `voisin/voisine` stays one (null). The evidence is a capital letter
 * on both sides. The common part is distributed over both; the gloss is split
 * the same way when it has the same shape, otherwise both keep it whole.
 */
export function splitByMeaning(
  text: string,
  gloss: string,
  rules: WritingRules,
): { text: string; gloss: string }[] | null {
  if (text.includes(SLASH)) return null;

  const textSides = splitOnBareSlash(text, (s) => tidyText(s, rules));
  if (!textSides) return null;
  const glossSides = splitOnBareSlash(gloss, tidyGloss);

  return textSides.map((side, i) => ({ text: side, gloss: glossSides ? glossSides[i]! : gloss }));
}

function splitOnBareSlash(s: string, tidy: (s: string) => string): [string, string] | null {
  const tokens = s.split(/(\s+)/);
  const carrying = tokens.filter((t) => t.includes('/'));
  if (carrying.length !== 1) return null;

  const token = carrying[0]!;
  const index = tokens.indexOf(token);
  const sides = token.split('/');
  if (sides.length !== 2) return null;
  if (!sides.every((side) => PROPER_NOUN.test(side))) return null;

  const rebuild = (side: string) => tidy(tokens.map((t, i) => (i === index ? side : t)).join(''));
  return [rebuild(sides[0]!), rebuild(sides[1]!)];
}

/**
 * Identity key of a lexeme: the canon, folded. Blind to print conventions
 * (`ravi(e)`, `ravi`, `ravie` are one item), not blind to article, gender or
 * diacritics. If this rule ever changes while progress exists, migrate stored
 * keys first, then re-import — otherwise the old rows and their history are
 * orphaned.
 */
export function lexemeKey(text: string, rules: WritingRules): string {
  return foldText(expandPrintConventions(text, rules).canon);
}
