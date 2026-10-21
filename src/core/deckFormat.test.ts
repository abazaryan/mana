import { describe, expect, it } from 'vitest';
import {
  introHints,
  AUDIO_EXTENSIONS,
  checkDeckArchive,
  DETERMINERS,
  FORM_KEYS,
  FORM_LABELS,
  GENDERS,
  NUMBERS,
  ID_PATTERN,
  LANGUAGE_TAG_PATTERN,
  LARGE_ARCHIVE_BYTES,
  SKILLS,
  UI_LANGS,
  deckNameFromFileName,
  formHints,
  pickLocalized,
  pickLocalizedWithLang,
  validateDeck,
  voiceText,
  parseDeckJson,
  type DeckIssue,
} from './deckFormat';
import { FRENCH, findLanguagePack, LANGUAGE_PACKS, speechLocale } from './languages';
import schema from './mana-deck.schema.json';

function entry(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'bonjour',
    text: 'bonjour',
    ipa: 'bɔ̃ʒuʁ',
    meaning: { tg: 'салом', ru: 'здравствуйте' },
    audio: 'audio/bonjour.mp3',
    skills: ['listen', 'speak', 'write'],
    ...over,
  };
}

function deck(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: 'mana-deck',
    version: 1,
    id: 'fr-lesson-01',
    revision: 1,
    language: 'fr-FR',
    title: { tg: 'Фаронсавӣ · Дарси 1', ru: 'Французский · Урок 1', en: 'French · Lesson 1' },
    entries: [entry()],
    ...over,
  };
}

const withPacks = { languages: LANGUAGE_PACKS };
const messages = (issues: DeckIssue[]) => issues.map((i) => i.message);

function errorsOf(value: unknown): string[] {
  return messages(validateDeck(value, withPacks).errors);
}

const one = (over: Record<string, unknown>) => errorsOf(deck({ entries: [entry(over)] }));

