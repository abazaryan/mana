/**
 * Mana deck format ("mana-deck", version 1): types and validation.
 * Spec: docs/DECK_FORMAT.md. JSON Schema: ./mana-deck.schema.json.
 *
 * Pure logic with no runtime imports: also run directly by Node in scripts/validate-deck.ts.
 * Language-specific rules come from language packs (./languages.ts) via options.
 * Messages are in Russian — they are shown to the deck author.
 */
import { contentWarnings } from './deckContent.ts';
import { FORM_LABELS } from './cyrillicData.ts';
import { M } from './deckMessages.ts';
import { SKILLS, UI_LANGS, type Skill, type UiLang } from './kinds.ts';

export { SKILLS, UI_LANGS, type Skill, type UiLang };

export const DECK_FORMAT = 'mana-deck';
/** Former identifier (working name "Sluh", R20): still accepted, with a warning. */
export const LEGACY_DECK_FORMAT = 'sluh-deck';
export const DECK_VERSION = 1;
export const DECK_JSON = 'deck.json';
export const AUDIO_DIR = 'audio/';

export const GENDERS = ['m', 'f', 'n'] as const;
export type Gender = (typeof GENDERS)[number];

export const DETERMINERS = ['definite', 'indefinite'] as const;
export type Determiner = (typeof DETERMINERS)[number];

export const NUMBERS = ['singular', 'plural'] as const;
export type GrammaticalNumber = (typeof NUMBERS)[number];

/**
 * Which form of the item the answer must be in (decision R16). Shown as hints
 * before the answer, in the interface language: one correct answer per entry (R3),
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
  /**
   * What the browser voice reads instead of `text` when it reads `text` wrong
   * (ciao → "tchao"); only without audio. The answer and the display use `text`;
   * a spoken answer may also match `speech` (R34).
   */
  speech?: string;
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
   * Deck name in interface languages (R30); shown in the interface language, else any.
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
  /** Two texts sound the same (ravi / ravie): each one, said, is accepted for the other (R16). */
  sameSound?(a: string, b: string): boolean;
  /** Lists for the deck content checks (R28); absent → only the language-neutral checks. */
  deckRules?: DeckRules;
}

/** Language lists for the deck content checks (R28, src/core/deckContent.ts). */
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
  /** error: the deck is refused; warning: accepted, better fixed; info: nothing to fix (R33 item 15). */
  level: 'error' | 'warning' | 'info';
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
  /** Information only, e.g. entries without audio play the browser voice (R33 item 14). */
  notes: DeckIssue[];
}

const DECK_KEYS = new Set(['format', 'version', 'id', 'revision', 'language', 'tags', 'title', 'entries']);
const ENTRY_KEYS = new Set([
  'id', 'text', 'ipa', 'meaning', 'hint', 'note', 'audio', 'speech', 'gender', 'form', 'tags', 'skills',
]);
/** Former field names: an error with a rename hint, not an "unknown field" warning. */
const OLD_ENTRY_KEYS = new Set(['fr', 'determiner']);

const GENDER_NAMES: Record<Gender, string> = { m: M.genderM, f: M.genderF, n: M.genderN };

/** A bracket or a slash left in `text`: a printed way to pack two answers into one. */
const PACKED_FORMS = /[(/]/;

export { FORM_LABELS };

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
 * Labels of an introduction (R16, amendment of 18.10.2026): the gender of the word,
 * then the form hints. The word's gender is left out when the form already shows the
 * same gender ("un ami": "indef. · m.", not "m. · indef. · m.").
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
  if (Array.isArray(v)) return M.typeList;
  switch (typeof v) {
    case 'string':
      return M.typeString;
    case 'number':
      return M.typeNumber;
    case 'boolean':
      return 'true/false';
    case 'object':
      return M.typeObject;
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
 * Deck name shown to the user: the imported ZIP file name without extension (decision R15).
 * "C:\Downloads\Lesson 01.zip" → "Lesson 01".
 */
export function deckNameFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  return base.replace(/\.(zip|json)$/i, '').trim();
}

/** Name of an installed deck in the interface language (R30): its title, else the stored name (the file name). */
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
  readonly notes: DeckIssue[] = [];
  error(path: string, message: string): void {
    this.errors.push({ level: 'error', path, message });
  }
  warn(path: string, message: string): void {
    this.warnings.push({ level: 'warning', path, message });
  }
  info(path: string, message: string): void {
    this.notes.push({ level: 'info', path, message });
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
      where = M.jsonPosition(line, col);
    }
    return {
      value: undefined,
      error: {
        level: 'error',
        path: '',
        message: M.jsonInvalid(DECK_JSON, where, raw),
      },
    };
  }
}

