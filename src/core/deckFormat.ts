/**
 * Mana deck format ("mana-deck", version 1): types and validation.
 * Spec: docs/DECK_FORMAT.md. JSON Schema: ./mana-deck.schema.json.
 *
 * Pure logic with no runtime imports: also run directly by Node in scripts/validate-deck.ts.
 * Language-specific rules come from language packs (./languages.ts) via options.
 * Messages are in Russian — they are shown to the deck author.
 */
import { contentWarnings } from './deckContent.ts';

export const DECK_FORMAT = 'mana-deck';
/** Former identifier (working name "Sluh", Р20): still accepted, with a warning. */
export const LEGACY_DECK_FORMAT = 'sluh-deck';
export const DECK_VERSION = 1;
export const DECK_JSON = 'deck.json';
export const AUDIO_DIR = 'audio/';

export const SKILLS = ['listen', 'speak', 'write'] as const;
export type Skill = (typeof SKILLS)[number];

/** Interface languages; meanings, hints, notes and tag names are given in them. */
export const UI_LANGS = ['tg', 'ru', 'en'] as const;
export type UiLang = (typeof UI_LANGS)[number];

export const GENDERS = ['m', 'f', 'n'] as const;
export type Gender = (typeof GENDERS)[number];

export const DETERMINERS = ['definite', 'indefinite'] as const;
export type Determiner = (typeof DETERMINERS)[number];

export const NUMBERS = ['singular', 'plural'] as const;
export type GrammaticalNumber = (typeof NUMBERS)[number];

/**
 * Which form of the item the answer must be in (decision Р16). Shown as hints
 * before the answer, in the interface language: one correct answer per entry (Р3),
 * so `ravi` and `ravie` are two entries told apart by `form.gender`.
 */
export interface EntryForm {
  determiner?: Determiner;
  gender?: Gender;
  number?: GrammaticalNumber;
}

export const FORM_KEYS = ['determiner', 'gender', 'number'] as const;

export const AUDIO_EXTENSIONS = ['mp3', 'wav'] as const;

/** Above this archive size the validator warns (mobile download, shared library, offline). */
export const LARGE_ARCHIVE_BYTES = 20 * 1024 * 1024;

/** Stable ids of decks and entries: lowercase latin letters, digits, "-", "_", ".". */
export const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** Simplified BCP-47: language[-Script][-REGION], e.g. "fr-FR", "lb-LU", "de", "sr-Latn-RS". */
export const LANGUAGE_TAG_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$/;

export type Localized = Partial<Record<UiLang, string>>;

export interface DeckEntry {
  id: string;
  text: string;
  ipa?: string;
  meaning: Localized;
  hint?: Localized;
  note?: Localized;
  audio?: string;
  /** Gender of the word itself; shown at the introduction only, not when recalling. */
  gender?: Gender;
  /** Form hints shown before the answer. */
  form?: EntryForm;
  /** Tag codes, described in Deck.tags. */
  tags?: string[];
  skills: Skill[];
}

export interface Deck {
  format: typeof DECK_FORMAT;
  version: typeof DECK_VERSION;
  id: string;
  revision: number;
  language: string;
  /** Tag code → tag name in interface languages. */
  tags?: Record<string, Localized>;
  /**
   * Deck name in interface languages (Р30); shown in the interface language, else any.
   * Without it the name is the ZIP file name on install and stays on update.
   */
  title?: Localized;
  entries: DeckEntry[];
}

/** What the validator needs to know about a supported learning language. */
export interface LanguageSupport {
  /** Primary BCP-47 subtag, e.g. "fr". */
  code: string;
  genders: readonly Gender[];
  /** Two texts sound the same (ravi / ravie): each one, said, is accepted for the other (Р16). */
  sameSound?(a: string, b: string): boolean;
  /** Lists for the deck content checks (Р28); absent → only the language-neutral checks. */
  deckRules?: DeckRules;
}

/** Language lists for the deck content checks (Р28, src/core/deckContent.ts). */
export interface DeckRules {
  /** Articles that can open a noun entry; an elided one ends with an apostrophe (`l'`). */
  articles: readonly string[];
  /** Articles that do not show the gender (`l'`): such a noun needs its indefinite pair. */
  genderlessArticles: readonly string[];
  /** Indefinite articles that show the gender (`un`, `une`). */
  indefiniteArticles: readonly string[];
  /** Subject pronouns whose gender the meaning may hide (`il`, `elle`, `ils`, `elles`). */
  subjectPronouns: readonly string[];
  /** Impersonal starts that need no gender (`il y a`, `il faut`, `il pleut`…), lower case. */
  impersonal: readonly string[];
  /** Numbers with a gender, as whole entries (`un`, `une`). */
  genderedNumbers: readonly string[];
  /** Masculine → feminine endings (`''` → `'e'`, `'eux'` → `'euse'`…): two entries that differ only so are a gender pair. */
  genderEndings: readonly (readonly [string, string])[];
  /** Words of informal / formal address (`tu`, `t'`, `ton`… / `vous`, `votre`…). */
  informal: readonly string[];
  formal: readonly string[];
  /** Hyphenated words that contain an address word but are not address (`rendez-vous`). */
  notAddress: readonly string[];
}