describe('validateDeck: valid decks', () => {
  it('accepts a minimal correct deck and returns it', () => {
    const r = validateDeck(deck(), withPacks);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.deck?.entries[0]?.text).toBe('bonjour');
  });

  it('accepts all optional fields', () => {
    const r = validateDeck(
      deck({
        tags: { word: { tg: 'вожа', ru: 'слово', en: 'word' }, form: { ru: 'анкета' } },
        entries: [
          entry({
            id: 'le-nom',
            text: 'le nom',
            meaning: { tg: 'насаб', ru: 'фамилия' },
            hint: { ru: 'в анкете' },
            note: { ru: 'Не путать с le prénom.' },
            audio: 'audio/le-nom.wav',
            gender: 'm',
            form: { determiner: 'definite', number: 'singular' },
            tags: ['word', 'form'],
          }),
          entry({ id: 'un-nom', text: 'un nom', meaning: { tg: 'насаб', ru: 'фамилия' }, audio: undefined, gender: 'm', form: { determiner: 'indefinite' }, skills: ['speak', 'write'] }),
          entry({ id: 'ravie', text: 'ravie', meaning: { tg: 'хурсанд', ru: 'рада' }, audio: undefined, form: { gender: 'f' }, skills: ['write'] }),
        ],
      }),
      withPacks,
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});

describe('validateDeck: deck-level errors', () => {
  it('rejects a non-object root', () => {
    expect(errorsOf([])[0]).toContain('должен быть объект');
    expect(errorsOf(null)[0]).toContain('null');
  });

  it('requires format mana-deck', () => {
    expect(errorsOf(deck({ format: undefined }))[0]).toContain('Нет поля format');
    expect(errorsOf(deck({ format: 'anki' }))[0]).toContain('Это не колода «Маны»');
  });

  it('accepts the old identifier sluh-deck with a warning', () => {
    const r = validateDeck(deck({ format: 'sluh-deck' }), withPacks);
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.message).join(' ')).toContain('прежний идентификатор');
  });

  it('checks version: missing, not integer, newer, older', () => {
    expect(errorsOf(deck({ version: undefined }))[0]).toContain('Нет поля version');
    expect(errorsOf(deck({ version: '1' }))[0]).toContain('целым числом');
    expect(errorsOf(deck({ version: 2 }))[0]).toContain('Обновите приложение');
    expect(errorsOf(deck({ version: 0 }))[0]).toContain('не поддерживается');
  });

  it('checks deck id', () => {
    expect(errorsOf(deck({ id: 'Урок 1' }))[0]).toContain('id «Урок 1» не подходит');
    expect(errorsOf(deck({ id: undefined }))[0]).toContain('нет обязательного поля id');
  });

  it('checks revision', () => {
    expect(errorsOf(deck({ revision: undefined }))[0]).toContain('Нет поля revision');
    expect(errorsOf(deck({ revision: 0 }))[0]).toContain('от 1');
    expect(errorsOf(deck({ revision: 1.5 }))[0]).toContain('целым числом');
    expect(errorsOf(deck({ revision: '2' }))[0]).toContain('целым числом');
    expect(errorsOf(deck({ revision: 7 }))).toEqual([]);
  });

  it('checks language: missing, malformed, unsupported', () => {
    expect(errorsOf(deck({ language: undefined }))[0]).toContain('Нет поля language');
    expect(errorsOf(deck({ language: 'french' }))[0]).toContain('не код языка BCP-47');
    expect(errorsOf(deck({ language: 'fr_FR' }))[0]).toContain('не код языка BCP-47');
    expect(errorsOf(deck({ language: 'lb-LU' }))[0]).toBe(
      'Язык «lb-LU» пока не поддерживается приложением. Поддерживаются: fr.',
    );
    expect(errorsOf(deck({ language: 'fr' }))).toEqual([]);
    expect(errorsOf(deck({ language: 'fr-CA' }))).toEqual([]);
  });

  it('accepts any well-formed language when no packs are given', () => {
    expect(validateDeck(deck({ language: 'de-DE' })).errors).toEqual([]);
    expect(validateDeck(deck({ language: 'sr-Latn-RS' })).errors).toEqual([]);
  });

  it('title (Р30): in interface languages, a warning without it, an error for a wrong type; description only warns', () => {
    const r = validateDeck(deck({ title: { ru: 'Урок 1' }, description: 'x' }), withPacks);
    expect(r.errors).toEqual([]);
    expect(r.deck?.title).toEqual({ ru: 'Урок 1' });
    expect(messages(r.warnings)).toEqual(['Колода: поле «description» не используется. Поле будет пропущено.']);
    const none = validateDeck(deck({ title: undefined }), withPacks);
    expect(none.errors).toEqual([]);
    expect(messages(none.warnings)).toHaveLength(1);
    expect(messages(none.warnings)[0]).toContain('нет поля title');
    expect(messages(none.warnings)[0]).toContain('«-1» (Р30)');
    expect(errorsOf(deck({ title: 'Урок 1' }))[0]).toContain('Колода: title должно быть объектом с языками');
    expect(errorsOf(deck({ title: {} }))[0]).toContain('title пустое');
    const odd = validateDeck(deck({ title: { tg: 'Дарс', tj: 'Дарс' } }), withPacks);
    expect(odd.errors).toEqual([]);
    expect(messages(odd.warnings)[0]).toContain('в title язык «tj» не поддерживается');
  });

  it('checks the tag dictionary', () => {
    const tagged = (tags: unknown) => deck({ tags, entries: [entry({ tags: ['word'] })] });
    expect(errorsOf(tagged(['word']))[0]).toContain('tags должно быть словарём тегов');
    expect(errorsOf(tagged({ Word: { ru: 'слово' }, word: { ru: 'слово' } }))[0]).toContain('код тега «Word» не подходит');
    expect(errorsOf(tagged({ word: 'слово' }))[0]).toContain('Тег «word»: tags.word должно быть объектом');
    expect(errorsOf(tagged({ word: {} }))[0]).toContain('tags.word пустое');
    expect(errorsOf(tagged({ word: { de: 'Wort' } }))[0]).toContain('tags.word пустое');
    expect(errorsOf(tagged({ word: { tg: 'вожа' } }))).toEqual([]);
  });

  it('requires a non-empty entries list', () => {
    expect(errorsOf(deck({ entries: undefined }))[0]).toContain('Нет поля entries');
    expect(errorsOf(deck({ entries: {} }))[0]).toContain('должно быть списком');
    expect(errorsOf(deck({ entries: [] }))[0]).toContain('пуст');
  });

  it('warns about unknown deck fields', () => {
    const r = validateDeck(deck({ author: 'x' }), withPacks);
    expect(r.errors).toEqual([]);
    expect(messages(r.warnings)[0]).toContain('неизвестное поле «author»');
  });

  it('returns no deck when there are errors', () => {
    expect(validateDeck(deck({ version: 2 }), withPacks).deck).toBeNull();
  });
});