function checkText(c: Collector, path: string, where: string, v: unknown, required: boolean): string | undefined {
  if (v === undefined) {
    if (required) c.error(path, M.missingField(where));
    return undefined;
  }
  if (typeof v !== 'string') {
    c.error(path, M.mustBeString(where, typeName(v)));
    return undefined;
  }
  if (v.trim() === '') {
    c.error(path, M.emptyString(where));
    return undefined;
  }
  if (HTML_LEFTOVER.test(v)) {
    c.error(path, M.looksLikeHtml(where, q(v)));
  } else if (v !== v.trim()) {
    c.warn(path, M.surroundingSpaces(where, q(v)));
  }
  return v;
}

function checkId(c: Collector, path: string, where: string, v: unknown): string | undefined {
  if (v === undefined) {
    c.error(path, M.idMissing(where));
    return undefined;
  }
  if (typeof v !== 'string') {
    c.error(path, M.idNotString(where, typeName(v)));
    return undefined;
  }
  if (!ID_PATTERN.test(v)) {
    c.error(
      path,
      M.idInvalid(where, q(v)),
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
    if (required) c.error(path, M.missingNamedField(where, field, label));
    return;
  }
  if (!isObject(v)) {
    c.error(
      path,
      M.localizedNotObject(where, field, typeName(v)),
    );
    return;
  }
  let known = 0;
  for (const [lang, text] of Object.entries(v)) {
    if (!includes(UI_LANGS, lang)) {
      c.warn(
        `${path}.${lang}`,
        M.localizedUnknownLang(where, field, q(lang), list(UI_LANGS)),
      );
      continue;
    }
    known++;
    checkText(c, `${path}.${lang}`, M.localizedFieldIn(where, field, lang), text, true);
  }
  if (known === 0) {
    c.error(path, M.localizedEmpty(where, field, list(UI_LANGS)));
  }
}

function checkAudio(c: Collector, path: string, where: string, v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    c.error(path, M.audioNotString(where, typeName(v)));
    return undefined;
  }
  if (v.includes('\\')) {
    c.error(path, M.audioBackslash(where, q(v)));
    return undefined;
  }
  if (!v.startsWith(AUDIO_DIR) || v.length === AUDIO_DIR.length) {
    c.error(path, M.audioWrongFolder(where, q(v)));
    return undefined;
  }
  if (v.split('/').some((part) => part === '..' || part === '.' || part === '')) {
    c.error(path, M.audioBadPath(where, q(v)));
    return undefined;
  }
  const ext = /\.([^./]+)$/.exec(v)?.[1];
  if (!includes(AUDIO_EXTENSIONS, ext)) {
    c.error(path, M.audioBadExtension(where, q(v), list(AUDIO_EXTENSIONS)));
    return undefined;
  }
  return v;
}

function checkSkills(c: Collector, path: string, where: string, v: unknown): void {
  if (v === undefined) {
    c.error(path, M.skillsMissing(where));
    return;
  }
  if (!Array.isArray(v)) {
    c.error(path, M.skillsNotList(where, typeName(v)));
    return;
  }
  if (v.length === 0) {
    c.error(path, M.skillsEmpty(where, list(SKILLS)));
    return;
  }
  const seen = new Set<string>();
  v.forEach((s, k) => {
    if (!includes(SKILLS, s)) {
      c.error(`${path}[${k}]`, M.skillUnknown(where, q(String(s)), list(SKILLS)));
    } else if (seen.has(s)) {
      c.error(`${path}[${k}]`, M.skillDuplicate(where, q(s)));
    } else {
      seen.add(s);
    }
  });
}