export interface DeckCheckOptions {
  /** Supported learning languages. If omitted, any well-formed language tag is accepted. */
  languages?: readonly LanguageSupport[];
  /** Size of the ZIP file, for the "large archive" warning. */
  archiveBytes?: number;
}

export interface DeckIssue {
  level: 'error' | 'warning';
  /** Machine-readable location, e.g. "entries[3].meaning.tg"; "" for the whole deck or archive. */
  path: string;
  /** Complete Russian sentence, including the location. */
  message: string;
}

export interface DeckCheck {
  /** Present only when there are no errors. */
  deck: Deck | null;
  errors: DeckIssue[];
  warnings: DeckIssue[];
}

const DECK_KEYS = new Set(['format', 'version', 'id', 'revision', 'language', 'tags', 'title', 'entries']);
const ENTRY_KEYS = new Set([
  'id', 'text', 'ipa', 'meaning', 'hint', 'note', 'audio', 'gender', 'form', 'tags', 'skills',
]);
/** Former field names: an error with a rename hint, not an "unknown field" warning. */
const OLD_ENTRY_KEYS = new Set(['fr', 'determiner']);

const GENDER_NAMES: Record<Gender, string> = { m: 'мужской', f: 'женский', n: 'средний' };

/** A bracket or a slash left in `text`: a printed way to pack two answers into one. */
const PACKED_FORMS = /[(/]/;

/** Form hint labels in interface languages (Р14, Р16). */
export const FORM_LABELS: {
  determiner: Record<Determiner, Record<UiLang, string>>;
  gender: Record<Gender, Record<UiLang, string>>;
  number: Record<GrammaticalNumber, Record<UiLang, string>>;
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

/** Hints for an entry's form, in the order determiner, gender, number. */
export function formHints(form: EntryForm | undefined, lang: UiLang): string[] {
  if (!form) return [];
  const out: string[] = [];
  if (form.determiner) out.push(FORM_LABELS.determiner[form.determiner][lang]);
  if (form.gender) out.push(FORM_LABELS.gender[form.gender][lang]);
  if (form.number) out.push(FORM_LABELS.number[form.number][lang]);
  return out;
}

/**
 * Labels of an introduction (Р16, amendment of 18.10.2026): the gender of the word,
 * then the form hints. The word's gender is left out when the form already shows the
 * same gender («un ami»: «номуай. · музак.», not «музак. · номуай. · музак.»).
 */
export function introHints(gender: Gender | undefined, form: EntryForm | undefined, lang: UiLang): string[] {
  const word = gender && form?.gender !== gender ? [FORM_LABELS.gender[gender][lang]] : [];
  return [...word, ...formHints(form, lang)];
}

const HTML_LEFTOVER = /<\/?[a-z!][^>]*>|&[a-z]+;|&#\d+;|\[sound:/i;

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function typeName(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'список';
  switch (typeof v) {
    case 'string':
      return 'строка';
    case 'number':
      return 'число';
    case 'boolean':
      return 'true/false';
    case 'object':
      return 'объект';
    default:
      return typeof v;
  }
}

function q(s: string): string {
  return `«${s}»`;
}

function list(items: readonly string[]): string {
  return items.join(', ');
}

function includes<T extends string>(items: readonly T[], v: unknown): v is T {
  return (items as readonly unknown[]).includes(v);
}

/** Primary language subtag: "fr-FR" → "fr". */
export function primaryLanguage(tag: string): string {
  return tag.split('-')[0]!.toLowerCase();
}

/**
 * Deck name shown to the user: the imported ZIP file name without extension (decision Р15).
 * "C:\Downloads\Дарси 01.zip" → "Дарси 01".
 */
export function deckNameFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  return base.replace(/\.zip$/i, '').trim();
}

/** Name of an installed deck in the interface language (Р30): its title, else the stored name (the file name). */
export function deckTitle(d: { name: string; title?: Localized }, lang: UiLang): string {
  return pickLocalized(d.title, lang) ?? d.name;
}

/** Text in the interface language, or any available one (in UI_LANGS order). */
export function pickLocalized(value: Localized | undefined, lang: UiLang): string | undefined {
  if (!value) return undefined;
  return value[lang] ?? UI_LANGS.map((l) => value[l]).find((t) => t !== undefined);
}

/** Like pickLocalized, but also says which language the text is in (it may not be the one asked for). */
export function pickLocalizedWithLang(
  value: Localized | undefined,
  lang: UiLang,
): { text: string; lang: UiLang } | undefined {
  if (!value) return undefined;
  const order = [lang, ...UI_LANGS.filter((l) => l !== lang)];
  for (const l of order) {
    const text = value[l];
    if (text !== undefined) return { text, lang: l };
  }
  return undefined;
}

class Collector {
  readonly errors: DeckIssue[] = [];
  readonly warnings: DeckIssue[] = [];
  error(path: string, message: string): void {
    this.errors.push({ level: 'error', path, message });
  }
  warn(path: string, message: string): void {
    this.warnings.push({ level: 'warning', path, message });
  }
}

/** Parses deck.json text. Invalid JSON yields one error with line and column. */
export function parseDeckJson(text: string): { value: unknown; error: DeckIssue | null } {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  try {
    return { value: JSON.parse(src), error: null };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const pos = /position (\d+)/.exec(raw);
    let where = '';
    if (pos) {
      const before = src.slice(0, Number(pos[1]));
      const line = before.split('\n').length;
      const col = before.length - before.lastIndexOf('\n');
      where = ` (строка ${line}, символ ${col})`;
    }
    return {
      value: undefined,
      error: {
        level: 'error',
        path: '',
        message: `${DECK_JSON}: это не правильный JSON${where}. Частые причины: лишняя запятая перед } или ], кавычки «ёлочки» вместо "", комментарии. Подробности: ${raw}`,
      },
    };
  }
}

function checkText(c: Collector, path: string, where: string, v: unknown, required: boolean): string | undefined {
  if (v === undefined) {
    if (required) c.error(path, `${where}: нет обязательного поля.`);
    return undefined;
  }
  if (typeof v !== 'string') {
    c.error(path, `${where}: должна быть строка, а сейчас ${typeName(v)}.`);
    return undefined;
  }
  if (v.trim() === '') {
    c.error(path, `${where}: пустая строка.`);
    return undefined;
  }
  if (HTML_LEFTOVER.test(v)) {
    c.error(path, `${where}: похоже на HTML или разметку Anki (${q(v)}). Нужен простой текст.`);
  } else if (v !== v.trim()) {
    c.warn(path, `${where}: пробелы в начале или в конце (${q(v)}).`);
  }
  return v;
}

function checkId(c: Collector, path: string, where: string, v: unknown): string | undefined {
  if (v === undefined) {
    c.error(path, `${where}: нет обязательного поля id.`);
    return undefined;
  }
  if (typeof v !== 'string') {
    c.error(path, `${where}: id должен быть строкой, а сейчас ${typeName(v)}.`);
    return undefined;
  }
  if (!ID_PATTERN.test(v)) {
    c.error(
      path,
      `${where}: id ${q(v)} не подходит. Разрешены строчные латинские буквы, цифры и знаки - _ . (до 64 символов), первый символ — буква или цифра. Пример: «le-prenom».`,
    );
    return undefined;
  }
  return v;
}

/**
 * Text in interface languages: {"tg": "...", "ru": "...", "en": "..."}, at least one.
 * `field` is the JSON key, `label` its Russian name for messages.
 */
function checkLocalized(
  c: Collector,
  path: string,
  where: string,
  v: unknown,
  field: string,
  label: string,
  required: boolean,
): void {
  if (v === undefined) {
    if (required) c.error(path, `${where}: нет обязательного поля ${field} (${label}).`);
    return;
  }
  if (!isObject(v)) {
    c.error(
      path,
      `${where}: ${field} должно быть объектом с языками, например {"tg": "салом", "ru": "привет"}, а сейчас ${typeName(v)}.`,
    );
    return;
  }
  let known = 0;
  for (const [lang, text] of Object.entries(v)) {
    if (!includes(UI_LANGS, lang)) {
      c.warn(
        `${path}.${lang}`,
        `${where}: в ${field} язык ${q(lang)} не поддерживается — этот текст приложение не покажет. Язык интерфейса и значений — только ${list(UI_LANGS)} (ISO 639-1; не «tj», «tgk», «tg-TJ»).`,
      );
      continue;
    }
    known++;
    checkText(c, `${path}.${lang}`, `${where}, ${field} на ${lang}`, text, true);
  }
  if (known === 0) {
    c.error(path, `${where}: ${field} пустое — нужен текст хотя бы на одном языке (${list(UI_LANGS)}).`);
  }
}

function checkAudio(c: Collector, path: string, where: string, v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    c.error(path, `${where}: audio должно быть непустой строкой с путём к файлу, а сейчас ${typeName(v)}.`);
    return undefined;
  }
  if (v.includes('\\')) {
    c.error(path, `${where}: в пути ${q(v)} обратная косая черта. Нужна обычная: «audio/bonjour.mp3».`);
    return undefined;
  }
  if (!v.startsWith(AUDIO_DIR) || v.length === AUDIO_DIR.length) {
    c.error(path, `${where}: аудио должно лежать в папке audio/, например «audio/bonjour.mp3», а указано ${q(v)}.`);
    return undefined;
  }
  if (v.split('/').some((part) => part === '..' || part === '.' || part === '')) {
    c.error(path, `${where}: недопустимый путь ${q(v)} (без «..», «.» и двойных косых).`);
    return undefined;
  }
  const ext = /\.([^./]+)$/.exec(v)?.[1];
  if (!includes(AUDIO_EXTENSIONS, ext)) {
    c.error(path, `${where}: неподдерживаемый тип аудио ${q(v)}. Допустимы (строчными буквами): ${list(AUDIO_EXTENSIONS)}.`);
    return undefined;
  }
  return v;
}

