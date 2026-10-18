import { describe, expect, it } from 'vitest';
import glossary from '../../docs/GLOSSARY_TG.md?raw';
import generated from './tgDeckTerms.ts?raw';
import { contentWarnings, splitLeadingArticle } from './deckContent';
import { parseDeckTerms, renderDeckTerms } from './glossaryTerms';
import { FRENCH } from './languages';

const rules = FRENCH.deckRules!;
let k = 0;
const e = (text: string, over: Record<string, unknown> = {}) => ({
  id: `e${k++}`,
  text,
  meaning: { tg: `т${k}`, ru: `р${k}`, en: `e${k}` },
  skills: ['speak'],
  ...over,
});
const warns = (entries: unknown[]) => contentWarnings(entries, rules).map((w) => w.message);
const has = (entries: unknown[], part: string) => warns(entries).filter((m) => m.includes(part));

describe('deck content (Р28)', () => {
  it('splits a leading article, elided or not', () => {
    expect(splitLeadingArticle("l'ami", rules.articles)).toEqual({ article: "l'", rest: 'ami' });
    expect(splitLeadingArticle('la maison', rules.articles)).toEqual({ article: 'la', rest: 'maison' });
    expect(splitLeadingArticle('lait', rules.articles)).toBeNull();
  });

  it('В1: the same meaning and nothing to tell the entries apart', () => {
    const a = e('bonjour', { meaning: { tg: 'салом', ru: 'добрый день' } });
    const b = e('salut', { meaning: { tg: 'Салом.', ru: 'привет' } });
    expect(has([a, b], 'одинаковое значение (tg)')).toHaveLength(1);
    // A hint or a form that differs settles it.
    expect(has([a, { ...b, hint: { tg: 'ғайрирасмӣ' } }], 'одинаковое значение')).toEqual([]);
    const ravi = e('ravi', { meaning: { tg: 'шодам', en: 'glad' }, form: { gender: 'm' } });
    const ravie = e('ravie', { meaning: { tg: 'шодам', en: 'glad' }, form: { gender: 'f' } });
    expect(has([ravi, ravie], 'одинаковое значение')).toEqual([]);
  });

  it('В2: a word with an article needs form.determiner; phrases and untagged entries are not judged', () => {
    expect(has([e('le livre', { tags: ['word'], skills: ['write'] })], 'без form.determiner')).toHaveLength(1);
    expect(has([e('le livre', { tags: ['word'], form: { determiner: 'definite' }, skills: ['write'] })], 'без form.determiner')).toEqual([]);
    expect(has([e('la vie est belle', { tags: ['phrase'] })], 'без form.determiner')).toEqual([]);
  });

  it('В3: a noun with l\' needs its indefinite pair; le / la nouns do not', () => {
    const lami = e("l'ami", { form: { determiner: 'definite', gender: 'm' }, skills: ['write'] });
    expect(has([lami], 'не виден')).toHaveLength(1);
    const unAmi = e('un ami', { form: { determiner: 'indefinite', gender: 'm' }, skills: ['write'] });
    expect(has([lami, unAmi], 'не виден')).toEqual([]);
    expect(has([e('le livre', { form: { determiner: 'definite' }, skills: ['write'] })], 'не виден')).toEqual([]);
  });

  it('В4: a noun with form.determiner and no write', () => {
    expect(has([e('le livre', { form: { determiner: 'definite' } })], 'без write')).toHaveLength(1);
    expect(has([e('le livre', { form: { determiner: 'definite' }, skills: ['speak', 'write'] })], 'без write')).toEqual([]);
  });

  it('В5: two forms that differ only in the gender ending both need form.gender', () => {
    expect(has([e('ravi'), e('ravie', { form: { gender: 'f' } })], 'другого рода')).toHaveLength(1);
    expect(has([e("l'ami"), e("l'amie")], 'другого рода')).toHaveLength(2);
    expect(has([e('heureux'), e('heureuse')], 'другого рода')).toHaveLength(2);
    expect(has([e('petit', { form: { gender: 'm' } }), e('petite', { form: { gender: 'f' } })], 'другого рода')).toEqual([]);
    expect(has([e('livre'), e('lire')], 'другого рода')).toEqual([]);
  });

  it('В6: il / elle / ils / elles need form.gender, impersonal il does not', () => {
    expect(has([e('ils parlent français')], 'подлежащее')).toHaveLength(1);
    expect(has([e('elle est seule', { form: { gender: 'f' } })], 'подлежащее')).toEqual([]);
    for (const t of ['il y a du pain', 'il faut partir', 'il pleut', 'Il fait beau.']) expect(has([e(t)], 'подлежащее'), t).toEqual([]);
    expect(has([e('illustre')], 'подлежащее')).toEqual([]);
  });

  it('В7: un / une alone need form.gender', () => {
    expect(has([e('un')], 'число с родом')).toHaveLength(1);
    expect(has([e('une.')], 'число с родом')).toHaveLength(1);
    expect(has([e('un', { form: { gender: 'm' } })], 'число с родом')).toEqual([]);
  });

  it('В8: grammar written into a meaning or hint', () => {
    expect(has([e('ravi', { meaning: { tg: 'шодам (мард)' } })], 'грамматика текстом')).toHaveLength(1);
    expect(has([e('ravi', { meaning: { en: 'glad (m.)' } })], 'грамматика текстом')).toHaveLength(1);
    expect(has([e('ravie', { meaning: { ru: 'рада (ж. р.)' } })], 'грамматика текстом')).toHaveLength(1);
    expect(has([e('ça va', { meaning: { tg: 'Чӣ хел? (корҳо хуб?)' } })], 'грамматика текстом')).toEqual([]);
  });

  it('rejected Tajik words come from the glossary', () => {
    expect(has([e('le nom', { hint: { tg: 'бо артикл' } })], 'по глоссарию')).toHaveLength(1);
    expect(has([e('le nom', { hint: { tg: 'шиносвожаи муайян' } })], 'по глоссарию')).toEqual([]);
  });

  it('В9: listen without deck audio', () => {
    expect(has([e('oui', { skills: ['listen'] })], 'нет audio')).toHaveLength(1);
    expect(has([e('oui', { skills: ['listen'], audio: 'audio/oui.mp3' })], 'нет audio')).toEqual([]);
  });

  it('В10: tu / vous need (informal) / (formal) in the English meaning; rendez-vous is not address', () => {
    expect(has([e('Tu parles français ?', { meaning: { en: 'Do you speak French?' } })], '(informal)')).toHaveLength(1);
    expect(has([e('Tu parles français ?', { meaning: { en: 'Do you speak French? (informal)' } })], '(informal)')).toEqual([]);
    expect(has([e('Parlez-vous français ?', { meaning: { en: 'Do you speak French?' } })], '(formal)')).toHaveLength(1);
    expect(has([e("Je t'aime", { meaning: { en: 'I love you' } })], '(informal)')).toHaveLength(1);
    expect(has([e('un rendez-vous', { meaning: { en: 'an appointment' } })], '(formal)')).toEqual([]);
    // Without an English meaning there is nothing to mark.
    expect(has([e('vous êtes', { meaning: { tg: 'шумо … ҳастед' } })], '(formal)')).toEqual([]);
  });

  it('without language rules only the language-neutral checks run', () => {
    const msgs = contentWarnings([e('un'), e('le livre', { tags: ['word'] }), e('oui', { skills: ['listen'] })], undefined).map((w) => w.message);
    expect(msgs.some((m) => m.includes('нет audio'))).toBe(true);
    expect(msgs.some((m) => m.includes('число с родом') || m.includes('form.determiner'))).toBe(false);
  });
});

describe('rejected deck words: docs/GLOSSARY_TG.md is the source', () => {
  const md = glossary;

  it('the glossary table has the words', () => {
    expect(parseDeckTerms(md).map((t) => t.word)).toContain('артикл');
  });

  it('src/core/tgDeckTerms.ts is up to date (npm run glossary:terms)', () => {
    expect(generated.replace(/\r\n/g, '\n')).toBe(renderDeckTerms(parseDeckTerms(md)));
  });

  it('parses only that table', () => {
    const doc = `# x\n\n| a | b |\n| --- | --- |\n| no | no |\n\n## Проверка колоды: отклонённые слова\n\ntext\n\n| Слово | Вместо |\n| --- | --- |\n| Артикл | шиносвожа |\n| род | ҷинс |\n\n## Next\n| x | y |\n`;
    expect(parseDeckTerms(doc)).toEqual([
      { word: 'артикл', use: 'шиносвожа' },
      { word: 'род', use: 'ҷинс' },
    ]);
  });
});
