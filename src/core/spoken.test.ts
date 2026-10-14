import { describe, expect, it } from 'vitest';
import { ER_READ_AS_AIR, FINAL_S_PRONOUNCED, frenchCardinal, frenchOrdinal } from './frenchSpoken';
import { FRENCH } from './languages';
import {
  ALMOST_UNSAID_SHARE,
  alignSpoken,
  checkSpoken,
  countSpokenWords,
  liveHeard,
  soundRule,
  spokenBlocks,
  tokenizeSpoken,
  type SpokenOptions,
} from './spoken';

const R = FRENCH.spoken;
const check = (expected: string, heard: string | string[], opts: SpokenOptions = {}) =>
  checkSpoken(expected, typeof heard === 'string' ? [heard] : heard, R, opts);
const verdict = (expected: string, heard: string, opts: SpokenOptions = {}) => check(expected, heard, opts).verdict;
/** Rule by which two single words match, or null. */
const rule = (a: string, b: string) => soundRule(tokenizeSpoken(a, R), 0, tokenizeSpoken(b, R), 0, R);

describe('French numbers', () => {
  it.each([
    [0, 'zéro'],
    [1, 'un'],
    [16, 'seize'],
    [17, 'dix-sept'],
    [21, 'vingt et un'],
    [22, 'vingt-deux'],
    [70, 'soixante-dix'],
    [71, 'soixante et onze'],
    [72, 'soixante-douze'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [91, 'quatre-vingt-onze'],
    [100, 'cent'],
    [101, 'cent un'],
    [200, 'deux cents'],
    [280, 'deux cent quatre-vingts'],
    [1000, 'mille'],
    [1971, 'mille neuf cent soixante et onze'],
    [80000, 'quatre-vingt mille'],
    [200000, 'deux cent mille'],
    [999999, 'neuf cent quatre-vingt-dix-neuf mille neuf cent quatre-vingt-dix-neuf'],
  ])('%i → %s', (n, words) => expect(frenchCardinal(n)).toBe(words));

  it('out of range → null', () => {
    expect(frenchCardinal(1_000_000)).toBeNull();
    expect(frenchCardinal(-1)).toBeNull();
    expect(frenchCardinal(1.5)).toBeNull();
  });

  it('ordinals', () => {
    expect(frenchOrdinal(1, false)).toBe('premier');
    expect(frenchOrdinal(1, true)).toBe('première');
    expect(frenchOrdinal(2, false)).toBe('deuxième');
    expect(frenchOrdinal(4, false)).toBe('quatrième');
    expect(frenchOrdinal(5, false)).toBe('cinquième');
    expect(frenchOrdinal(9, false)).toBe('neuvième');
    expect(frenchOrdinal(21, false)).toBe('vingt et unième');
    expect(frenchOrdinal(80, false)).toBe('quatre-vingtième');
    expect(frenchOrdinal(100, false)).toBe('centième');
  });
});

describe('tokens', () => {
  it('elision and hyphen keep one written word', () => {
    const t = tokenizeSpoken("Je m'appelle Anna", R);
    expect(t.map((x) => x.key)).toEqual(['je', "m'", 'appelle', 'anna']);
    expect(countSpokenWords(t)).toBe(3);
    expect(countSpokenWords(tokenizeSpoken('Est-ce que tu parles français ?', R))).toBe(5);
  });

  it('apostrophes of every kind, space after the apostrophe', () => {
    expect(tokenizeSpoken('l’ami', R).map((x) => x.key)).toEqual(["l'", 'ami']);
    expect(tokenizeSpoken("l' ami", R).map((x) => x.key)).toEqual(["l'", 'ami']);
    expect(countSpokenWords(tokenizeSpoken("l' ami", R))).toBe(1);
  });

  it('digits become words; thousands; ordinals; fillers dropped', () => {
    expect(tokenizeSpoken('21', R).map((x) => x.key)).toEqual(['vingt', 'et', 'un']);
    expect(tokenizeSpoken('1 000', R).map((x) => x.key)).toEqual(['mille']);
    expect(tokenizeSpoken('1er', R).map((x) => x.key)).toEqual(['premier']);
    expect(tokenizeSpoken('1re', R).map((x) => x.key)).toEqual(['première']);
    expect(tokenizeSpoken('euh bonjour hum', R).map((x) => x.key)).toEqual(['bonjour']);
  });

  it('abbreviations', () => {
    expect(tokenizeSpoken('M. Dupont', R).map((x) => x.key)).toEqual(['monsieur', 'dupont']);
    expect(tokenizeSpoken('Mme Durand', R).map((x) => x.key)).toEqual(['madame', 'durand']);
  });
});

describe('sound rules: accepted', () => {
  it.each([
    ['parler', 'parlé', 'З1'],
    ['parler', 'parlez', 'З1'],
    ['aimé', 'aimée', 'З1'],
    ['allées', 'aller', 'З1'],
    ['parlais', 'parlait', 'З2'],
    ['parlait', 'parlaient', 'З2'],
    ['parle', 'parles', 'З3'],
    ['petite', 'petites', 'З3'],
    ['ami', 'amis', 'З5'],
    ['petit', 'petits', 'З5'],
    ['beau', 'beaux', 'З5'],
    ['ami', 'amie', 'З6'],
    ['vu', 'vue', 'З6'],
    ['joli', 'jolies', 'З6'],
    ['cruel', 'cruelle', 'З7'],
    ['quel', 'quelles', 'З7'],
    ['a', 'à', 'З8'],
    ['ou', 'où', 'З8'],
    ['ces', 'ses', 'З8'],
    ['on', 'ont', 'З8'],
    ['son', 'sont', 'З8'],
    ['es', 'est', 'З8'],
    ['peu', 'peut', 'З8'],
    ['vingt', 'vin', 'З8'],
    ['cent', 'sans', 'З8'],
  ])('%s = %s (%s)', (a, b, id) => {
    expect(rule(a, b)).toBe(id);
    expect(rule(b, a)).toBe(id);
  });

  it.each([
    ["c'est", "s'est"],
    ['il parle', 'ils parlent'],
    ['ils parlent', 'il parle'],
    ['elles ne le parlent pas', 'elle ne le parle pas'],
    ['Combien ça coûte ?', 'combien ça coûte'],
    ['Est-ce que tu parles français ?', 'est-ce que tu parle français'],
    ['vingt et un', '21'],
    ['quatre-vingts', '80'],
    ['le premier', 'le 1er'],
    ['mille', '1 000'],
    ['Monsieur Dupont', 'M. Dupont'],
    ['Je vais à Paris', 'je vais a paris'],
  ])('%s ← %s: correct', (expected, heard) => expect(verdict(expected, heard)).toBe('correct'));
});

describe('sound rules: rejected (no false "correct")', () => {
  it.each([
    ['cher', 'chez'],
    ['parler', 'parlait'],
    ['parlé', 'parle'],
    ['le', 'les'],
    ['me', 'mes'],
    ['de', 'des'],
    ['ce', 'ces'],
    ['petit', 'petite'],
    ['grand', 'grande'],
    ['content', 'conte'],
    ['bus', 'bu'],
    ['et', 'est'],
    ['mais', 'mes'],
    ['vert', 'verre'],
    ['un', 'une'],
  ])('%s ≠ %s', (a, b) => {
    expect(rule(a, b)).toBeNull();
    expect(rule(b, a)).toBeNull();
  });

  it.each([
    ['ils aiment', 'il aime'], // liaison: [ilzɛm] ≠ [ilɛm]
    ['il aime', 'ils aiment'],
    ['les amis', 'le ami'],
    ["c'est", 'sait'], // two words against one
    ['une', '1'], // a digit carries no gender: 1 = un only
    ["on n'a pas", 'on a pas'],
    ['content', 'conte'],
    ['je parle', 'je parlent'], // -ent only after ils / elles
  ])('%s ← %s: not correct', (expected, heard) => expect(verdict(expected, heard)).not.toBe('correct'));

  it('un = 1', () => expect(verdict('un', '1')).toBe('correct'));

  it.each(ER_READ_AS_AIR.map((w) => [w]))('З1 exception: %s', (w) => {
    const stem = w.slice(0, -2);
    for (const other of [`${stem}é`, `${stem}ez`, `${stem}ée`, `${stem}és`]) {
      expect(rule(w, other), `${w} / ${other}`).toBeNull();
      expect(rule(other, w), `${other} / ${w}`).toBeNull();
    }
  });

  it.each(FINAL_S_PRONOUNCED.map((w) => [w]))('final s/x pronounced: %s', (w) => {
    const bare = w.slice(0, -1);
    expect(rule(w, bare)).toBeNull();
    expect(rule(bare, w)).toBeNull();
  });
});

describe('verdict (Р22.2)', () => {
  it('threshold constant', () => expect(ALMOST_UNSAID_SHARE).toBe(0.25));

  it('N = 1', () => {
    expect(check('bonjour', 'bonsoir')).toMatchObject({ verdict: 'incorrect', words: 1, unsaid: 1, extra: 0 });
    expect(check('bonjour', 'bonjour')).toMatchObject({ verdict: 'correct', words: 1, unsaid: 0 });
    expect(check('bonjour', '')).toMatchObject({ verdict: 'incorrect', unsaid: 1 });
  });

  it('N = 3: one unsaid word is already incorrect', () => {
    expect(check("je m'appelle Anna", 'je appelle Anna')).toMatchObject({ verdict: 'incorrect', words: 3, unsaid: 1 });
    expect(check('il fait beau', 'il fait chaud')).toMatchObject({ verdict: 'incorrect', unsaid: 1 });
  });

  it('N = 4: one unsaid → almost, two → incorrect', () => {
    expect(check('je parle très bien', 'je parle bien')).toMatchObject({ verdict: 'almost', errorType: 'words', words: 4, unsaid: 1 });
    expect(check('je parle très bien', 'je parle mal')).toMatchObject({ verdict: 'incorrect', unsaid: 2 });
  });

  it('N = 7: one unsaid → almost, two → incorrect', () => {
    const ref = 'je voudrais un café avec du sucre';
    expect(check(ref, 'je voudrais un café du sucre')).toMatchObject({ verdict: 'almost', words: 7, unsaid: 1 });
    expect(check(ref, 'je voudrais un café sucre')).toMatchObject({ verdict: 'incorrect', unsaid: 2 });
  });

  it('N = 8: two unsaid → almost, three → incorrect', () => {
    const ref = 'je voudrais un grand café avec du sucre';
    expect(check(ref, 'je voudrais un café du sucre')).toMatchObject({ verdict: 'almost', words: 8, unsaid: 2 });
    expect(check(ref, 'je voudrais un café sucre')).toMatchObject({ verdict: 'incorrect', unsaid: 3 });
  });

  it('only extra words → almost, whatever their number', () => {
    expect(check('bonjour', 'bonjour madame')).toMatchObject({ verdict: 'almost', errorType: 'extra', unsaid: 0, extra: 1 });
    expect(check('le nom', 'alors le nom de famille')).toMatchObject({ verdict: 'almost', extra: 3 });
  });

  it('extra words and an unsaid word', () => {
    expect(check('je parle très bien', 'alors je parle bien merci')).toMatchObject({ verdict: 'almost', unsaid: 1, extra: 2 });
    expect(check('il fait beau', 'alors il beau')).toMatchObject({ verdict: 'incorrect', unsaid: 1, extra: 1 });
  });

  it('fillers are not extra words', () => {
    expect(check('bonjour', 'euh bonjour')).toMatchObject({ verdict: 'correct', extra: 0 });
  });

  it('a missing article alone → almost at any N', () => {
    expect(check('le nom', 'nom')).toMatchObject({ verdict: 'almost', errorType: 'article', words: 2 });
    expect(check("l'ami", 'ami')).toMatchObject({ verdict: 'almost', errorType: 'article', words: 1 });
    expect(check('le nom', 'nom', { determiner: true })).toMatchObject({ verdict: 'almost', errorType: 'article' });
  });

  it.each(['la', "l'", 'les', 'un', 'une', 'des', 'du'])('le nom ← "%s nom": almost without the form hint, incorrect with it', (art) => {
    expect(verdict('le nom', `${art} nom`)).toBe('almost');
    expect(check('le nom', `${art} nom`, { determiner: true })).toMatchObject({ verdict: 'incorrect', errorType: 'article' });
  });

  it.each(['le', 'la', 'les', 'une', 'des', 'du'])('un nom ← "%s nom" with the form hint: incorrect', (art) => {
    expect(verdict('un nom', `${art} nom`, { determiner: true })).toBe('incorrect');
  });

  it('an extra article with the form hint → incorrect', () => {
    expect(check('le nom', 'le nom le', { determiner: true }).verdict).toBe('incorrect');
    expect(check('le nom', 'le nom le').verdict).toBe('almost');
  });

  it('the article of a sound-equal pair is no error: la = là', () => {
    expect(verdict('la maison', 'là maison', { determiner: true })).toBe('correct');
  });
});

describe('alignment edge cases', () => {
  const ops = (e: string, h: string) => {
    const ref = tokenizeSpoken(e, R);
    const heard = tokenizeSpoken(h, R);
    return alignSpoken(ref, heard, R).map((o) => [o.status, o.ref ?? null, o.heard ?? null]);
  };

  it('missing word at the start', () => {
    expect(ops('le nom', 'nom')).toEqual([['missing', 0, null], ['ok', 1, 0]]);
  });

  it('extra word at the start', () => {
    expect(ops('le nom', 'alors le nom')).toEqual([['extra', null, 0], ['ok', 0, 1], ['ok', 1, 2]]);
  });

  it('two equal words: the earlier one is matched, the later one missing', () => {
    expect(ops('très très bien', 'très bien')).toEqual([['ok', 0, 0], ['missing', 1, null], ['ok', 2, 1]]);
  });

  it('a repeated heard word: the repeat is extra', () => {
    expect(ops('le nom', 'le le nom')).toEqual([['ok', 0, 0], ['extra', null, 1], ['ok', 1, 2]]);
  });

  it('another word in the middle', () => {
    expect(ops('il fait beau', 'il fait chaud')).toEqual([['ok', 0, 0], ['ok', 1, 1], ['other', 2, 2]]);
  });
});

describe('alternatives', () => {
  it('the best alternative wins and its index is kept', () => {
    const c = check('le nom', ['le non', 'le nom', 'le nom']);
    expect(c).toMatchObject({ verdict: 'correct', altIndex: 1, answer: 'le nom' });
  });

  it('ties keep the recognizer order', () => {
    expect(check('le nom', ['le non', 'le nain']).altIndex).toBe(0);
  });

  it('no alternatives = nothing heard', () => {
    expect(checkSpoken('le nom', [], R)).toMatchObject({ verdict: 'incorrect', unsaid: 2, answer: '' });
  });

  it('the rules that fired are listed', () => {
    expect(check('il parle', 'ils parlent').rules.sort()).toEqual(['З4', 'З5']);
    expect(check('vingt et un', '21').rules).toEqual(['Ч']);
  });
});

describe('display blocks', () => {
  const blocks = (e: string, h: string) => spokenBlocks(check(e, h));

  it('a missing word: empty cell on top, the word below', () => {
    expect(blocks('le nom', 'nom')).toEqual([
      [{ status: 'missing', top: null, bottom: 'le' }],
      [{ status: 'ok', top: 'nom', bottom: 'nom' }],
    ]);
  });

  it('an elided article stays in its word block', () => {
    expect(blocks("l'ami", 'ami')).toEqual([
      [
        { status: 'missing', top: null, bottom: "l'" },
        { status: 'ok', top: 'ami', bottom: 'ami' },
      ],
    ]);
  });

  it('an extra word: struck on top, empty cell below', () => {
    expect(blocks('bonjour', 'bonjour madame')).toEqual([
      [{ status: 'ok', top: 'bonjour', bottom: 'bonjour' }],
      [{ status: 'extra', top: 'madame', bottom: null }],
    ]);
  });

  it('a number in digits shows the digits once over its words', () => {
    expect(blocks('vingt et un', '21')).toEqual([
      [
        { status: 'sound', top: '21', bottom: 'vingt', rule: 'Ч' },
        { status: 'sound', top: '', bottom: 'et', rule: 'Ч' },
        { status: 'sound', top: '', bottom: 'un', rule: 'Ч' },
      ],
    ]);
  });

  it('a sound match keeps what was heard', () => {
    expect(blocks('parler', 'parlé')).toEqual([[{ status: 'sound', top: 'parlé', bottom: 'parler', rule: 'З1' }]]);
  });
});

describe('live progress', () => {
  it('marks the words heard so far, the rest stays open', () => {
    expect(liveHeard('je parle très bien', 'je parle', R)).toEqual([true, true, false, false]);
    expect(liveHeard('je parle très bien', '', R)).toEqual([false, false, false, false]);
    expect(liveHeard('je parle très bien', 'je parles très', R)).toEqual([true, true, true, false]);
  });
});

describe('marks never contradict the verdict (generated answers)', () => {
  /** Deterministic pseudo-random generator (mulberry32). */
  function rng(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const REFS = ['le nom', "l'ami", 'je parle très bien', 'ils parlent français', 'je voudrais un grand café avec du sucre', 'vingt et un', "c'est la vie"];
  const VOCAB = ['le', 'la', 'les', 'un', 'nom', 'non', 'ami', 'amis', 'je', 'parle', 'parlé', 'très', 'bien', 'il', 'ils', 'parlent', 'français', 'café', 'du', 'sucre', '21', 'vin', 'et', "s'est", 'la', 'vie', 'euh', 'alors'];

  it('on 3000 generated answers', () => {
    const r = rng(42);
    for (let k = 0; k < 3000; k++) {
      const ref = REFS[Math.floor(r() * REFS.length)]!;
      const words = ref.split(' ');
      const out: string[] = [];
      for (const w of words) {
        const x = r();
        if (x < 0.12) continue; // drop
        if (x < 0.24) out.push(VOCAB[Math.floor(r() * VOCAB.length)]!); // replace
        else out.push(w);
        if (r() < 0.08) out.push(VOCAB[Math.floor(r() * VOCAB.length)]!); // insert
      }
      const c = check(ref, out.join(' '), { determiner: r() < 0.3 });
      const ctx = `${ref} ← ${out.join(' ')}`;
      const st = c.ops.map((o) => o.status);
      const unsaidWords = new Set(c.ops.filter((o) => o.status === 'missing' || o.status === 'other').map((o) => c.ref[o.ref!]!.word));
      expect(c.unsaid, ctx).toBe(unsaidWords.size);
      expect(c.extra, ctx).toBe(st.filter((s) => s === 'extra').length);
      // Every reference token appears exactly once in the marks, every heard token too.
      expect(c.ops.filter((o) => o.ref !== undefined).map((o) => o.ref), ctx).toEqual(c.ref.map((_, i) => i));
      expect(c.ops.filter((o) => o.heard !== undefined).map((o) => o.heard), ctx).toEqual(c.heard.map((_, i) => i));
      if (c.verdict === 'correct') expect(st.every((s) => s === 'ok' || s === 'sound'), ctx).toBe(true);
      else expect(st.some((s) => s !== 'ok' && s !== 'sound'), ctx).toBe(true);
      if (c.verdict === 'almost' && c.errorType === 'extra') expect(c.unsaid, ctx).toBe(0);
      // Blocks show both lines in full, in order.
      const cells = spokenBlocks(c).flat();
      expect(cells.filter((x) => x.bottom !== null).length, ctx).toBe(c.ref.length);
      expect(cells.filter((x) => x.top !== null).length, ctx).toBe(c.heard.length);
    }
  });
});
