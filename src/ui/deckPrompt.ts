/**
 * The instructions for an AI that makes a personal deck (R33 item 15, R34): the user
 * copies one text from the app into a chat with an AI. The AI first asks what to make
 * the deck from, then shows a table to check, and gives deck.json only after the
 * user's "yes". The app fills in the deck language, the meaning language from the
 * settings and the installed entries — no task template to fill in.
 *
 * The AI talks to the user in Russian (tg and ru interface) or English (en), and the
 * rules are in the same language (R34); the user may ask for another one. The rules
 * follow docs/DECK_PROMPT.md (the admin version, with `npm run deck:check`) without
 * commands or repository files: audio is optional, the check report comes from the
 * app, personal deck ids start with `my-`.
 *
 * The texts are data in src/ui/deckPrompt/*.md (rules.<lang>.md, data.<lang>.md), read at build
 * time like docs/NOTICE.md. When a rule changes in docs/DECK_PROMPT.md, change it there too
 * (src/ui/deckPrompt.test.ts compares the synonym tables).
 */
import { PROMPT_LANGUAGE_NAMES_RU } from '../core/cyrillicData';
import dataEn from './deckPrompt/data.en.md?raw';
import dataRu from './deckPrompt/data.ru.md?raw';
import rulesEn from './deckPrompt/rules.en.md?raw';
import rulesRu from './deckPrompt/rules.ru.md?raw';
import type { Lang } from './strings';

/** What the app fills in at the end of the instructions. */
export interface PromptData {
  /** Interface language: picks the rules and the conversation language. */
  lang: Lang;
  /** Meaning language from the settings. */
  meaningLang: Lang;
  /** Learning language of the new deck (BCP-47). */
  language: string;
  /** The installed entries, as `installedForAi` writes them. */
  installed: string;
}

const LANG_NAMES_EN: Record<Lang, string> = { tg: 'Tajik (tg)', ru: 'Russian (ru)', en: 'English (en)' };

/** The rules and the AI conversation are in Russian for the tg and ru interface, in English for en (R34). */
export function promptLanguage(lang: Lang): 'ru' | 'en' {
  return lang === 'en' ? 'en' : 'ru';
}

function fill(template: string, values: Record<string, string>): string {
  return template.trimEnd().replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');
}

function dataBlock(d: PromptData): string {
  const english = promptLanguage(d.lang) === 'en';
  return fill(english ? dataEn : dataRu, {
    language: d.language,
    meaningLanguage: english ? LANG_NAMES_EN[d.meaningLang] : PROMPT_LANGUAGE_NAMES_RU[d.meaningLang],
    installed: d.installed,
  });
}

/** The one text the user copies into a chat with an AI. */
export function deckPromptText(d: PromptData): string {
  const rules = promptLanguage(d.lang) === 'en' ? rulesEn : rulesRu;
  return `${rules.trimEnd()}

${dataBlock(d)}
`;
}
