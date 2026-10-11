import { describe, expect, it } from 'vitest';
import { editDistance, evaluate, normalize } from './evaluate';
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