describe('validateDeck: entry errors', () => {
  it('names the entry by number and id', () => {
    expect(one({ text: '' })[0]).toMatch(/^Запись 1 \(id «bonjour»\), поле text/);
    expect(one({ id: undefined })[0]).toMatch(/^Запись 1 \(«bonjour»\): нет обязательного поля id/);
  });

  it('rejects a non-object entry', () => {
    expect(errorsOf(deck({ entries: ['bonjour'] }))[0]).toContain('должна быть объектом');
  });

  it('rejects bad ids and duplicate ids', () => {
    expect(one({ id: 'Bonjour' })[0]).toContain('не подходит');
    expect(one({ id: '-x' })[0]).toContain('не подходит');
    expect(one({ id: 'a'.repeat(65) })[0]).toContain('не подходит');
    const dup = errorsOf(deck({ entries: [entry(), entry({ text: 'salut' })] }));
    expect(dup).toEqual(['Запись 2: id «bonjour» уже есть у записи 1. id должны быть разными.']);
  });

  it('requires text as non-empty plain text', () => {
    expect(one({ text: undefined })[0]).toContain('нет обязательного поля');
    expect(one({ text: 5 })[0]).toContain('должна быть строка, а сейчас число');
    expect(one({ text: '<b>bonjour</b>' })[0]).toContain('HTML');
    expect(one({ text: 'bonjour&nbsp;!' })[0]).toContain('HTML');
    expect(one({ audio: undefined, text: 'bonjour [sound:x.wav]' })[0]).toContain('разметку Anki');
  });

  it('explains the old field name fr', () => {
    const r = validateDeck(deck({ entries: [entry({ text: undefined, fr: 'bonjour' })] }), withPacks);
    expect(messages(r.errors)).toEqual(['Запись 1 (id «bonjour»): поле fr переименовано в text — переименуйте его.']);
    expect(r.warnings).toEqual([]);
  });

  it('rejects IPA with brackets or slashes, warns when IPA is missing', () => {
    expect(one({ ipa: '[bɔ̃ʒuʁ]' })[0]).toContain('без скобок');
    expect(one({ ipa: '/bɔ̃ʒuʁ/' })[0]).toContain('без скобок');
    const r = validateDeck(deck({ entries: [entry({ ipa: undefined })] }), withPacks);
    expect(r.errors).toEqual([]);
    expect(messages(r.warnings)).toEqual(['Запись 1 (id «bonjour»): нет IPA (произношения).']);
  });

  it('checks meaning: object, known languages, non-empty texts', () => {
    expect(one({ meaning: undefined })[0]).toContain('нет обязательного поля meaning (значение)');
    expect(one({ meaning: 'салом' })[0]).toContain('meaning должно быть объектом');
    expect(one({ meaning: {} })[0]).toContain('хотя бы на одном языке');
    expect(one({ meaning: { fa: 'سلام' } })[0]).toContain('хотя бы на одном языке');
    expect(one({ meaning: { tg: '' } })[0]).toContain('meaning на tg: пустая строка');
  });

  it('warns (not errors) about meaning and tag-name keys outside tg/ru/en', () => {
    for (const bad of ['tj', 'tgk', 'tg-TJ', 'fa']) {
      const r = validateDeck(
        deck({
          tags: { word: { ru: 'слово', [bad]: 'x' } },
          entries: [entry({ tags: ['word'], meaning: { ru: 'привет', [bad]: 'x' }, note: { ru: 'n', [bad]: 'x' } })],
        }),
        withPacks,
      );
      expect(r.errors, bad).toEqual([]);
      const w = r.warnings.map((x) => x.message);
      expect(w.filter((m) => m.includes(`язык «${bad}» не поддерживается`)), bad).toHaveLength(3);
      expect(w.join(' ')).toContain('не покажет');
    }
  });

  it('still needs at least one of tg/ru/en in meaning', () => {
    expect(one({ meaning: { tj: 'x' } })[0]).toContain('хотя бы на одном языке');
  });

  it('accepts a single meaning language', () => {
    for (const lang of UI_LANGS) expect(one({ meaning: { [lang]: 'x' } })).toEqual([]);
  });

  it('checks hint and note like meaning', () => {
    expect(one({ hint: 'вежливо' })[0]).toContain('hint должно быть объектом');
    expect(one({ hint: {} })[0]).toContain('hint пустое');
  });

  it('checks audio paths: only mp3 and wav', () => {
    expect(one({ audio: 'bonjour.mp3' })[0]).toContain('в папке audio/');
    expect(one({ audio: 'audio\\bonjour.mp3' })[0]).toContain('обратная косая');
    expect(one({ audio: 'audio/../deck.json.mp3' })[0]).toContain('недопустимый путь');
    expect(one({ audio: 'audio/bonjour.ogg' })[0]).toContain('неподдерживаемый тип');
    expect(one({ audio: 'audio/bonjour.MP3' })[0]).toContain('строчными');
    expect(one({ audio: '' })[0]).toContain('непустой строкой');
    for (const ext of AUDIO_EXTENSIONS) expect(one({ audio: `audio/a/b.${ext}` })).toEqual([]);
  });

  it('checks gender, including genders of the deck language', () => {
    expect(one({ gender: 'masc' })[0]).toContain('Допустимо "m" (мужской), "f" (женский), "n" (средний)');
    expect(one({ gender: null })[0]).toContain('не подходит');
    expect(one({ gender: 'n' })[0]).toBe('Запись 1 (id «bonjour»): в языке «fr» нет рода «n» (средний). Допустимо: m, f.');
    expect(validateDeck(deck({ language: 'de-DE', entries: [entry({ gender: 'n' })] })).errors).toEqual([]);
  });

  it('checks form.determiner and warns when it comes without gender', () => {
    expect(one({ gender: 'm', form: { determiner: 'def' } })[0]).toContain('"definite" (определённая форма)');
    const r = validateDeck(deck({ entries: [entry({ form: { determiner: 'definite' } })] }), withPacks);
    expect(r.errors).toEqual([]);
    expect(messages(r.warnings)[0]).toContain('указан form.determiner, но нет gender');
  });

  it('reports the old top-level determiner as moved into form', () => {
    expect(one({ gender: 'm', determiner: 'definite' })).toEqual([
      'Запись 1 (id «bonjour»): поле determiner перенесено в form — напишите "form": {"determiner": "definite"}.',
    ]);
    const r = validateDeck(deck({ entries: [entry({ gender: 'm', determiner: 'definite' })] }), withPacks);
    expect(messages(r.warnings)).toEqual([]);
  });

  it('checks form: object, not empty, known values, genders of the language', () => {
    expect(one({ form: 'definite' })[0]).toContain('form должно быть объектом');
    expect(one({ form: {} })[0]).toContain('form пустое');
    expect(one({ form: { number: 'pl' } })[0]).toContain('"singular" (единственное число)');
    expect(one({ form: { gender: 'masc' } })[0]).toContain('form.gender «masc» не подходит');
    expect(one({ form: { gender: 'n' } })[0]).toContain('в языке «fr» нет рода «n»');
    expect(one({ form: { gender: 'f', number: 'plural' } })).toEqual([]);
    const r = validateDeck(deck({ entries: [entry({ form: { gender: 'f', case: 'acc' } })] }), withPacks);
    expect(r.errors).toEqual([]);
    expect(messages(r.warnings)[0]).toContain('неизвестное поле form.case');
  });

  it('warns about a bracket or a slash left in text', () => {
    for (const text of ['ravi(e)', 'le/la voisin', "Vous venez d'où ? / Tu viens d'où ?"]) {
      const r = validateDeck(deck({ entries: [entry({ text })] }), withPacks);
      expect(r.errors).toEqual([]);
      expect(messages(r.warnings)[0]).toContain('в text есть «(» или «/»');
    }
  });

  it('checks entry tags as codes', () => {
    expect(one({ tags: 'word' })[0]).toContain('tags должно быть списком кодов тегов');
    expect(one({ tags: [3] })[0]).toContain('код тега должен быть строкой');
    expect(one({ tags: ['вожа'] })[0]).toContain('код тега «вожа» не подходит');
    expect(one({ tags: [''] })[0]).toContain('не подходит');
    expect(one({ tags: [] })).toEqual([]);
    const r = validateDeck(deck({ tags: { word: { ru: 'слово' } }, entries: [entry({ tags: ['word', 'word'] })] }), withPacks);
    expect(messages(r.warnings)).toEqual(['Запись 1 (id «bonjour»): тег «word» указан дважды.']);
  });

  it('warns about tags without a name and unused tag names', () => {
    const r = validateDeck(
      deck({
        tags: { word: { ru: 'слово' }, verb: { ru: 'глагол' } },
        entries: [entry({ tags: ['word', 'kor'] }), entry({ id: 'merci', text: 'merci', audio: undefined, meaning: { tg: 'ташаккур', ru: 'спасибо' }, skills: ['speak'], tags: ['kor'] })],
      }),
      withPacks,
    );
    expect(r.errors).toEqual([]);
    expect(messages(r.warnings)).toEqual([
      'Тег «kor» не описан в словаре tags колоды (записи 1, 2) — приложение покажет код вместо названия.',
      'Тег «verb» описан в словаре tags, но не используется ни одной записью.',
    ]);
  });

  it('checks skills', () => {
    expect(one({ skills: undefined })[0]).toContain('нет обязательного поля skills');
    expect(one({ skills: 'listen' })[0]).toContain('должно быть списком');
    expect(one({ skills: [] })[0]).toContain('хотя бы один навык');
    expect(one({ skills: ['read'] })[0]).toContain('неизвестный навык «read»');
    expect(one({ skills: ['listen', 'listen'] })[0]).toContain('указан дважды');
    expect(one({ skills: ['speak'] })).toEqual([]);
  });

  it('collects several errors at once', () => {
    expect(one({ text: '', skills: [], gender: 'x' })).toHaveLength(3);
  });
});

