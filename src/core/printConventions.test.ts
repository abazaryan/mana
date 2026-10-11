import { describe, expect, it } from 'vitest';
import { FRENCH } from './languages';
import {
  articleSlashPattern,
  expandPrintConventions,
  foldText,
  lexemeKey,
  mirrorGloss,
  splitByMeaning,
  type AppliedConventions,
} from './printConventions';

const fr = FRENCH.writing;
const expand = (s: string) => expandPrintConventions(s, fr);
const key = (s: string) => lexemeKey(s, fr);
const NOTHING: AppliedConventions = { bracket: false, slash: false };

describe('expandPrintConventions', () => {
  it('leaves a plain form alone', () => {
    expect(expand('la pluie')).toEqual({
      canon: 'la pluie',
      alternates: [],
      applied: NOTHING,
      bareSlash: false,
      droppedAnnotations: [],
    });
  });

  it('drops an attached bracket from the canon and keeps the form as an alternate', () => {
    const e = expand('ravi(e)');
    expect(e.canon).toBe('ravi');
    expect(e.alternates).toEqual([{ text: 'ravie', source: 'bracket' }]);
    expect(e.applied).toEqual({ bracket: true, slash: false });
  });

  it('keeps the tail after a mid-string bracket', () => {
    const e = expand('Oui, je suis fatigué(e).');
    expect(e.canon).toBe('Oui, je suis fatigué.');
    expect(e.alternates).toEqual([{ text: 'Oui, je suis fatiguée.', source: 'bracket' }]);
  });

  it('splits a spaced slash, first phrasing first', () => {
    const e = expand("Vous venez d'où ? / Tu viens d'où ?");
    expect(e.canon).toBe("Vous venez d'où ?");
    expect(e.alternates).toEqual([{ text: "Tu viens d'où ?", source: 'slash' }]);
    expect(e.applied).toEqual({ bracket: false, slash: true });
  });

  it('keeps the French space before ? and drops one before . and ,', () => {
    expect(expand('tu viens ?').canon).toBe('tu viens ?');
    expect(expand('Vous êtes prêt(e) ?').canon).toBe('Vous êtes prêt ?');
    expect(expand('Bon , on y va .').canon).toBe('Bon, on y va.');
  });

  it('expands the nested case combinatorially (canon + 3)', () => {
    const e = expand('Vous êtes prêt(e) ? / Tu es prêt(e) ?');
    expect(e.canon).toBe('Vous êtes prêt ?');
    expect(e.alternates).toEqual([
      { text: 'Vous êtes prête ?', source: 'bracket' },
      { text: 'Tu es prêt ?', source: 'slash' },
      { text: 'Tu es prête ?', source: 'slash' },
    ]);
    expect(e.applied).toEqual({ bracket: true, slash: true });
  });

  it('reports a bare slash instead of touching it', () => {
    for (const s of ['voisin/voisine', 'le train Paris/Lyon']) {
      const e = expand(s);
      expect(e.canon).toBe(s);
      expect(e.alternates).toEqual([]);
      expect(e.bareSlash).toBe(true);
      expect(e.applied).toEqual(NOTHING);
    }
  });

  it('does not invent a form out of an annotation bracket, and reports it', () => {
    const e = expand("l'arbre (m.)");
    expect(e.canon).toBe("l'arbre");
    expect(e.alternates).toEqual([]);
    expect(e.droppedAnnotations).toEqual(['(m.)']);
    expect(e.applied).toEqual(NOTHING);
  });

  it('treats a detached letters-only bracket as an annotation', () => {
    // The space decides, not the content: `(minou)` holds only letters.
    const e = expand('le chat (minou)');
    expect(e.canon).toBe('le chat');
    expect(e.alternates).toEqual([]);
    expect(e.droppedAnnotations).toEqual(['(minou)']);
    expect(e.applied).toEqual(NOTHING);
  });

  it("reports the bracket of the canon's own part only", () => {
    expect(expand('A / B(e)').applied).toEqual({ bracket: false, slash: true });
    expect(expand('A(e) / B').applied).toEqual({ bracket: true, slash: true });
  });

  it('never returns an empty canon', () => {
    expect(expand('(ne)').canon).toBe('(ne)');
    expect(expand('').canon).toBe('');
    expect(expand('(ne)').alternates).toEqual([]);
    expect(expand('').alternates).toEqual([]);
  });

  it('never repeats the canon and never returns duplicates', () => {
    expect(expand('merci / merci').alternates).toEqual([]);
    expect(expand('ami(x) / ami(x)').alternates).toEqual([{ text: 'amix', source: 'bracket' }]);
  });
});

describe('expandPrintConventions, articles round a bare slash', () => {
  it('gives an epicene noun its two articles and nothing else', () => {
    const e = expand('le/la journaliste');
    expect(e.canon).toBe('le journaliste');
    expect(e.alternates).toEqual([{ text: 'la journaliste', source: 'slash' }]);
    expect(e.bareSlash).toBe(false);
    expect(e.applied).toEqual({ bracket: false, slash: true });
  });

  it('inlines the bracket for the second reading only', () => {
    const e = expand('le/la voisin(e)');
    expect(e.canon).toBe('le voisin');
    expect(e.alternates).toEqual([{ text: 'la voisine', source: 'slash' }]);
    expect(e.droppedAnnotations).toEqual([]);
  });

  it('agrees two brackets instead of expanding them independently', () => {
    const e = expand('le/la petit(e) voisin(e)');
    expect(e.canon).toBe('le petit voisin');
    expect(e.alternates).toEqual([{ text: 'la petite voisine', source: 'slash' }]);
  });

  it('handles a feminine ending that is a whole suffix', () => {
    const e = expand('le/la musicien(ne)');
    expect(e.canon).toBe('le musicien');
    expect(e.alternates).toEqual([{ text: 'la musicienne', source: 'slash' }]);
  });

  it('requires the articles at the very start', () => {
    const e = expand('dans le/la cuisine');
    expect(e.canon).toBe('dans le/la cuisine');
    expect(e.bareSlash).toBe(true);
  });

  it('builds the pattern from the language pack', () => {
    expect(articleSlashPattern(fr)?.test('un/une voisin(e)')).toBe(true);
    expect(articleSlashPattern(fr)?.test('der/die Nachbar')).toBe(false);
    expect(articleSlashPattern({ ...fr, slashArticles: [] })).toBeNull();
  });
});

