import { describe, expect, it } from 'vitest';
import adminPrompt from '../../docs/DECK_PROMPT.md?raw';
import { installedForAi } from '../core/deckReport';
import { deckPromptText, promptLanguage } from './deckPrompt';
import rulesEn from './deckPrompt/rules.en.md?raw';
import rulesRu from './deckPrompt/rules.ru.md?raw';

const installed = (lang: 'ru' | 'en') =>
  installedForAi([{ id: 'fr-lesson-01', title: 'Урок 1', language: 'fr-FR', entries: [{ text: 'salut', meaning: { ru: 'привет' } }] }], lang);

describe('the instructions for the AI (R34)', () => {
  it('Russian rules and conversation for the tg and ru interface, English for en', () => {
    expect(promptLanguage('tg')).toBe('ru');
    expect(promptLanguage('ru')).toBe('ru');
    expect(promptLanguage('en')).toBe('en');
    const tg = deckPromptText({ lang: 'tg', meaningLang: 'tg', language: 'fr-FR', installed: installed('ru') });
    expect(tg).toContain('Говори с учеником по-русски');
    expect(tg).toContain('ученик попросит другой язык');
    const en = deckPromptText({ lang: 'en', meaningLang: 'en', language: 'fr-FR', installed: installed('en') });
    expect(en).toContain('Talk to the learner in English');
    expect(en).not.toContain('Говори');
  });

  it('carries the settings and the installed entries, no template to fill in', () => {
    const text = deckPromptText({ lang: 'ru', meaningLang: 'tg', language: 'fr-FR', installed: installed('ru') });
    expect(text).toContain('Изучаемый язык (language): fr-FR');
    expect(text).toContain('Языки значений (meaning, hint, note, title, названия тегов): таджикский (tg)');
    expect(text).toContain('«Урок 1» (id fr-lesson-01, fr-FR):');
    expect(text).toContain('- salut — ru: привет');
    expect(text).not.toContain('ЗАДАНИЕ');
    expect(text.trimEnd().endsWith('Начни с первых вопросов (шаг 1).')).toBe(true);
  });

  it('questions first, then the table, deck.json only after a yes; photos, size, synonyms, speech', () => {
    for (const lang of ['ru', 'en'] as const) {
      const text = deckPromptText({ lang, meaningLang: lang, language: 'fr-FR', installed: installed(lang) });
      expect(text).toMatch(lang === 'ru' ? /Не делай колоду сразу/ : /Do not make the deck right away/);
      expect(text).toContain(lang === 'ru' ? '| № | text | значение | форма | подсказка | голос |' : '| # | text | meaning | form | hint | voice |');
      expect(text).toMatch(lang === 'ru' ? /deck\.json — ТОЛЬКО после явного согласия/ : /deck\.json — ONLY after the learner clearly agrees/);
      expect(text).toMatch(lang === 'ru' ? /одну страницу на одном фото/ : /one page per photo/);
      expect(text).toContain('20–40');
      expect(text).toMatch(lang === 'ru' ? /salut — и «привет», и «пока»/ : /salut — both "hi" and "bye"/);
      expect(text).toContain('"speech": "tchao"');
    }
  });

  it('close expressions: 2–3 per group by default, situation hints, "in full" for the full form', () => {
    const ru = deckPromptText({ lang: 'ru', meaningLang: 'ru', language: 'fr-FR', installed: installed('ru') });
    expect(ru).toContain('БЛИЗКИЕ ВЫРАЖЕНИЯ');
    expect(ru).toContain('не больше 2–3 записей одной группы');
    expect(ru).toContain('Если ученик сам просит колоду про эту группу');
    expect(ru).toContain('hint с ситуацией употребления');
    expect(ru).toContain('«полностью»');
    const en = deckPromptText({ lang: 'en', meaningLang: 'en', language: 'fr-FR', installed: installed('en') });
    expect(en).toContain('CLOSE EXPRESSIONS');
    expect(en).toContain('no more than 2–3 entries of one group');
    expect(en).toContain('("in full")');
  });
});

/** The meaning columns (tg, ru, en) of the synonym table, row by row: [fr word, tg, ru, en]. */
function synonymRows(markdown: string): string[][] {
  return markdown
    .split(/\r?\n/)
    .filter((l) => l.startsWith('| ') && !l.startsWith('| fr ') && !l.startsWith('| ---'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .map(([fr, tg, ru, en]) => [fr!.replace(/ \(.*\)$/, ''), tg!, ru!, en!]);
}

describe('one rule, two documents: the synonym table of the admin instruction and of the app', () => {
  const admin = synonymRows(adminPrompt);

  it('docs/DECK_PROMPT.md and rules.ru.md give the same meanings for the same words', () => {
    const app = synonymRows(rulesRu);
    expect(app.length).toBeGreaterThan(5);
    expect(admin).toEqual(app.map(([fr, ...meanings]) => [fr, ...meanings]));
  });

  it('rules.en.md has the same table as rules.ru.md', () => {
    expect(synonymRows(rulesEn)).toEqual(synonymRows(rulesRu));
  });
});
