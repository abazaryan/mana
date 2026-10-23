import { describe, expect, it } from 'vitest';
import { checkWritten, editDistance, evaluate, foldShown, normalize, type ArticleForm, type CharCell } from './evaluate';
import { FRENCH } from './languages';

const fr = FRENCH.writing;
const ev = (expected: string, actual: string, alternates?: Parameters<typeof evaluate>[3]) =>
  evaluate(expected, actual, fr, alternates);

describe('evaluate (French)', () => {
  it('treats an exact match as correct', () => {
    expect(ev('la pluie', 'la pluie')).toEqual({ verdict: 'correct' });
  });

  it('folds case, whitespace and apostrophe style as correct', () => {
    expect(ev('La Pluie', 'la pluie')).toEqual({ verdict: 'correct' });
    expect(ev('la  pluie ', ' la pluie')).toEqual({ verdict: 'correct' });
    expect(ev('j’arrive', "j'arrive")).toEqual({ verdict: 'correct' });
  });

  it('marks a diacritic-only miss as almost, in both directions', () => {
    expect(ev('la fenêtre', 'la fenetre')).toEqual({ verdict: 'almost', errorType: 'diacritic' });
    expect(ev('élève', 'eleve')).toEqual({ verdict: 'almost', errorType: 'diacritic' });
    expect(ev('eleve', 'élève')).toEqual({ verdict: 'almost', errorType: 'diacritic' });
  });

  it('marks a small typo as almost; a swap of neighbours is one edit', () => {
    expect(ev('le fromage', 'le formage')).toEqual({ verdict: 'almost', errorType: 'typo' });
    expect(ev('la bibliothèque', 'la bibliotèque')).toEqual({ verdict: 'almost', errorType: 'typo' });
  });

  it('gives words of 5 characters or less no typo tolerance', () => {
    expect(ev('mer', 'mur').verdict).toBe('incorrect');
    expect(ev('sel', 'sol').verdict).toBe('incorrect');
    expect(ev('pain', 'main').verdict).toBe('incorrect');
    expect(ev('lundi', 'lindi').verdict).toBe('incorrect');
    // A long word tolerates two edits.
    expect(ev('extraordinairement', 'extraordinerement').verdict).toBe('almost');
  });

  it('caps tolerance on long phrases at three edits', () => {
    const phrase = 'nous allons à la plage demain matin, je crois';
    expect(phrase).toHaveLength(45); // ⌊44/6⌋ = 7 after folding the comma, 3 after the cap
    expect(ev(phrase, 'nous allont à la plaje demain matim, je crois')).toEqual({
      verdict: 'almost',
      errorType: 'typo',
    });
    expect(ev(phrase, 'nous allont à la plaje demain matim, je croiz').verdict).toBe('incorrect');
  });

  it('accepts both typographies of French punctuation and notes the missing space', () => {
    expect(ev('tu viens ?', 'tu viens ?')).toEqual({ verdict: 'correct' });
    expect(ev('tu viens ?', 'tu viens?')).toEqual({ verdict: 'correct', typographyNote: true });
    expect(ev('quelle chance !', 'quelle chance!')).toEqual({ verdict: 'correct', typographyNote: true });
    expect(ev('elle répond : non', 'elle répond: non')).toEqual({
      verdict: 'correct',
      typographyNote: true,
    });
    expect(ev('« attends »', '«attends»')).toEqual({ verdict: 'correct', typographyNote: true });
  });

  it('does not note typography when the learner typed the French space', () => {
    expect(ev('tu viens?', 'tu viens ?')).toEqual({ verdict: 'correct' });
    expect(ev('tu viens?', 'tu viens?')).toEqual({ verdict: 'correct' });
  });

  it('folds no-break spaces to ordinary ones', () => {
    expect(ev('tu viens ?', 'tu viens ?')).toEqual({ verdict: 'correct' });
    expect(ev('tu viens ?', 'tu viens ?')).toEqual({ verdict: 'correct' });
    expect(ev('tu viens ?', 'tu viens ?')).toEqual({ verdict: 'correct' });
    expect(ev('tu viens ?', 'tu viens?')).toEqual({ verdict: 'correct', typographyNote: true });
    expect(ev('50 %', '50 %')).toEqual({ verdict: 'correct' });
  });

  it('folds the comma and the spaces around it', () => {
    expect(ev('Il fait froid, non', 'Il fait froid non')).toEqual({ verdict: 'correct' });
    expect(ev('Il fait froid, non', 'il fait froid , non')).toEqual({ verdict: 'correct' });
    expect(ev('Il fait froid, non', 'il fait froid,non')).toEqual({ verdict: 'correct' });
    expect(ev('Bon, d’accord', "bon d'accord")).toEqual({ verdict: 'correct' });
  });

  it('still hears the words around the folded comma', () => {
    expect(ev('Il fait froid, non', 'Il fait, non').verdict).not.toBe('correct');
    expect(ev('Bon, d’accord', "pas d'accord").verdict).toBe('incorrect');
  });

  it('folds a closing full stop on either side', () => {
    expect(ev('Il est midi.', 'il est midi')).toEqual({ verdict: 'correct' });
    expect(ev('Il est midi', 'il est midi.')).toEqual({ verdict: 'correct' });
  });

  it('folds a closing ellipsis, as dots or as the single character', () => {
    expect(ev('Je pense que...', 'je pense que')).toEqual({ verdict: 'correct' });
    const ELLIPSIS = String.fromCodePoint(0x2026);
    expect(ev(`Je pense que${ELLIPSIS}`, 'je pense que...')).toEqual({ verdict: 'correct' });
  });

  it('keeps ? and ! and a mid-phrase ellipsis', () => {
    expect(ev('Tu viens ?', 'tu viens').verdict).not.toBe('correct');
    expect(ev('peut-être... demain', 'peut-être demain').verdict).not.toBe('correct');
  });

  it('accepts an alternate without a form tag, softening slips against it', () => {
    const alternates = [{ text: 'ravie', source: 'bracket' as const }];
    expect(ev('ravi', 'ravie', alternates)).toEqual({ verdict: 'correct' });
    expect(ev('ravi', 'ravi', alternates)).toEqual({ verdict: 'correct' });
    const accented = [{ text: 'fâchée', source: 'bracket' as const }];
    expect(ev('fâché', 'fachee', accented)).toEqual({ verdict: 'almost', errorType: 'diacritic' });
  });

  it('does not accept an alternate tagged as a form of its own', () => {
    const tagged = [{ text: 'musicienne', source: 'bracket' as const, form: 'f' }];
    expect(ev('musicien', 'musicienne', tagged).verdict).toBe('incorrect');
    const untagged = [{ text: 'musicienne', source: 'bracket' as const }];
    expect(ev('musicien', 'musicienne', untagged)).toEqual({ verdict: 'correct' });
  });

  it('names a missing article instead of failing the word', () => {
    expect(ev('le parapluie', 'parapluie')).toEqual({ verdict: 'almost', errorType: 'article' });
    expect(ev('la neige', 'neige')).toEqual({ verdict: 'almost', errorType: 'article' });
    expect(ev("l'hiver", 'hiver')).toEqual({ verdict: 'almost', errorType: 'article' });
    expect(ev('les Alpes', 'Alpes')).toEqual({ verdict: 'almost', errorType: 'article' });
    expect(ev('une pomme', 'pomme')).toEqual({ verdict: 'almost', errorType: 'article' });
  });

  it('does not read an article where the reference has none, nor a wrong one as missing', () => {
    expect(ev('demain', 'main').verdict).toBe('incorrect');
    expect(ev('le parapluie', 'la parapluie').errorType).not.toBe('article');
  });

  it('marks an empty or unrelated answer as incorrect', () => {
    expect(ev('merci', '')).toEqual({ verdict: 'incorrect' });
    expect(ev('merci', '   ')).toEqual({ verdict: 'incorrect' });
    expect(ev('merci', 'pardon')).toEqual({ verdict: 'incorrect' });
  });
});