const TAG_CODE_RULE = M.tagCodeRule;

/** Entry tags: a list of tag codes. Returns the valid codes. */
function checkTags(c: Collector, path: string, where: string, v: unknown): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    c.error(path, M.tagsNotList(where, typeName(v)));
    return [];
  }
  const seen = new Set<string>();
  v.forEach((t, k) => {
    const p = `${path}[${k}]`;
    if (typeof t !== 'string') {
      c.error(p, M.tagCodeNotString(where, typeName(t)));
    } else if (!ID_PATTERN.test(t)) {
      c.error(p, M.tagCodeInvalid(where, q(t), TAG_CODE_RULE));
    } else if (seen.has(t)) {
      c.warn(p, M.tagDuplicate(where, q(t)));
    } else {
      seen.add(t);
    }
  });
  return [...seen];
}

/** Deck tag dictionary: {"word": {"en": "word"}}. Returns the valid codes. */
function checkTagDictionary(c: Collector, v: unknown): Set<string> {
  const codes = new Set<string>();
  if (v === undefined) return codes;
  if (!isObject(v)) {
    c.error(
      'tags',
      M.tagDictNotObject(typeName(v)),
    );
    return codes;
  }
  for (const [code, name] of Object.entries(v)) {
    if (!ID_PATTERN.test(code)) {
      c.error(`tags.${code}`, M.tagDictCodeInvalid(q(code), TAG_CODE_RULE));
      continue;
    }
    codes.add(code);
    checkLocalized(c, `tags.${code}`, M.tagWhere(q(code)), name, `tags.${code}`, M.labelTagName, true);
  }
  return codes;
}