describe('speech: the text for the browser voice (Р34)', () => {
  it('is optional plain text', () => {
    const r = validateDeck(deck({ entries: [entry({ id: 'ciao', text: 'ciao', speech: 'tchao', audio: undefined })] }), withPacks);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.notes).toEqual([]);
    expect(r.deck?.entries[0]?.speech).toBe('tchao');
  });

  it('rejects a non-string, an empty string and HTML', () => {
    expect(one({ speech: 5 }).join()).toMatch(/speech.*строка/);
    expect(one({ speech: ' ' }).join()).toMatch(/speech.*пустая строка/);
    expect(one({ speech: '<b>tchao</b>' }).join()).toMatch(/speech.*HTML/);
  });

  it('the same as text is only a note', () => {
    const r = validateDeck(deck({ entries: [entry({ speech: 'Bonjour' })] }), withPacks);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(messages(r.notes)).toEqual(['Запись 1 (id «bonjour»): speech совпадает с text — поле не нужно, голос браузера и так читает text.']);
  });

  it('the browser voice reads speech, else text', () => {
    expect(voiceText({ text: 'ciao', speech: 'tchao' })).toBe('tchao');
    expect(voiceText({ text: 'bonjour' })).toBe('bonjour');
  });
});

describe('validateDeck: warnings', () => {
  it('warns about unknown entry fields, duplicate text and shared audio', () => {
    const r = validateDeck(deck({ entries: [entry({ comment: 'x' }), entry({ id: 'bonjour-2', text: 'Bonjour' })] }), withPacks);
    expect(r.errors).toEqual([]);
    expect(messages(r.warnings)).toEqual([
      'Запись 1 (id «bonjour»): неизвестное поле «comment» — будет пропущено.',
      'Запись 2: тот же текст «Bonjour», что у записи 1.',
      'Запись 2: файл «audio/bonjour.mp3» уже используется в записи 1.',
      'Записи 1 и 2 («bonjour», «Bonjour»): одинаковое значение (tg) «салом», а form и hint их не различают — у карточки два правильных ответа. Разведите значения или добавьте hint / form (Р28).',
    ]);
  });

  it('warns when a meaning language is missing for some entries', () => {
    const r = validateDeck(
      deck({ entries: [entry(), entry({ id: 'merci', text: 'merci', audio: undefined, meaning: { tg: 'ташаккур' }, skills: ['speak'] })] }),
      withPacks,
    );
    expect(messages(r.warnings)).toEqual([
      'Значение на ru есть не у всех записей: не хватает у 1 из 2. Для них приложение покажет другой язык.',
    ]);
  });

  it('warns about surrounding spaces', () => {
    const r = validateDeck(deck({ entries: [entry({ text: ' bonjour' })] }), withPacks);
    expect(messages(r.warnings)[0]).toContain('пробелы в начале или в конце');
  });
});