function checkSkills(c: Collector, path: string, where: string, v: unknown): void {
  if (v === undefined) {
    c.error(path, `${where}: нет обязательного поля skills (навыки), например ["listen", "speak", "write"].`);
    return;
  }
  if (!Array.isArray(v)) {
    c.error(path, `${where}: skills должно быть списком, например ["listen", "speak"], а сейчас ${typeName(v)}.`);
    return;
  }
  if (v.length === 0) {
    c.error(path, `${where}: skills пустой — нужен хотя бы один навык (${list(SKILLS)}).`);
    return;
  }
  const seen = new Set<string>();
  v.forEach((s, k) => {
    if (!includes(SKILLS, s)) {
      c.error(`${path}[${k}]`, `${where}: неизвестный навык ${q(String(s))}. Допустимы: ${list(SKILLS)}.`);
    } else if (seen.has(s)) {
      c.error(`${path}[${k}]`, `${where}: навык ${q(s)} указан дважды.`);
    } else {
      seen.add(s);
    }
  });
}

const TAG_CODE_RULE = 'строчные латинские буквы, цифры и знаки - _ . (до 64 символов), например «word»';

/** Entry tags: a list of tag codes. Returns the valid codes. */
function checkTags(c: Collector, path: string, where: string, v: unknown): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    c.error(path, `${where}: tags должно быть списком кодов тегов, например ["word"], а сейчас ${typeName(v)}.`);
    return [];
  }
  const seen = new Set<string>();
  v.forEach((t, k) => {
    const p = `${path}[${k}]`;
    if (typeof t !== 'string') {
      c.error(p, `${where}: код тега должен быть строкой, а сейчас ${typeName(t)}.`);
    } else if (!ID_PATTERN.test(t)) {
      c.error(p, `${where}: код тега ${q(t)} не подходит: ${TAG_CODE_RULE}. Название тега пишется в словаре tags колоды.`);
    } else if (seen.has(t)) {
      c.warn(p, `${where}: тег ${q(t)} указан дважды.`);
    } else {
      seen.add(t);
    }
  });
  return [...seen];
}

