/**
 * Sluh deck format ("sluh-deck", version 1): types and validation.
 * Spec: docs/DECK_FORMAT.md. JSON Schema: ./sluh-deck.schema.json.
 *
 * Pure logic, no imports: also run directly by Node in scripts/validate-deck.ts.
 * Messages are in Russian — they are shown to the deck author.
 */

export const DECK_FORMAT = 'sluh-deck';
export const DECK_VERSION = 1;
export const DECK_JSON = 'deck.json';
export const AUDIO_DIR = 'audio/';

export const SKILLS = ['listen', 'speak', 'write'] as const;
export type Skill = (typeof SKILLS)[number];

export const MEANING_LANGS = ['tg', 'ru', 'en'] as const;
export type MeaningLang = (typeof MEANING_LANGS)[number];

export const GENDERS = ['m', 'f'] as const;
export type Gender = (typeof GENDERS)[number];

export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'opus', 'm4a', 'webm'] as const;

/** Stable ids of decks and entries: lowercase latin letters, digits, "-", "_", ".". */
export const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export type Meaning = Partial<Record<MeaningLang, string>>;

export interface DeckEntry {
  id: string;
  fr: string;
  ipa?: string;
  meaning: Meaning;
  audio?: string;
  gender?: Gender;
  skills: Skill[];
}

