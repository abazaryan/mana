import { describe, expect, it } from 'vitest';
import { installedForAi } from '../core/deckReport';
import { deckPromptText, promptLanguage } from './deckPrompt';

const installed = (lang: 'ru' | 'en') =>
  installedForAi([{ id: 'fr-lesson-01', title: 'Урок 1', language: 'fr-FR', entries: [{ text: 'salut', meaning: { ru: 'привет' } }] }], lang);

describe('the instructions for the AI (Р34)', () => {
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
});