/** Deck tag dictionary: {"word": {"tg": "вожа", "ru": "слово"}}. Returns the valid codes. */
function checkTagDictionary(c: Collector, v: unknown): Set<string> {
  const codes = new Set<string>();
  if (v === undefined) return codes;
  if (!isObject(v)) {
    c.error(
      'tags',
      `Колода: tags должно быть словарём тегов, например {"word": {"tg": "вожа", "ru": "слово", "en": "word"}}, а сейчас ${typeName(v)}.`,
    );
    return codes;
  }
  for (const [code, name] of Object.entries(v)) {
    if (!ID_PATTERN.test(code)) {
      c.error(`tags.${code}`, `Колода, словарь tags: код тега ${q(code)} не подходит: ${TAG_CODE_RULE}.`);
      continue;
    }
    codes.add(code);
    checkLocalized(c, `tags.${code}`, `Тег ${q(code)}`, name, `tags.${code}`, 'название тега', true);
  }
  return codes;
}

/** `label` names the field in messages ("род", "form.gender"). */
function checkGender(
  c: Collector,
  path: string,
  where: string,
  label: string,
  v: unknown,
  lang: LanguageSupport | undefined,
): Gender | undefined {
  if (v === undefined) return undefined;
  if (!includes(GENDERS, v)) {
    c.error(
      path,
      `${where}: ${label} ${q(String(v))} не подходит. Допустимо "m" (мужской), "f" (женский), "n" (средний); если рода нет, поле не пишите.`,
    );
    return undefined;
  }
  if (lang && !lang.genders.includes(v)) {
    c.error(path, `${where}: в языке ${q(lang.code)} нет рода ${q(v)} (${GENDER_NAMES[v]}). Допустимо: ${list(lang.genders)}.`);
    return undefined;
  }
  return v;
}