export interface Deck {
  format: typeof DECK_FORMAT;
  version: typeof DECK_VERSION;
  id: string;
  title: string;
  entries: DeckEntry[];
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

const DECK_KEYS = new Set(['format', 'version', 'id', 'title', 'entries']);
const ENTRY_KEYS = new Set(['id', 'fr', 'ipa', 'meaning', 'audio', 'gender', 'skills']);

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

function checkMeaning(c: Collector, path: string, where: string, v: unknown): void {
  if (v === undefined) {
    c.error(path, `${where}: нет обязательного поля meaning (значение).`);
    return;
  }
  if (!isObject(v)) {
    c.error(
      path,
      `${where}: meaning должно быть объектом с языками, например {"tg": "салом", "ru": "привет"}, а сейчас ${typeName(v)}.`,
    );
    return;
  }
  for (const [lang, text] of Object.entries(v)) {
    if (!(MEANING_LANGS as readonly string[]).includes(lang)) {
      c.error(`${path}.${lang}`, `${where}: неизвестный язык значения ${q(lang)}. Допустимы: ${list(MEANING_LANGS)}.`);
      continue;
    }
    checkText(c, `${path}.${lang}`, `${where}, значение на ${lang}`, text, true);
  }
  if (Object.keys(v).length === 0) {
    c.error(path, `${where}: meaning пустое — нужно значение хотя бы на одном языке (${list(MEANING_LANGS)}).`);
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
  if (!ext || !(AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
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
    if (typeof s !== 'string' || !(SKILLS as readonly string[]).includes(s)) {
      c.error(`${path}[${k}]`, `${where}: неизвестный навык ${q(String(s))}. Допустимы: ${list(SKILLS)}.`);
    } else if (seen.has(s)) {
      c.error(`${path}[${k}]`, `${where}: навык ${q(s)} указан дважды.`);
    } else {
      seen.add(s);
    }
  });
}

function checkEntry(c: Collector, i: number, v: unknown): { id?: string; fr?: string; audio?: string; langs: string[] } {
  const path = `entries[${i}]`;
  let where = `Запись ${i + 1}`;
  if (!isObject(v)) {
    c.error(path, `${where}: должна быть объектом { ... }, а сейчас ${typeName(v)}.`);
    return { langs: [] };
  }
  if (typeof v.id === 'string' && v.id !== '') where += ` (id ${q(v.id)})`;
  else if (typeof v.fr === 'string' && v.fr.trim() !== '') where += ` (${q(v.fr)})`;

  const id = checkId(c, `${path}.id`, where, v.id);
  const fr = checkText(c, `${path}.fr`, `${where}, поле fr (французский текст)`, v.fr, true);
  const ipa = checkText(c, `${path}.ipa`, `${where}, поле ipa`, v.ipa, false);
  if (ipa !== undefined && /^\s*[[/]|[\]/]\s*$/.test(ipa)) {
    c.error(`${path}.ipa`, `${where}: IPA пишется без скобок [ ] и косых / / — приложение добавит их само. Сейчас: ${q(ipa)}.`);
  }
  if (v.ipa === undefined) c.warn(`${path}.ipa`, `${where}: нет IPA (произношения).`);
  checkMeaning(c, `${path}.meaning`, where, v.meaning);
  const audio = checkAudio(c, `${path}.audio`, where, v.audio);
  if (v.gender !== undefined && !(GENDERS as readonly unknown[]).includes(v.gender)) {
    c.error(
      `${path}.gender`,
      `${where}: род ${q(String(v.gender))} не подходит. Допустимо "m" (мужской) или "f" (женский); если рода нет, поле не пишите.`,
    );
  }
  checkSkills(c, `${path}.skills`, where, v.skills);
  for (const key of Object.keys(v)) {
    if (!ENTRY_KEYS.has(key)) c.warn(`${path}.${key}`, `${where}: неизвестное поле ${q(key)} — будет пропущено.`);
  }
  const langs = isObject(v.meaning) ? Object.keys(v.meaning).filter((l) => (MEANING_LANGS as readonly string[]).includes(l)) : [];
  return { id, fr, audio, langs };
}

/** Validates parsed deck.json content. */
export function validateDeck(value: unknown): DeckCheck {
  const c = new Collector();
  if (!isObject(value)) {
    c.error('', `${DECK_JSON}: в начале файла должен быть объект { ... }, а сейчас ${typeName(value)}.`);
    return { deck: null, errors: c.errors, warnings: c.warnings };
  }

  if (value.format !== DECK_FORMAT) {
    c.error(
      'format',
      value.format === undefined
        ? `Нет поля format. Нужно "format": "${DECK_FORMAT}".`
        : `Поле format: ожидается ${q(DECK_FORMAT)}, а указано ${q(String(value.format))}. Это не колода «Слуха».`,
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
  checkText(c, 'title', 'Колода, поле title (название)', value.title, true);
  for (const key of Object.keys(value)) {
    if (!DECK_KEYS.has(key)) c.warn(key, `Колода: неизвестное поле ${q(key)} — будет пропущено.`);
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
    const frs = new Map<string, number>();
    const audios = new Map<string, number>();
    const langCount = new Map<string, number>();
    entries.forEach((raw, i) => {
      const e = checkEntry(c, i, raw);
      if (e.id !== undefined) {
        const first = ids.get(e.id);
        if (first !== undefined) {
          c.error(`entries[${i}].id`, `Запись ${i + 1}: id ${q(e.id)} уже есть у записи ${first + 1}. id должны быть разными.`);
        } else ids.set(e.id, i);
      }
      if (e.fr !== undefined) {
        const key = e.fr.trim().toLowerCase();
        const first = frs.get(key);
        if (first !== undefined) {
          c.warn(`entries[${i}].fr`, `Запись ${i + 1}: тот же французский текст ${q(e.fr.trim())}, что у записи ${first + 1}.`);
        } else frs.set(key, i);
      }
      if (e.audio !== undefined) {
        const first = audios.get(e.audio);
        if (first !== undefined) {
          c.warn(`entries[${i}].audio`, `Запись ${i + 1}: файл ${q(e.audio)} уже используется в записи ${first + 1}.`);
        } else audios.set(e.audio, i);
      }
      for (const l of e.langs) langCount.set(l, (langCount.get(l) ?? 0) + 1);
    });
    for (const [lang, n] of langCount) {
      const missing = entries.length - n;
      if (missing > 0) {
        c.warn(
          'entries',
          `Значение на ${lang} есть не у всех записей: не хватает у ${missing} из ${entries.length}. Для них приложение покажет другой язык.`,
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

/**
 * Validates a whole deck archive: `paths` are all file paths inside the ZIP,
 * `deckJsonText` is the content of deck.json (undefined if it is missing).
 */
export function checkDeckArchive(paths: readonly string[], deckJsonText: string | undefined): DeckCheck {
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
  const result = validateDeck(parsed.value);

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
  if (result.errors.length > 0) result.deck = null;
  return result;
}