describe('parseDeckJson', () => {
  it('parses JSON and strips a BOM', () => {
    expect(parseDeckJson('﻿{"a":1}')).toEqual({ value: { a: 1 }, error: null });
  });

  it('explains invalid JSON in Russian', () => {
    const r = parseDeckJson('{\n  "a": 1,\n}');
    expect(r.error?.message).toContain('это не правильный JSON');
    expect(r.error?.message).toContain('лишняя запятая');
  });
});

describe('checkDeckArchive', () => {
  const json = JSON.stringify(deck());

  it('accepts a correct archive and ignores folders and system files', () => {
    const r = checkDeckArchive(['deck.json', 'audio/', 'audio/bonjour.mp3', '__MACOSX/._deck.json', 'audio/.DS_Store'], json, withPacks);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.deck).not.toBeNull();
  });

  it('reports missing deck.json, and deck.json inside a folder', () => {
    expect(messages(checkDeckArchive(['audio/x.mp3'], undefined).errors)).toEqual(['В архиве нет файла deck.json.']);
    expect(messages(checkDeckArchive(['lesson/deck.json'], undefined).errors)[0]).toContain('а должен — в корне архива');
  });

  it('reports invalid JSON', () => {
    expect(messages(checkDeckArchive(['deck.json'], '{').errors)[0]).toContain('не правильный JSON');
  });

  it('passes language packs to the deck check', () => {
    const lb = JSON.stringify(deck({ language: 'lb-LU' }));
    expect(messages(checkDeckArchive(['deck.json', 'audio/bonjour.mp3'], lb, withPacks).errors)[0]).toContain('пока не поддерживается');
  });

  it('reports missing audio files, with a hint about letter case', () => {
    expect(messages(checkDeckArchive(['deck.json'], json).errors)).toEqual(['Запись 1: файла «audio/bonjour.mp3» нет в архиве.']);
    const r = checkDeckArchive(['deck.json', 'audio/Bonjour.mp3'], json);
    expect(messages(r.errors)[0]).toContain('есть «audio/Bonjour.mp3» — регистр букв');
    expect(r.deck).toBeNull();
  });

  it('does not double-report an audio path that is already invalid', () => {
    const bad = JSON.stringify(deck({ entries: [entry({ audio: 'bonjour.mp3' })] }));
    expect(checkDeckArchive(['deck.json', 'bonjour.mp3'], bad).errors).toHaveLength(1);
  });

  it('warns about unused audio and extra files', () => {
    const r = checkDeckArchive(['deck.json', 'audio/bonjour.mp3', 'audio/old.mp3', 'notes.txt'], json);
    expect(r.errors).toEqual([]);
    expect(messages(r.warnings)).toEqual([
      'Файл «audio/old.mp3» не используется ни одной записью.',
      'Лишний файл «notes.txt» — будет пропущен (нужны только deck.json и папка audio/).',
    ]);
  });

  it('warns about a large archive and suggests MP3 when WAV is used', () => {
    const files = ['deck.json', 'audio/bonjour.mp3'];
    expect(checkDeckArchive(files, json, { archiveBytes: LARGE_ARCHIVE_BYTES }).warnings).toEqual([]);
    const mp3 = checkDeckArchive(files, json, { archiveBytes: LARGE_ARCHIVE_BYTES + 1 });
    expect(messages(mp3.warnings)[0]).toMatch(/^Архив большой: 20,0 МБ \(порог 20,0 МБ\)/);
    expect(messages(mp3.warnings)[0]).not.toContain('WAV');
    const wavJson = JSON.stringify(deck({ entries: [entry({ audio: 'audio/bonjour.wav' })] }));
    const wav = checkDeckArchive(['deck.json', 'audio/bonjour.wav'], wavJson, { archiveBytes: 31 * 1024 * 1024 });
    expect(wav.errors).toEqual([]);
    expect(messages(wav.warnings)[0]).toContain('31,0 МБ');
    expect(messages(wav.warnings)[0]).toContain('WAV-файлов: 1');
  });
});