/** `form`: {"determiner": ..., "gender": ..., "number": ...}, at least one. Returns the valid part. */
function checkForm(
  c: Collector,
  path: string,
  where: string,
  v: unknown,
  lang: LanguageSupport | undefined,
): EntryForm | undefined {
  if (v === undefined) return undefined;
  if (!isObject(v)) {
    c.error(path, `${where}: form должно быть объектом, например {"determiner": "definite"}, а сейчас ${typeName(v)}.`);
    return undefined;
  }
  if (Object.keys(v).length === 0) {
    c.error(path, `${where}: form пустое — укажите determiner, gender или number, или уберите поле.`);
    return undefined;
  }
  const form: EntryForm = {};
  if (v.determiner !== undefined) {
    if (includes(DETERMINERS, v.determiner)) form.determiner = v.determiner;
    else {
      c.error(
        `${path}.determiner`,
        `${where}: form.determiner ${q(String(v.determiner))} не подходит. Допустимо "definite" (определённая форма) или "indefinite" (неопределённая).`,
      );
    }
  }
  const gender = checkGender(c, `${path}.gender`, where, 'form.gender', v.gender, lang);
  if (gender !== undefined) form.gender = gender;
  if (v.number !== undefined) {
    if (includes(NUMBERS, v.number)) form.number = v.number;
    else {
      c.error(
        `${path}.number`,
        `${where}: form.number ${q(String(v.number))} не подходит. Допустимо "singular" (единственное число) или "plural" (множественное).`,
      );
    }
  }
  for (const key of Object.keys(v)) {
    if (!includes(FORM_KEYS, key)) {
      c.warn(`${path}.${key}`, `${where}: неизвестное поле form.${key} — будет пропущено. Допустимы: ${list(FORM_KEYS)}.`);
    }
  }
  return form;
}

interface EntrySummary {
  id?: string;
  text?: string;
  audio?: string;
  tags: string[];
  langs: string[];
}