describe('mirrorGloss', () => {
  it('returns the gloss byte for byte when nothing was applied', () => {
    expect(mirrorGloss('ключ (от двери)', NOTHING)).toBe('ключ (от двери)');
    expect(mirrorGloss('а / б', NOTHING)).toBe('а / б');
    expect(mirrorGloss('ключ  (от двери) !', NOTHING)).toBe('ключ  (от двери) !');
  });

  it('drops the gloss bracket when a bracket was expanded', () => {
    const applied = { bracket: true, slash: false };
    expect(mirrorGloss('усталый (усталая)', applied)).toBe('усталый');
    expect(mirrorGloss('Да, я устал (устала).', applied)).toBe('Да, я устал.');
  });

  it('takes the first gloss part when the text was split on the slash', () => {
    expect(mirrorGloss('Откуда вы? / Откуда ты?', { bracket: false, slash: true })).toBe('Откуда вы?');
  });

  it('applies brackets before the slash', () => {
    const both = { bracket: true, slash: true };
    expect(mirrorGloss('Вы готовы (готова)? / Ты готов (готова)?', both)).toBe('Вы готовы?');
    expect(mirrorGloss('Вы готовы (готов / готова)? / Ты готов (готов / готова)?', both)).toBe(
      'Вы готовы?',
    );
  });

  it('leaves no space before punctuation in the gloss', () => {
    expect(mirrorGloss('hello (hi) !', { bracket: true, slash: false })).toBe('hello!');
  });

  it('tolerates a gloss without a convention of its own', () => {
    expect(mirrorGloss('сосед', { bracket: true, slash: false })).toBe('сосед');
  });
});

describe('splitByMeaning', () => {
  const split = (text: string, gloss: string) => splitByMeaning(text, gloss, fr);

  it('splits two proper nouns and distributes the common part', () => {
    expect(split('le train Paris/Lyon', 'поезд Paris/Lyon')).toEqual([
      { text: 'le train Paris', gloss: 'поезд Paris' },
      { text: 'le train Lyon', gloss: 'поезд Lyon' },
    ]);
  });

  it('tidies each side by its own rules', () => {
    expect(split('le train Paris/Lyon !', 'train Paris/Lyon !')).toEqual([
      { text: 'le train Paris !', gloss: 'train Paris!' },
      { text: 'le train Lyon !', gloss: 'train Lyon!' },
    ]);
  });

  it('keeps the whole gloss when only the text has the shape', () => {
    expect(split('le train Paris/Lyon', 'поезд')).toEqual([
      { text: 'le train Paris', gloss: 'поезд' },
      { text: 'le train Lyon', gloss: 'поезд' },
    ]);
  });

  it('does not split two forms of one word', () => {
    expect(split('voisin/voisine', 'сосед/соседка')).toBeNull();
    expect(split('un/une', 'один/одна')).toBeNull();
  });

  it('does not split without a bare slash', () => {
    expect(split('la pluie', 'дождь')).toBeNull();
    expect(split("Vous venez d'où ? / Tu viens d'où ?", 'Откуда вы?')).toBeNull();
  });

  it('refuses ambiguous shapes rather than guessing', () => {
    expect(split('le train Paris/Lyon/Nice', 'поезд')).toBeNull();
    expect(split('A/B C/D', 'x')).toBeNull();
    expect(split('le train Paris/lyon', 'поезд')).toBeNull();
  });
});

describe('foldText', () => {
  it('folds case, apostrophes and spaces, keeps diacritics', () => {
    expect(foldText('  L’Été   Chaud ')).toBe("l'été chaud");
    expect(foldText('e')).not.toBe(foldText('é'));
  });
});

describe('lexemeKey', () => {
  it('folds case but keeps the article', () => {
    expect(key('Le Marché')).toBe('le marché');
    expect(key('les Pyrénées')).toBe('les pyrénées');
  });

  it('drops optional feminine markers', () => {
    expect(key('fatigué(e)')).toBe('fatigué');
    expect(key('musicien(ne)')).toBe('musicien');
    expect(key('prêt(e)')).toBe(key('prêt'));
  });

  it('is blind to print conventions', () => {
    expect(key('ravi(e)')).toBe(key('ravi'));
    expect(key("Vous venez d'où ? / Tu viens d'où ?")).toBe(key("Vous venez d'où ?"));
    expect(key('Vous êtes prêt(e) ? / Tu es prêt(e) ?')).toBe(key('Vous êtes prêt ?'));
    // A bare slash is a meaning call, not a convention.
    expect(key('voisin/voisine')).not.toBe(key('voisin'));
  });

  it('is not blind to article, gender, diacritics or number', () => {
    expect(key('la France')).not.toBe(key('français'));
    expect(key('fatigué')).not.toBe(key('fatiguée'));
    expect(key('eleve')).not.toBe(key('élève'));
    expect(key('la fleur')).not.toBe(key('les fleurs'));
  });

  it('normalizes curly apostrophes', () => {
    expect(key('l’arbre')).toBe(key("l'arbre"));
  });
});