describe('deckNameFromFileName', () => {
  it('uses the ZIP file name without extension, in any language', () => {
    expect(deckNameFromFileName('Фаронсавӣ · Дарси 01.zip')).toBe('Фаронсавӣ · Дарси 01');
    expect(deckNameFromFileName('C:\\Downloads\\Урок 2.ZIP')).toBe('Урок 2');
    expect(deckNameFromFileName('/sdcard/Download/lesson.v2.zip')).toBe('lesson.v2');
    expect(deckNameFromFileName('deck')).toBe('deck');
  });
});

describe('pickLocalized', () => {
  it('prefers the interface language, else any available one', () => {
    expect(pickLocalized({ tg: 'вожа', ru: 'слово' }, 'ru')).toBe('слово');
    expect(pickLocalized({ tg: 'кор' }, 'en')).toBe('кор');
    expect(pickLocalized({ en: 'word', ru: 'слово' }, 'tg')).toBe('слово');
    expect(pickLocalized(undefined, 'ru')).toBeUndefined();
  });
});

describe('formHints', () => {
  it('lists hints in the interface language: determiner, gender, number', () => {
    const form = { number: 'plural', gender: 'f', determiner: 'indefinite' } as const;
    expect(formHints(form, 'ru')).toEqual(['неопред.', 'ж. р.', 'мн. ч.']);
    expect(formHints(form, 'en')).toEqual(['indef.', 'f.', 'pl.']);
    expect(formHints(form, 'tg')).toEqual(['номуай.', 'муан.', 'ҷамъ']);
    expect(formHints({ gender: 'm' }, 'tg')).toEqual(['музак.']);
    expect(formHints({ gender: 'n' }, 'tg')).toEqual(['хунсо']);
    expect(formHints({ determiner: 'definite' }, 'tg')).toEqual(['муай.']);
    expect(formHints(undefined, 'ru')).toEqual([]);
  });

  it('has a label for every value in every interface language', () => {
    for (const d of DETERMINERS) for (const l of UI_LANGS) expect(FORM_LABELS.determiner[d][l]).toBeTruthy();
    for (const g of GENDERS) for (const l of UI_LANGS) expect(FORM_LABELS.gender[g][l]).toBeTruthy();
    for (const n of NUMBERS) for (const l of UI_LANGS) expect(FORM_LABELS.number[n][l]).toBeTruthy();
  });
});