function checkEntry(c: Collector, i: number, v: unknown, lang: LanguageSupport | undefined): EntrySummary {
  const path = `entries[${i}]`;
  let where = `Запись ${i + 1}`;
  if (!isObject(v)) {
    c.error(path, `${where}: должна быть объектом { ... }, а сейчас ${typeName(v)}.`);
    return { tags: [], langs: [] };
  }
  if (typeof v.id === 'string' && v.id !== '') where += ` (id ${q(v.id)})`;
  else if (typeof v.text === 'string' && v.text.trim() !== '') where += ` (${q(v.text)})`;

  const id = checkId(c, `${path}.id`, where, v.id);
  let text: string | undefined;
  if (v.text === undefined && v.fr !== undefined) {
    c.error(`${path}.text`, `${where}: поле fr переименовано в text — переименуйте его.`);
  } else {
    text = checkText(c, `${path}.text`, `${where}, поле text (текст на изучаемом языке)`, v.text, true);
  }
  const ipa = checkText(c, `${path}.ipa`, `${where}, поле ipa`, v.ipa, false);
  if (ipa !== undefined && /^\s*[[/]|[\]/]\s*$/.test(ipa)) {
    c.error(`${path}.ipa`, `${where}: IPA пишется без скобок [ ] и косых / / — приложение добавит их само. Сейчас: ${q(ipa)}.`);
  }
  if (v.ipa === undefined) c.warn(`${path}.ipa`, `${where}: нет IPA (произношения).`);
  checkLocalized(c, `${path}.meaning`, where, v.meaning, 'meaning', 'значение', true);
  checkLocalized(c, `${path}.hint`, where, v.hint, 'hint', 'подсказка до ответа', false);
  checkLocalized(c, `${path}.note`, where, v.note, 'note', 'заметка после ответа', false);
  const audio = checkAudio(c, `${path}.audio`, where, v.audio);

  checkGender(c, `${path}.gender`, where, 'род', v.gender, lang);
  if (v.determiner !== undefined) {
    c.error(
      `${path}.determiner`,
      `${where}: поле determiner перенесено в form — напишите "form": {"determiner": ${JSON.stringify(v.determiner)}}.`,
    );
  }
  const form = checkForm(c, `${path}.form`, where, v.form, lang);
  if (form?.determiner !== undefined && v.gender === undefined) {
    c.warn(`${path}.form.determiner`, `${where}: указан form.determiner, но нет gender — у существительного обычно есть род.`);
  }
  if (text !== undefined && PACKED_FORMS.test(text)) {
    c.warn(
      `${path}.text`,
      `${where}: в text есть «(» или «/» (${q(text)}). У записи один правильный ответ: каждую форму дайте отдельной записью, а форму укажите в form. Пример: «ravi(e)» → «ravi» с "form": {"gender": "m"} и «ravie» с "form": {"gender": "f"}.`,
    );
  }
  const tags = checkTags(c, `${path}.tags`, where, v.tags);
  checkSkills(c, `${path}.skills`, where, v.skills);
  for (const key of Object.keys(v)) {
    if (!ENTRY_KEYS.has(key) && !OLD_ENTRY_KEYS.has(key)) {
      c.warn(`${path}.${key}`, `${where}: неизвестное поле ${q(key)} — будет пропущено.`);
    }
  }
  const langs = isObject(v.meaning) ? Object.keys(v.meaning).filter((l) => includes(UI_LANGS, l)) : [];
  return { id, text, audio, tags, langs };
}

function checkLanguage(c: Collector, v: unknown, options: DeckCheckOptions): LanguageSupport | undefined {
  if (v === undefined) {
    c.error('language', 'Нет поля language (изучаемый язык), например "language": "fr-FR".');
    return undefined;
  }
  if (typeof v !== 'string' || !LANGUAGE_TAG_PATTERN.test(v)) {
    c.error(
      'language',
      `Поле language: ${q(String(v))} — не код языка BCP-47. Примеры: "fr-FR", "en-GB", "de-DE", "lb-LU".`,
    );
    return undefined;
  }
  if (!options.languages) return undefined;
  const pack = options.languages.find((l) => l.code === primaryLanguage(v));
  if (!pack) {
    c.error(
      'language',
      `Язык ${q(v)} пока не поддерживается приложением. Поддерживаются: ${list(options.languages.map((l) => l.code))}.`,
    );
  }
  return pack;
}

const VOICE_SKILLS: readonly string[] = ['speak', 'listen'];

/**
 * Р16: forms that sound the same (ravi / ravie) — `speak` and `listen` at one entry only,
 * `write` at both. A pair with a voice skill on both entries is a warning: the
 * recognizer cannot tell them apart.
 */
function sameSoundWarnings(c: Collector, entries: readonly unknown[], sameSound: (a: string, b: string) => boolean): void {
  const voiced = entries.flatMap((raw, i) => {
    if (!isObject(raw) || typeof raw.text !== 'string' || !Array.isArray(raw.skills)) return [];
    const skills = raw.skills.filter((s): s is string => typeof s === 'string' && VOICE_SKILLS.includes(s));
    return skills.length > 0 ? [{ i, text: raw.text.trim(), skills }] : [];
  });
  for (let b = 0; b < voiced.length; b++) {
    for (let a = 0; a < b; a++) {
      const x = voiced[a]!;
      const y = voiced[b]!;
      if (x.text.toLowerCase() === y.text.toLowerCase() || !sameSound(x.text, y.text)) continue;
      c.warn(
        `entries[${y.i}].skills`,
        `Записи ${x.i + 1} и ${y.i + 1} звучат одинаково (${q(x.text)} и ${q(y.text)}), и у обеих есть ${list(VOICE_SKILLS)}: ` +
          'по звучанию их не различить. Оставьте speak и listen только у одной записи, write — у обеих.',
      );
    }
  }
}