/** `label` names the field in messages ("gender", "form.gender"). */
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
      M.genderInvalid(where, label, q(String(v))),
    );
    return undefined;
  }
  if (lang && !lang.genders.includes(v)) {
    c.error(path, M.genderNotInLanguage(where, q(lang.code), q(v), GENDER_NAMES[v], list(lang.genders)));
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
    c.error(path, M.formNotObject(where, typeName(v)));
    return undefined;
  }
  if (Object.keys(v).length === 0) {
    c.error(path, M.formEmpty(where));
    return undefined;
  }
  const form: EntryForm = {};
  if (v.determiner !== undefined) {
    if (includes(DETERMINERS, v.determiner)) form.determiner = v.determiner;
    else {
      c.error(
        `${path}.determiner`,
        M.formDeterminerInvalid(where, q(String(v.determiner))),
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
        M.formNumberInvalid(where, q(String(v.number))),
      );
    }
  }
  for (const key of Object.keys(v)) {
    if (!includes(FORM_KEYS, key)) {
      c.warn(`${path}.${key}`, M.formUnknownKey(where, key, list(FORM_KEYS)));
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
  let where = M.entryWhere(i + 1);
  if (!isObject(v)) {
    c.error(path, M.entryNotObject(where, typeName(v)));
    return { tags: [], langs: [] };
  }
  if (typeof v.id === 'string' && v.id !== '') where += ` (id ${q(v.id)})`;
  else if (typeof v.text === 'string' && v.text.trim() !== '') where += ` (${q(v.text)})`;

  const id = checkId(c, `${path}.id`, where, v.id);
  let text: string | undefined;
  if (v.text === undefined && v.fr !== undefined) {
    c.error(`${path}.text`, M.entryRenamedFr(where));
  } else {
    text = checkText(c, `${path}.text`, M.entryTextWhere(where), v.text, true);
  }
  const ipa = checkText(c, `${path}.ipa`, M.entryIpaWhere(where), v.ipa, false);
  if (ipa !== undefined && /^\s*[[/]|[\]/]\s*$/.test(ipa)) {
    c.error(`${path}.ipa`, M.ipaBrackets(where, q(ipa)));
  }
  if (v.ipa === undefined) c.warn(`${path}.ipa`, M.ipaMissing(where));
  checkLocalized(c, `${path}.meaning`, where, v.meaning, 'meaning', M.labelMeaning, true);
  checkLocalized(c, `${path}.hint`, where, v.hint, 'hint', M.labelHint, false);
  checkLocalized(c, `${path}.note`, where, v.note, 'note', M.labelNote, false);
  const audio = checkAudio(c, `${path}.audio`, where, v.audio);
  const speech = checkText(c, `${path}.speech`, M.entrySpeechWhere(where), v.speech, false);
  if (speech !== undefined && text !== undefined && speech.trim().toLowerCase() === text.trim().toLowerCase()) {
    c.info(`${path}.speech`, M.speechSameAsText(where));
  }

  checkGender(c, `${path}.gender`, where, M.labelGender, v.gender, lang);
  if (v.determiner !== undefined) {
    c.error(
      `${path}.determiner`,
      M.determinerMoved(where, JSON.stringify(v.determiner)),
    );
  }
  const form = checkForm(c, `${path}.form`, where, v.form, lang);
  if (form?.determiner !== undefined && v.gender === undefined) {
    c.warn(`${path}.form.determiner`, M.determinerNoGender(where));
  }
  if (text !== undefined && PACKED_FORMS.test(text)) {
    c.warn(
      `${path}.text`,
      M.packedForms(where, q(text)),
    );
  }
  const tags = checkTags(c, `${path}.tags`, where, v.tags);
  checkSkills(c, `${path}.skills`, where, v.skills);
  for (const key of Object.keys(v)) {
    if (!ENTRY_KEYS.has(key) && !OLD_ENTRY_KEYS.has(key)) {
      c.warn(`${path}.${key}`, M.entryUnknownKey(where, q(key)));
    }
  }
  const langs = isObject(v.meaning) ? Object.keys(v.meaning).filter((l) => includes(UI_LANGS, l)) : [];
  return { id, text, audio, tags, langs };
}

function checkLanguage(c: Collector, v: unknown, options: DeckCheckOptions): LanguageSupport | undefined {
  if (v === undefined) {
    c.error('language', M.languageMissing);
    return undefined;
  }
  if (typeof v !== 'string' || !LANGUAGE_TAG_PATTERN.test(v)) {
    c.error(
      'language',
      M.languageBadTag(q(String(v))),
    );
    return undefined;
  }
  if (!options.languages) return undefined;
  const pack = options.languages.find((l) => l.code === primaryLanguage(v));
  if (!pack) {
    c.error(
      'language',
      M.languageUnsupported(q(v), list(options.languages.map((l) => l.code))),
    );
  }
  return pack;
}

const VOICE_SKILLS: readonly string[] = ['speak', 'listen'];

/**
 * R16: forms that sound the same (ravi / ravie) — `speak` and `listen` at one entry only,
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
        M.sameSound(x.i + 1, y.i + 1, q(x.text), q(y.text), list(VOICE_SKILLS)),
      );
    }
  }
}

/** What the browser voice reads for an entry without audio: `speech` when the deck gives it (R34). */
export function voiceText(entry: Pick<DeckEntry, 'text' | 'speech'>): string {
  return entry.speech ?? entry.text;
}

/** Validates parsed deck.json content. */
export function validateDeck(value: unknown, options: DeckCheckOptions = {}): DeckCheck {
  const c = new Collector();
  if (!isObject(value)) {
    c.error('', M.deckNotObject(DECK_JSON, typeName(value)));
    return { deck: null, errors: c.errors, warnings: c.warnings, notes: [] };
  }

  if (value.format === LEGACY_DECK_FORMAT) {
    c.warn('format', M.formatLegacy(q(LEGACY_DECK_FORMAT), q(DECK_FORMAT)));
  } else if (value.format !== DECK_FORMAT) {
    c.error(
      'format',
      value.format === undefined
        ? M.formatMissing(DECK_FORMAT)
        : M.formatWrong(q(DECK_FORMAT), q(String(value.format))),
    );
  }
  if (value.version === undefined) {
    c.error('version', M.versionMissing(DECK_VERSION));
  } else if (typeof value.version !== 'number' || !Number.isInteger(value.version)) {
    c.error('version', M.versionNotInteger(DECK_VERSION, typeName(value.version)));
  } else if (value.version !== DECK_VERSION) {
    c.error(
      'version',
      value.version > DECK_VERSION
        ? M.versionNewer(value.version, DECK_VERSION)
        : M.versionUnsupported(value.version, DECK_VERSION),
    );
  }
  checkId(c, 'id', M.deckWhere, value.id);
  if (value.revision === undefined) {
    c.error('revision', M.revisionMissing);
  } else if (typeof value.revision !== 'number' || !Number.isInteger(value.revision) || value.revision < 1) {
    c.error('revision', M.revisionInvalid(q(String(value.revision))));
  }
  const lang = checkLanguage(c, value.language, options);
  const tagCodes = checkTagDictionary(c, value.tags);
  // R30: the name comes from the deck; without it, from the file name, which Chrome may suffix ("-1").
  if (value.title === undefined) {
    c.warn(
      'title',
      M.titleMissing,
    );
  } else {
    checkLocalized(c, 'title', M.deckWhere, value.title, 'title', M.labelDeckTitle, true);
  }
  for (const key of Object.keys(value)) {
    if (key === 'description') {
      c.warn(key, M.deckKeyUnused(q(key)));
    } else if (!DECK_KEYS.has(key)) {
      c.warn(key, M.deckKeyUnknown(q(key)));
    }
  }

  const entries = value.entries;
  if (entries === undefined) {
    c.error('entries', M.entriesMissing);
  } else if (!Array.isArray(entries)) {
    c.error('entries', M.entriesNotList(typeName(entries)));
  } else if (entries.length === 0) {
    c.error('entries', M.entriesEmpty);
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
          c.error(`entries[${i}].id`, M.entryIdDuplicate(i + 1, q(e.id), first + 1));
        } else ids.set(e.id, i);
      }
      if (e.text !== undefined) {
        const key = e.text.trim().toLowerCase();
        const first = texts.get(key);
        if (first !== undefined) {
          c.warn(`entries[${i}].text`, M.entryTextDuplicate(i + 1, q(e.text.trim()), first + 1));
        } else texts.set(key, i);
      }
      if (e.audio !== undefined) {
        const first = audios.get(e.audio);
        if (first !== undefined) {
          c.warn(`entries[${i}].audio`, M.entryAudioDuplicate(i + 1, q(e.audio), first + 1));
        } else audios.set(e.audio, i);
      }
      for (const l of e.langs) langCount.set(l, (langCount.get(l) ?? 0) + 1);
      for (const t of e.tags) tagUse.set(t, [...(tagUse.get(t) ?? []), i + 1]);
    });
    if (lang?.sameSound) sameSoundWarnings(c, entries, lang.sameSound);
    // R28: one answer per card, and what the app needs to check it.
    c.warnings.push(...contentWarnings(entries, lang?.deckRules));
    for (const [t, nums] of tagUse) {
      if (tagCodes.has(t)) continue;
      const shown = nums.slice(0, 5).join(', ') + (nums.length > 5 ? '…' : '');
      c.warn(
        'tags',
        M.tagUndescribed(q(t), shown),
      );
    }
    for (const t of tagCodes) {
      if (!tagUse.has(t)) c.warn(`tags.${t}`, M.tagUnused(q(t)));
    }
    for (const [l, n] of langCount) {
      const missing = entries.length - n;
      if (missing > 0) {
        c.warn(
          'entries',
          M.meaningMissingSome(l, missing, entries.length),
        );
      }
    }
  }

  return {
    deck: c.errors.length === 0 ? (value as unknown as Deck) : null,
    errors: c.errors,
    warnings: c.warnings,
    notes: c.notes,
  };
}

