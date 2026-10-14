import { describe, expect, it } from 'vitest';
import { charBlocks, checkTyped, editDistance, foldTraced, normalize, type CharCell } from './evaluate';
import { FRENCH } from './languages';

const fr = FRENCH.writing;
const show = (cells: readonly CharCell[]) =>
  cells.map((c) => `${c.status[0]}:${c.top ?? '_'}/${c.bottom ?? '_'}`).join(' ');

/** Deterministic pseudo-random generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ['le', 'la', "l'", 'un', 'une', 'chat', 'été', 'éte', 'ete', 'appelle', 'apelle', 'bonjour', 'bonjuor', 'ça', 'ca', 'va', '?', 'Ça', 'élève', 'eleve', 'garçon', 'garcon', 'ou', 'où', 'mer', 'mère'];
const SEPARATORS = [' ', ' ', ' ', ', ', '  ', ' ', ''];

function phrase(r: () => number): string {
  const n = 1 + Math.floor(r() * 3);
  let s = '';
  for (let k = 0; k < n; k++) {
    s += WORDS[Math.floor(r() * WORDS.length)]!;
    if (k < n - 1) s += SEPARATORS[Math.floor(r() * SEPARATORS.length)]!;
  }
  if (r() < 0.2) s += '.';
  return s;
}

/** Slight edits of a reference: what learners actually type. */
function mutate(s: string, r: () => number): string {
  const chars = s.split('');
  const k = Math.floor(r() * chars.length);
  switch (Math.floor(r() * 7)) {
    case 0:
      return s;
    case 1:
      chars.splice(k, 1);
      break;
    case 2:
      chars.splice(k, 0, 'x');
      break;
    case 3:
      if (k + 1 < chars.length) [chars[k], chars[k + 1]] = [chars[k + 1]!, chars[k]!];
      break;
    case 4:
      return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    case 5:
      return s.replace(/^(le |la |l'|un |une )/, '');
    default:
      return s.toUpperCase();
  }
  return chars.join('');
}

describe('foldTraced', () => {
  it.each([
    'Ça va ?',
    '  Bonjour , madame…  ',
    'l’ami',
    'Il fait beau. ',
    'oui,non',
    '« Salut »',
    'A B C',
    'Je vais bien...',
  ])('compares exactly what normalize compares: %s', (s) => {
    expect(foldTraced(s, fr).map((x) => x.c).join('')).toBe(normalize(s, fr));
  });

  it('keeps the typed form for display', () => {
    expect(foldTraced('Ça VA', fr).map((x) => x.d).join('')).toBe('Ça VA');
  });
});

describe('checkTyped: marks', () => {
  it('correct: all ok, typed case shown', () => {
    expect(show(checkTyped('ça va ?', 'Ça va?', fr).cells)).toBe('o:Ç/ç o:a/a o: /  o:v/v o:a/a o:?/?');
  });

  it('missing article: the article missing on top, the rest ok', () => {
    const r = checkTyped('le chat', 'chat', fr);
    expect(r.evaluation).toEqual({ verdict: 'almost', errorType: 'article' });
    expect(show(r.cells)).toBe('m:_/l m:_/e m:_/  o:c/c o:h/h o:a/a o:t/t');
  });

  it('diacritic only: its own status, the rest ok', () => {
    const r = checkTyped('élève', 'eleve', fr);
    expect(r.evaluation.errorType).toBe('diacritic');
    expect(show(r.cells)).toBe('d:e/é o:l/l d:e/è o:v/v o:e/e');
  });

  it('a missing letter: empty cell on top, the later of two equal letters', () => {
    const r = checkTyped("je m'appelle", "je m'apelle", fr);
    expect(r.evaluation.errorType).toBe('typo');
    expect(show(r.cells)).toContain('o:p/p m:_/p o:e/e');
  });

  it('an extra letter: struck on top, empty cell below', () => {
    expect(show(checkTyped('bonjour', 'bonnjour', fr).cells)).toBe('o:b/b o:o/o o:n/n e:n/_ o:j/j o:o/o o:u/u o:r/r');
  });

  it('a transposition is one edit shown on both letters', () => {
    const r = checkTyped('bonjour', 'bonjuor', fr);
    expect(r.evaluation.errorType).toBe('typo');
    expect(show(r.cells)).toBe('o:b/b o:o/o o:n/n o:j/j w:u/o w:o/u o:r/r');
  });

  it('a replaced letter: red on top, the right letter below', () => {
    expect(show(checkTyped('mer', 'mur', fr).cells)).toBe('o:m/m w:u/e o:r/r');
  });

  it('a missing letter at the start', () => {
    expect(show(checkTyped('appelle', 'ppelle', fr).cells).startsWith('m:_/a o:p/p')).toBe(true);
  });
});

describe('checkTyped: the marks never contradict the verdict', () => {
  const r = rng(20261014);
  const cases: [string, string][] = [];
  for (let k = 0; k < 4000; k++) {
    const e = phrase(r);
    cases.push([e, r() < 0.3 ? phrase(r) : mutate(e, r)]);
  }

  it('on 4000 generated pairs', () => {
    for (const [e, a] of cases) {
      const { evaluation, cells } = checkTyped(e, a, fr);
      const ctx = `${JSON.stringify(e)} ← ${JSON.stringify(a)}: ${show(cells)}`;
      const bad = cells.filter((c) => c.status !== 'ok');
      // Both lines are exactly the folded strings the verdict compared.
      expect(cells.flatMap((c) => (c.top === null ? [] : [c.top])).join('').toLowerCase(), ctx).toBe(normalize(a, fr));
      expect(cells.flatMap((c) => (c.bottom === null ? [] : [c.bottom])).join('').toLowerCase(), ctx).toBe(normalize(e, fr));

      if (evaluation.verdict === 'correct') expect(bad, ctx).toEqual([]);
      else expect(bad.length, ctx).toBeGreaterThan(0);

      if (evaluation.errorType === 'diacritic') {
        expect(bad.every((c) => c.status === 'diacritic'), ctx).toBe(true);
      }
      if (evaluation.errorType === 'article') {
        const missing = cells.filter((c) => c.status === 'missing');
        expect(bad.every((c) => c.status === 'missing'), ctx).toBe(true);
        expect(cells.indexOf(missing[0]!), ctx).toBe(0);
        expect(normalize(e, fr).startsWith(missing.map((c) => c.bottom).join('')), ctx).toBe(true);
      }
      if (evaluation.errorType === 'typo' || evaluation.verdict === 'incorrect') {
        // Marked edits = the distance the verdict used (a transposition marks two cells).
        let edits = 0;
        for (let k = 0; k < cells.length; k++) {
          const c = cells[k]!;
          if (c.status === 'ok') continue;
          const next = cells[k + 1];
          if (c.status === 'wrong' && next?.status === 'wrong' && c.top === next.bottom && c.bottom === next.top) k++;
          edits++;
        }
        if (evaluation.errorType === 'typo') {
          expect(edits, ctx).toBe(editDistance(normalize(e, fr), normalize(a, fr)));
          expect(bad.some((c) => c.status === 'missing' || c.status === 'extra' || c.status === 'wrong' || c.status === 'diacritic'), ctx).toBe(true);
        }
      }
    }
  });
});

describe('charBlocks', () => {
  const words = (e: string, a: string) =>
    charBlocks(checkTyped(e, a, fr).cells).map((b) => b.map((c) => c.top ?? '_').join('') + '/' + b.map((c) => c.bottom ?? '_').join(''));

  it('one block per word; ok spaces are boundaries only', () => {
    expect(words('la pluie', 'la pluie')).toEqual(['la/la', 'pluie/pluie']);
  });

  it('a space that is an error stays visible as its own block', () => {
    expect(words('bonjour', 'bon jour')).toEqual(['bon/bon', ' /_', 'jour/jour']);
    expect(words('la pluie', 'lapluie')).toEqual(['la/la', '_/ ', 'pluie/pluie']);
  });
});