describe('language packs', () => {
  it('finds the pack by the primary subtag', () => {
    expect(findLanguagePack('fr-FR')).toBe(FRENCH);
    expect(findLanguagePack('fr')).toBe(FRENCH);
    expect(findLanguagePack('FR-ca')).toBe(FRENCH);
    expect(findLanguagePack('lb-LU')).toBeUndefined();
  });

  it('chooses the speech locale', () => {
    expect(speechLocale('fr-CA')).toBe('fr-CA');
    expect(speechLocale('fr')).toBe('fr-FR');
    expect(speechLocale('de-DE')).toBeUndefined();
  });

  it('French: genders m/f (the keyboard is tested in keyboard.test.ts)', () => {
    expect(FRENCH.genders).toEqual(['m', 'f']);
    for (const g of FRENCH.genders) expect(GENDERS).toContain(g);
    expect(LANGUAGE_TAG_PATTERN.test(FRENCH.defaultLocale)).toBe(true);
  });
});

describe('JSON Schema stays in sync with the validator', () => {
  const entrySchema = schema.$defs.entry;

  it('uses the same enums', () => {
    expect(entrySchema.properties.skills.items.enum).toEqual([...SKILLS]);
    expect(Object.keys(schema.$defs.localized.properties)).toEqual([...UI_LANGS]);
    expect(entrySchema.properties.gender.enum).toEqual([...GENDERS]);
    expect(entrySchema.properties.form.properties.determiner.enum).toEqual([...DETERMINERS]);
    expect(entrySchema.properties.form.properties.gender.enum).toEqual([...GENDERS]);
    expect(entrySchema.properties.form.properties.number.enum).toEqual([...NUMBERS]);
    expect(Object.keys(entrySchema.properties.form.properties)).toEqual([...FORM_KEYS]);
    expect(entrySchema.properties.audio.pattern).toContain(`(${AUDIO_EXTENSIONS.join('|')})`);
    expect(entrySchema.properties.tags.items.$ref).toBe('#/$defs/id');
    expect(schema.properties.tags.propertyNames.$ref).toBe('#/$defs/id');
  });

  it('uses the same patterns, format, version and required fields', () => {
    expect(schema.$defs.id.pattern).toBe(ID_PATTERN.source);
    expect(schema.properties.language.pattern).toBe(LANGUAGE_TAG_PATTERN.source);
    expect(schema.properties.format.const).toBe('mana-deck');
    expect(schema.properties.version.const).toBe(1);
    expect(schema.required).toEqual(['format', 'version', 'id', 'revision', 'language', 'entries']);
    expect(entrySchema.required).toEqual(['id', 'text', 'meaning', 'skills']);
  });

  it('lists every field the validator knows', () => {
    expect(Object.keys(schema.properties).sort()).toEqual(
      ['format', 'version', 'id', 'revision', 'language', 'tags', 'title', 'entries'].sort(),
    );
    expect(Object.keys(entrySchema.properties).sort()).toEqual(
      ['id', 'text', 'ipa', 'meaning', 'hint', 'note', 'audio', 'speech', 'gender', 'form', 'tags', 'skills'].sort(),
    );
  });
});