/** Validates parsed deck.json content. */
export function validateDeck(value: unknown, options: DeckCheckOptions = {}): DeckCheck {
  const c = new Collector();
  if (!isObject(value)) {
    c.error('', `${DECK_JSON}: в начале файла должен быть объект { ... }, а сейчас ${typeName(value)}.`);
    return { deck: null, errors: c.errors, warnings: c.warnings };
  }

  if (value.format === LEGACY_DECK_FORMAT) {
    c.warn('format', `Поле format: ${q(LEGACY_DECK_FORMAT)} — прежний идентификатор. Замените на ${q(DECK_FORMAT)}; пока колода принимается.`);
  } else if (value.format !== DECK_FORMAT) {
    c.error(
      'format',
      value.format === undefined
        ? `Нет поля format. Нужно "format": "${DECK_FORMAT}".`
        : `Поле format: ожидается ${q(DECK_FORMAT)}, а указано ${q(String(value.format))}. Это не колода «Маны».`,
    );
  }
  if (value.version === undefined) {
    c.error('version', `Нет поля version. Нужно "version": ${DECK_VERSION}.`);
  } else if (typeof value.version !== 'number' || !Number.isInteger(value.version)) {
    c.error('version', `Поле version должно быть целым числом (${DECK_VERSION}), а сейчас ${typeName(value.version)}.`);
  } else if (value.version !== DECK_VERSION) {
    c.error(
      'version',
      value.version > DECK_VERSION
        ? `Версия формата ${value.version} новее, чем понимает приложение (${DECK_VERSION}). Обновите приложение.`
        : `Версия формата ${value.version} не поддерживается. Поддерживается версия ${DECK_VERSION}.`,
    );
  }
  checkId(c, 'id', 'Колода', value.id);
  if (value.revision === undefined) {
    c.error('revision', 'Нет поля revision (номер редакции колоды). У первой редакции "revision": 1.');
  } else if (typeof value.revision !== 'number' || !Number.isInteger(value.revision) || value.revision < 1) {
    c.error('revision', `Поле revision должно быть целым числом от 1, а сейчас ${q(String(value.revision))}.`);
  }
  const lang = checkLanguage(c, value.language, options);
  const tagCodes = checkTagDictionary(c, value.tags);
  // Р30: the name comes from the deck; without it, from the file name, which Chrome may suffix ("-1").
  if (value.title === undefined) {
    c.warn(
      'title',
      'Колода: нет поля title (название на языках интерфейса, например {"tg": "Фаронсавӣ · Дарси 1", "ru": "Французский · Урок 1"}) — ' +
        'название возьмётся из имени ZIP-файла, а Chrome при повторном скачивании дописывает к нему «-1» (Р30).',
    );
  } else {
    checkLocalized(c, 'title', 'Колода', value.title, 'title', 'название колоды', true);
  }
  for (const key of Object.keys(value)) {
    if (key === 'description') {
      c.warn(key, `Колода: поле ${q(key)} не используется. Поле будет пропущено.`);
    } else if (!DECK_KEYS.has(key)) {
      c.warn(key, `Колода: неизвестное поле ${q(key)} — будет пропущено.`);
    }
  }

  const entries = value.entries;
  if (entries === undefined) {
    c.error('entries', 'Нет поля entries (список записей).');
  } else if (!Array.isArray(entries)) {
    c.error('entries', `Поле entries должно быть списком [ ... ], а сейчас ${typeName(entries)}.`);
  } else if (entries.length === 0) {
    c.error('entries', 'Список entries пуст — в колоде нет ни одной записи.');
  } else {
    const ids = new Map<string, number>();
    const texts = new Map<string, number>();
    const audios = new Map<string, number>();
    const langCount = new Map<string, number>();
    const tagUse = new Map<string, number[]>();
    entries.forEach((raw, i) => {
      const e = checkEntry(c, i, raw, lang);
      if (e.id !== undefined) {
        const first = ids.get(e.id);
        if (first !== undefined) {
          c.error(`entries[${i}].id`, `Запись ${i + 1}: id ${q(e.id)} уже есть у записи ${first + 1}. id должны быть разными.`);
        } else ids.set(e.id, i);
      }
      if (e.text !== undefined) {
        const key = e.text.trim().toLowerCase();
        const first = texts.get(key);
        if (first !== undefined) {
          c.warn(`entries[${i}].text`, `Запись ${i + 1}: тот же текст ${q(e.text.trim())}, что у записи ${first + 1}.`);
        } else texts.set(key, i);
      }
      if (e.audio !== undefined) {
        const first = audios.get(e.audio);
        if (first !== undefined) {
          c.warn(`entries[${i}].audio`, `Запись ${i + 1}: файл ${q(e.audio)} уже используется в записи ${first + 1}.`);
        } else audios.set(e.audio, i);
      }
      for (const l of e.langs) langCount.set(l, (langCount.get(l) ?? 0) + 1);
      for (const t of e.tags) tagUse.set(t, [...(tagUse.get(t) ?? []), i + 1]);
    });
    if (lang?.sameSound) sameSoundWarnings(c, entries, lang.sameSound);
    // Р28: one answer per card, and what the app needs to check it.
    c.warnings.push(...contentWarnings(entries, lang?.deckRules));
    for (const [t, nums] of tagUse) {
      if (tagCodes.has(t)) continue;
      const shown = nums.slice(0, 5).join(', ') + (nums.length > 5 ? '…' : '');
      c.warn(
        'tags',
        `Тег ${q(t)} не описан в словаре tags колоды (записи ${shown}) — приложение покажет код вместо названия.`,
      );
    }
    for (const t of tagCodes) {
      if (!tagUse.has(t)) c.warn(`tags.${t}`, `Тег ${q(t)} описан в словаре tags, но не используется ни одной записью.`);
    }
    for (const [l, n] of langCount) {
      const missing = entries.length - n;
      if (missing > 0) {
        c.warn(
          'entries',
          `Значение на ${l} есть не у всех записей: не хватает у ${missing} из ${entries.length}. Для них приложение покажет другой язык.`,
        );
      }
    }
  }

  return {
    deck: c.errors.length === 0 ? (value as unknown as Deck) : null,
    errors: c.errors,
    warnings: c.warnings,
  };
}