describe('French writing rules', () => {
  it('has a global typographic-space pattern (counted and replaced everywhere)', () => {
    expect(fr.typographicSpace?.flags).toContain('g');
    expect(ev('« attends » ?', '«attends»?')).toEqual({ verdict: 'correct', typographyNote: true });
  });
});

describe('evaluate with language rules switched off', () => {
  const plain = { ...fr, typographicSpace: null, leadingArticle: null };

  it('does not fold a typographic space the language does not have', () => {
    expect(evaluate('tu viens ?', 'tu viens?', plain).verdict).not.toBe('correct');
  });

  it('does not name an article the language does not have', () => {
    expect(evaluate('le parapluie', 'parapluie', plain).errorType).not.toBe('article');
  });
});

describe('normalize', () => {
  it('applies the full fold', () => {
    expect(normalize('  Tu VIENS ?  ', fr)).toBe('tu viens?');
    expect(normalize('Oui, merci.', fr)).toBe('oui merci');
  });
});

describe('editDistance', () => {
  it('counts an adjacent transposition as one edit', () => {
    expect(editDistance('ab', 'ba')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('chat', 'chats')).toBe(1);
    expect(editDistance('same', 'same')).toBe(0);
  });
});

describe('checkWritten: the article in `write` (R24)', () => {
  const HINT: ArticleForm = { determiner: true, gender: 'm' };
  const NO_HINT: ArticleForm = { determiner: false, gender: 'm' };
  const w = (e: string, a: string, form: ArticleForm) => checkWritten(e, a, fr, form).evaluation;

  it('another article is incorrect, with the form hint and without', () => {
    expect(w('le nom', 'la nom', HINT)).toEqual({ verdict: 'incorrect', errorType: 'article' });
    expect(w('le nom', 'la nom', NO_HINT)).toEqual({ verdict: 'incorrect', errorType: 'article' });
    expect(w('le nom', 'les nom', NO_HINT)).toEqual({ verdict: 'incorrect', errorType: 'article' });
    expect(w('le nom', 'un nom', NO_HINT)).toEqual({ verdict: 'incorrect', errorType: 'article' });
    expect(w('la maison', 'le maison', { determiner: true, gender: 'f' })).toEqual({ verdict: 'incorrect', errorType: 'article' });
    expect(w('un rendez-vous', 'une rendez-vous', HINT)).toEqual({ verdict: 'incorrect', errorType: 'article' });
  });

  it('a missing article: incorrect with the form hint, almost without it', () => {
    expect(w('le nom', 'nom', HINT)).toEqual({ verdict: 'incorrect', errorType: 'article' });
    expect(w('le nom', 'nom', NO_HINT)).toEqual({ verdict: 'almost', errorType: 'article' });
    expect(w("l'hôpital", 'hôpital', HINT)).toEqual({ verdict: 'incorrect', errorType: 'article' });
    expect(w("l'hôpital", 'hôpital', NO_HINT)).toEqual({ verdict: 'almost', errorType: 'article' });
  });

  it('le/la where the word takes l\': almost, its own reason (elision); the wrong gender is an article error', () => {
    expect(w("l'hôpital", 'le hôpital', HINT)).toEqual({ verdict: 'almost', errorType: 'elision' });
    expect(w("l'hôpital", 'la hôpital', HINT)).toEqual({ verdict: 'incorrect', errorType: 'article' });
    expect(w("l'école", 'la école', { determiner: true, gender: 'f' })).toEqual({ verdict: 'almost', errorType: 'elision' });
    // Gender unknown: either one is taken as the missed elision.
    expect(w("l'ami", 'la ami', { determiner: false })).toEqual({ verdict: 'almost', errorType: 'elision' });
    // l' where the word takes le/la.
    expect(w('le héros', "l'héros", HINT)).toEqual({ verdict: 'almost', errorType: 'elision' });
  });

  it('everything else is the ported cascade', () => {
    expect(w('le nom', 'le nom', HINT)).toEqual({ verdict: 'correct' });
    expect(w("l'hôpital", "l'hopital", HINT)).toEqual({ verdict: 'almost', errorType: 'diacritic' });
    expect(w('beaucoup', 'beacoup', NO_HINT)).toEqual({ verdict: 'almost', errorType: 'typo' });
    expect(w('Ça va ?', 'ça va?', NO_HINT)).toEqual({ verdict: 'correct' });
    expect(w('le nom', 'la nomx', HINT)).toEqual({ verdict: 'incorrect' });
    expect(w('le nom', '', HINT)).toEqual({ verdict: 'incorrect' });
  });

  it('the marks show what was compared, and never an error on a correct answer', () => {
    for (const [e, a, form] of [
      ['le nom', 'la nom', HINT],
      ['le nom', 'nom', HINT],
      ["l'hôpital", 'le hôpital', HINT],
      ['le nom', 'le nom', HINT],
    ] as const) {
      const { evaluation, cells } = checkWritten(e, a, fr, form);
      expect(cells.flatMap((c) => (c.top === null ? [] : [c.top])).join('').toLowerCase()).toBe(normalize(a, fr));
      expect(cells.flatMap((c) => (c.bottom === null ? [] : [c.bottom])).join('').toLowerCase()).toBe(normalize(e, fr));
      expect(cells.some((c) => c.status !== 'ok')).toBe(evaluation.verdict !== 'correct');
    }
  });
});