describe('pickLocalizedWithLang', () => {
  it('reports the language actually used', () => {
    expect(pickLocalizedWithLang({ tg: 'a', ru: 'б' }, 'ru')).toEqual({ text: 'б', lang: 'ru' });
    expect(pickLocalizedWithLang({ tg: 'a' }, 'en')).toEqual({ text: 'a', lang: 'tg' });
    expect(pickLocalizedWithLang({ en: 'w', ru: 'б' }, 'tg')).toEqual({ text: 'б', lang: 'ru' });
    expect(pickLocalizedWithLang(undefined, 'ru')).toBeUndefined();
  });
});

describe('validateDeck: forms that sound the same (Р16)', () => {
  const pair = (skillsOfSecond: string[]) =>
    deck({
      entries: [
        entry({ id: 'ravi', text: 'ravi', audio: 'audio/ravi.mp3', skills: ['listen', 'speak', 'write'] }),
        entry({ id: 'ravie', text: 'ravie', audio: 'audio/ravie.mp3', skills: skillsOfSecond }),
        entry({ id: 'petite', text: 'petite', audio: 'audio/petite.mp3', skills: ['speak'] }),
        entry({ id: 'petit', text: 'petit', audio: 'audio/petit.mp3', skills: ['speak'] }),
      ],
    });
  const sameSound = (v: unknown) => messages(validateDeck(v, withPacks).warnings).filter((m) => m.includes('звучат одинаково'));

  it('warns when both have `speak` or `listen`', () => {
    expect(sameSound(pair(['speak', 'write']))).toHaveLength(1);
    expect(sameSound(pair(['listen', 'write']))[0]).toContain('Записи 1 и 2');
  });

  it('is quiet when the second has `write` only, and for forms that sound different', () => {
    expect(sameSound(pair(['write']))).toEqual([]);
  });
});

describe('validateDeck: rejected Tajik terms in deck text', () => {
  const termWarnings = (over: Record<string, unknown>) =>
    messages(validateDeck(deck({ entries: [entry(over)] }), withPacks).warnings).filter((m) => m.includes('по глоссарию'));

  it('warns about «артикл» in a tg hint, meaning or note, naming the approved term', () => {
    const w = termWarnings({ hint: { tg: 'бо артикл', ru: 'с артиклем' } });
    expect(w).toHaveLength(1);
    expect(w[0]).toContain('hint.tg');
    expect(w[0]).toContain('шиносвожа');
    expect(termWarnings({ note: { tg: 'Артикли муайян' } })).toHaveLength(1);
  });

  it('is quiet for ru text and for the approved term', () => {
    expect(termWarnings({ hint: { ru: 'с артиклем', tg: 'на ном' } })).toEqual([]);
    expect(termWarnings({ note: { tg: 'шиносвожаи муайян' } })).toEqual([]);
  });
});

describe('introHints (Р16, 18.10.2026)', () => {
  it('leaves out the word gender when the form shows the same gender', () => {
    expect(introHints('m', { determiner: 'indefinite', gender: 'm' }, 'tg')).toEqual(['номуай.', 'музак.']);
  });

  it('shows the word gender when the form has none or another one', () => {
    expect(introHints('m', { determiner: 'definite' }, 'tg')).toEqual(['музак.', 'муай.']);
    expect(introHints('m', undefined, 'ru')).toEqual(['м. р.']);
    expect(introHints('f', { gender: 'm' }, 'tg')).toEqual(['муан.', 'музак.']);
    expect(introHints(undefined, { gender: 'f' }, 'tg')).toEqual(['муан.']);
  });
});