/** Ignored archive entries: folders and macOS/Windows metadata. */
function isJunk(path: string): boolean {
  return path.endsWith('/') || path.startsWith('__MACOSX/') || /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/i.test(path);
}

function megabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' МБ';
}

/**
 * Validates a whole deck archive: `paths` are all file paths inside the ZIP,
 * `deckJsonText` is the content of deck.json (undefined if it is missing).
 */
export function checkDeckArchive(
  paths: readonly string[],
  deckJsonText: string | undefined,
  options: DeckCheckOptions = {},
): DeckCheck {
  const files = paths.filter((p) => !isJunk(p));
  if (deckJsonText === undefined) {
    const nested = files.find((p) => p.endsWith('/' + DECK_JSON));
    const message = nested
      ? `${DECK_JSON} лежит в папке (${q(nested)}), а должен — в корне архива. Заархивируйте содержимое папки, а не саму папку.`
      : `В архиве нет файла ${DECK_JSON}.`;
    return { deck: null, errors: [{ level: 'error', path: '', message }], warnings: [] };
  }

  const parsed = parseDeckJson(deckJsonText);
  if (parsed.error) return { deck: null, errors: [parsed.error], warnings: [] };
  const result = validateDeck(parsed.value, options);

  const present = new Set(files);
  const byLower = new Map(files.map((p) => [p.toLowerCase(), p]));
  const used = new Set<string>();
  const entries = isObject(parsed.value) && Array.isArray(parsed.value.entries) ? parsed.value.entries : [];
  entries.forEach((e, i) => {
    if (!isObject(e) || typeof e.audio !== 'string') return;
    const audio = e.audio;
    used.add(audio);
    // Report only paths that passed the format check.
    if (result.errors.some((x) => x.path === `entries[${i}].audio`) || present.has(audio)) return;
    const near = byLower.get(audio.toLowerCase());
    result.errors.push({
      level: 'error',
      path: `entries[${i}].audio`,
      message: near
        ? `Запись ${i + 1}: файла ${q(audio)} нет, но есть ${q(near)} — регистр букв должен совпадать.`
        : `Запись ${i + 1}: файла ${q(audio)} нет в архиве.`,
    });
  });
  for (const p of files) {
    if (p === DECK_JSON || used.has(p)) continue;
    result.warnings.push({
      level: 'warning',
      path: '',
      message: p.startsWith(AUDIO_DIR)
        ? `Файл ${q(p)} не используется ни одной записью.`
        : `Лишний файл ${q(p)} — будет пропущен (нужны только ${DECK_JSON} и папка audio/).`,
    });
  }
  if (options.archiveBytes !== undefined && options.archiveBytes > LARGE_ARCHIVE_BYTES) {
    const wav = [...used].filter((p) => p.endsWith('.wav')).length;
    result.warnings.push({
      level: 'warning',
      path: '',
      message:
        `Архив большой: ${megabytes(options.archiveBytes)} (порог ${megabytes(LARGE_ARCHIVE_BYTES)}). ` +
        `Он долго скачивается на телефон и занимает место.` +
        (wav > 0 ? ` WAV-файлов: ${wav} — в MP3 они станут в 5–10 раз меньше.` : ''),
    });
  }
  if (result.errors.length > 0) result.deck = null;
  return result;
}