/** Ignored archive entries: folders and macOS/Windows metadata. */
function isJunk(path: string): boolean {
  return path.endsWith('/') || path.startsWith('__MACOSX/') || /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/i.test(path);
}

function megabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + M.unitMb;
}

/**
 * Entries without deck audio play the browser voice (R33 item 14). A deck with no audio
 * at all is a choice (a note); some entries without it is likely a forgotten file (a
 * warning). `listen` of such an entry needs the voice checked on the device.
 */
function audioSummary(result: DeckCheck, entries: readonly unknown[], hasAudio: (e: Record<string, unknown>) => boolean): void {
  const items = entries.filter(isObject);
  const without = items.flatMap((e, i) => (hasAudio(e) ? [] : [i + 1]));
  if (without.length === 0) return;
  const listen = items.some((e, i) => without.includes(i + 1) && Array.isArray(e.skills) && e.skills.includes('listen'));
  const tail = listen ? M.listenTail : '';
  if (without.length === items.length) {
    result.notes.push({ level: 'info', path: '', message: M.noAudioAtAll(tail) });
    return;
  }
  const shown = without.slice(0, 5).join(', ') + (without.length > 5 ? '…' : '');
  result.warnings.push({
    level: 'warning',
    path: '',
    message: M.noAudioSome(without.length, items.length, shown, tail),
  });
}

