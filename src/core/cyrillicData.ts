/**
 * Cyrillic the logic needs as data (CLAUDE.md, "Cyrillic in code"; the scanner lists this file in
 * DATA_FILES). Nothing here is logic: identifiers that are already in the learner's journal,
 * a heading that must match docs/GLOSSARY_TG.md, trilingual labels, the sample deck of the
 * stage 1 prototype. Comments stay English.
 */
import type { Determiner, Gender, GrammaticalNumber } from './deckFormat';

/**
 * Ids of the sound rules, written to the journal (`soundRules`, R22). Latin Z1…Z9 in comments and
 * docs are these. Changing an id would split the journal in two kinds of records.
 */
export const SOUND_RULE = {
  Z1: 'З1',
  Z2: 'З2',
  Z3: 'З3',
  Z4: 'З4',
  Z5: 'З5',
  Z6: 'З6',
  Z7: 'З7',
  Z8: 'З8',
  Z9: 'З9',
} as const;

/** Rule id of a match of digits against words (said "21", written "vingt et un"). */
export const DIGITS_RULE = 'Ч';

/** Rule id of a spoken answer that matched the entry's `speech` rather than its text (R34). */
export const SPEECH_RULE = 'Г';

/** The heading in docs/GLOSSARY_TG.md above the table of words the deck check rejects (R28). */
export const DECK_TERMS_HEADING = '## Проверка колоды: отклонённые слова';

/** Grammar written into a meaning or hint instead of `form` (R28): "(м.)", "(f.)", "(мард)", "(зан)"… */
export const GRAMMAR_MARK = /\((?:м|ж|ср|m|f|n|masc|fem|муз|муан|мард|зан)\.?(?:\s*р\.)?\)/iu;

/** Form hint labels in interface languages (R14, R16). */
export const FORM_LABELS: {
  determiner: Record<Determiner, Record<'tg' | 'ru' | 'en', string>>;
  gender: Record<Gender, Record<'tg' | 'ru' | 'en', string>>;
  number: Record<GrammaticalNumber, Record<'tg' | 'ru' | 'en', string>>;
} = {
  determiner: {
    definite: { tg: 'муай.', ru: 'опред.', en: 'def.' },
    indefinite: { tg: 'номуай.', ru: 'неопред.', en: 'indef.' },
  },
  gender: {
    m: { tg: 'музак.', ru: 'м. р.', en: 'm.' },
    f: { tg: 'муан.', ru: 'ж. р.', en: 'f.' },
    n: { tg: 'хунсо', ru: 'ср. р.', en: 'n.' },
  },
  number: {
    singular: { tg: 'танҳ.', ru: 'ед. ч.', en: 'sg.' },
    plural: { tg: 'ҷамъ', ru: 'мн. ч.', en: 'pl.' },
  },
};

/** Texts of the French language pack in the interface languages (R13, R27, R33 item 14). */
export const FRENCH_TEXTS = {
  name: { tg: 'фаронсавӣ', ru: 'французский', en: 'French' },
  /** "In French", ready-made: put into the `speak` instruction and field. */
  inLanguage: { tg: 'ба фаронсавӣ', ru: 'по-французски', en: 'in French' },
  /** The question after the browser voice said the sample phrase ("Voice check"). */
  voiceCheckQuestion: { tg: 'Садои фаронсавиро шунидед?', ru: 'Слышен французский голос?', en: 'Did you hear a French voice?' },
};

/** The sample deck of the stage 1 prototype page (#/prototype): "ru | fr", one card per line. */
export const DEFAULT_DECK_TEXT = [
  'Здравствуйте, как дела? | Bonjour, comment allez-vous ?',
  "Я хотел бы кофе, пожалуйста. | Je voudrais un café, s'il vous plaît.",
  'Где находится вокзал? | Où est la gare ?',
  "Я живу в Люксембурге. | J'habite à Luxembourg.",
  'Сколько это стоит? | Combien ça coûte ?',
  'Я не понимаю. | Je ne comprends pas.',
  "Можете повторить, пожалуйста? | Pouvez-vous répéter, s'il vous plaît ?",
  'Я работаю разработчиком. | Je travaille comme développeur.',
  'Который час? | Quelle heure est-il ?',
  'Приятно познакомиться. | Enchanté.',
  "Мне нужна помощь. | J'ai besoin d'aide.",
].join('\n');

/** Names of the meaning languages in the Russian rules for the AI (src/ui/deckPrompt/data.ru.md). */
export const PROMPT_LANGUAGE_NAMES_RU: Record<'tg' | 'ru' | 'en', string> = {
  tg: 'таджикский (tg)',
  ru: 'русский (ru)',
  en: 'английский (en)',
};