describe('checkWritten: punctuation is not counted (R26)', () => {
  const NONE: ArticleForm = { determiner: false };
  const show = (cells: readonly CharCell[]) => cells.filter((c) => c.status !== 'ok').map((c) => `${c.status}:${c.top ?? '_'}/${c.bottom ?? '_'}`);

  it('a missing question mark: correct, shown as neutral punctuation', () => {
    const r = checkWritten('Ça va ?', 'Ça va', fr, NONE);
    expect(r.evaluation).toEqual({ verdict: 'correct', punctuationNote: true });
    expect(show(r.cells)).toEqual(['punct:_/?']);
  });

  it('a question without "?" is correct', () => {
    const r = checkWritten('Est-ce que tu parles français ?', 'Est-ce que tu parles français', fr, NONE);
    expect(r.evaluation).toEqual({ verdict: 'correct', punctuationNote: true });
    expect(r.cells.every((c) => c.status === 'ok' || c.status === 'punct')).toBe(true);
  });

  it('extra, missing or other marks of . , ! ? ; : … « » " never change the verdict', () => {
    expect(checkWritten('Bonne nuit !', 'Bonne nuit.', fr, NONE).evaluation).toEqual({ verdict: 'correct', punctuationNote: true });
    expect(checkWritten('Oui, merci.', 'Oui merci', fr, NONE).evaluation).toEqual({ verdict: 'correct', punctuationNote: true });
    expect(checkWritten('« Bonjour »', 'bonjour', fr, NONE).evaluation).toEqual({ verdict: 'correct', punctuationNote: true });
    expect(checkWritten('Attends…', 'Attends', fr, NONE).evaluation).toEqual({ verdict: 'correct', punctuationNote: true });
    expect(checkWritten('merci', 'merci !', fr, NONE).evaluation).toEqual({ verdict: 'correct', punctuationNote: true });
    expect(checkWritten('Il dit : "non"', 'Il dit non', fr, NONE).evaluation).toEqual({ verdict: 'correct', punctuationNote: true });
  });

  it('apostrophe and hyphen are spelling, as before', () => {
    expect(checkWritten("aujourd'hui", 'aujourdhui', fr, NONE).evaluation).toEqual({ verdict: 'almost', errorType: 'typo' });
    expect(checkWritten('est-ce', 'est ce', fr, NONE).evaluation.verdict).not.toBe('correct');
  });

  it('a real error next to punctuation is still marked and counted', () => {
    const r = checkWritten('Bonne nuit !', 'Bone nuit', fr, NONE);
    expect(r.evaluation).toEqual({ verdict: 'almost', errorType: 'typo', punctuationNote: true });
    expect(show(r.cells)).toEqual(['missing:_/n', 'punct:_/!']);
  });

  it('the typographic space before ? : ; ! is not shown at all', () => {
    expect(checkWritten('Ça va ?', 'ça va?', fr, NONE).cells.every((c) => c.status === 'ok')).toBe(true);
  });

  describe('on generated pairs: the marks never contradict the verdict', () => {
    let seed = 20261017;
    const r = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const WORDS = ['ça', 'va', 'le', "l'", 'nom', 'été', 'ete', 'bonjour', 'bonjuor', 'oui', 'merci', 'aujourd', "'hui", 'est-ce'];
    const MARKS = ['', '', '', ' ?', '?', ',', '.', ' !', '…', ' :', '«', '»', '"'];
    const phrase = () => {
      const n = 1 + Math.floor(r() * 3);
      let s = '';
      for (let k = 0; k < n; k++) s += (k ? ' ' : '') + WORDS[Math.floor(r() * WORDS.length)]! + MARKS[Math.floor(r() * MARKS.length)]!;
      return s;
    };
    const mutate = (s: string) => {
      const c = s.split('');
      const k = Math.floor(r() * Math.max(1, c.length));
      switch (Math.floor(r() * 5)) {
        case 0:
          return s.replace(/[.,!?;:…«»"]/g, '');
        case 1:
          c.splice(k, 1);
          return c.join('');
        case 2:
          c.splice(k, 0, r() < 0.5 ? 'x' : '?');
          return c.join('');
        case 3:
          return s + (r() < 0.5 ? ' !' : '.');
        default:
          return s;
      }
    };

    it('3000 pairs', () => {
      for (let k = 0; k < 3000; k++) {
        const e = phrase();
        const a = r() < 0.2 ? phrase() : mutate(e);
        const { evaluation, cells } = checkWritten(e, a, fr, NONE);
        const ctx = `${JSON.stringify(e)} ← ${JSON.stringify(a)}: ${show(cells).join(' ')}`;
        // Both lines are the shown texts (spaces that only vanished with a mark are left out).
        const line = (cs: string[]) => cs.join('').toLowerCase().replace(/ /g, '');
        const text = (x: string) => foldShown(x).map((ch) => ch.c).join('').replace(/ /g, '');
        expect(line(cells.flatMap((c) => (c.top === null ? [] : [c.top]))), ctx).toBe(text(a));
        expect(line(cells.flatMap((c) => (c.bottom === null ? [] : [c.bottom]))), ctx).toBe(text(e));
        const errors = cells.filter((c) => c.status !== 'ok' && c.status !== 'punct');
        if (evaluation.verdict === 'correct') expect(errors, ctx).toEqual([]);
        else expect(errors.length, ctx).toBeGreaterThan(0);
        expect(evaluation.punctuationNote === true, ctx).toBe(cells.some((c) => c.status === 'punct'));
      }
    });
  });
});