/**
 * Validates deck.json alone, without an archive (R33 item 15): pasted text or a .json
 * file. Audio paths are not looked up; every entry plays the browser voice.
 */
export function checkDeckJson(deckJsonText: string, options: DeckCheckOptions = {}): DeckCheck {
  const parsed = parseDeckJson(deckJsonText);
  if (parsed.error) return { deck: null, errors: [parsed.error], warnings: [], notes: [] };
  const result = validateDeck(parsed.value, options);
  const entries = isObject(parsed.value) && Array.isArray(parsed.value.entries) ? parsed.value.entries : [];
  const declared = entries.filter((e) => isObject(e) && typeof e.audio === 'string').length;
  if (declared > 0) {
    result.notes.push({
      level: 'info',
      path: '',
      message: M.jsonOnlyNoArchive(DECK_JSON, declared),
    });
  }
  audioSummary(result, entries, () => false);
  if (result.errors.length > 0) result.deck = null;
  return result;
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
      ? M.jsonInFolder(DECK_JSON, q(nested))
      : M.jsonMissing(DECK_JSON);
    return { deck: null, errors: [{ level: 'error', path: '', message }], warnings: [], notes: [] };
  }

  const parsed = parseDeckJson(deckJsonText);
  if (parsed.error) return { deck: null, errors: [parsed.error], warnings: [], notes: [] };
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
        ? M.audioCaseMismatch(i + 1, q(audio), q(near))
        : M.audioMissingInArchive(i + 1, q(audio)),
    });
  });
  for (const p of files) {
    if (p === DECK_JSON || used.has(p)) continue;
    result.warnings.push({
      level: 'warning',
      path: '',
      message: p.startsWith(AUDIO_DIR)
        ? M.fileUnused(q(p))
        : M.fileExtra(q(p), DECK_JSON),
    });
  }
  audioSummary(result, entries, (e) => typeof e.audio === 'string');
  if (options.archiveBytes !== undefined && options.archiveBytes > LARGE_ARCHIVE_BYTES) {
    const wav = [...used].filter((p) => p.endsWith('.wav')).length;
    result.warnings.push({
      level: 'warning',
      path: '',
      message:
        M.archiveLarge(megabytes(options.archiveBytes), megabytes(LARGE_ARCHIVE_BYTES)) +
        (wav > 0 ? M.archiveLargeWav(wav) : ''),
    });
  }
  if (result.errors.length > 0) result.deck = null;
  return result;
}
