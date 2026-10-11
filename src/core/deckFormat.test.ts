import { describe, expect, it } from 'vitest';
import {
  AUDIO_EXTENSIONS,
  checkDeckArchive,
  GENDERS,
  ID_PATTERN,
  MEANING_LANGS,
  parseDeckJson,
  SKILLS,
  validateDeck,
  type DeckIssue,
} from './deckFormat';
import schema from './sluh-deck.schema.json';

function entry(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'bonjour',
    fr: 'bonjour',
    ipa: 'bɔ̃ʒuʁ',
    meaning: { tg: 'салом', ru: 'здравствуйте' },
    audio: 'audio/bonjour.mp3',
    skills: ['listen', 'speak', 'write'],
    ...over,
  };
}

function deck(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { format: 'sluh-deck', version: 1, id: 'fr-lesson-01', title: 'Урок 1', entries: [entry()], ...over };
}

const messages = (issues: DeckIssue[]) => issues.map((i) => i.message);

function errorsOf(value: unknown): string[] {
  return messages(validateDeck(value).errors);
}

describe('validateDeck: valid decks', () => {
  it('accepts a minimal correct deck and returns it', () => {
    const r = validateDeck(deck());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.deck?.entries[0]?.fr).toBe('bonjour');
  });

  it('accepts optional fields missing (audio, gender) and gender m/f', () => {
    const r = validateDeck(
      deck({
        entries: [
          entry({ id: 'oui', fr: 'oui', audio: undefined, meaning: { tg: 'ҳа', ru: 'да' } }),
          entry({ id: 'le-nom', fr: 'le nom', gender: 'm', audio: 'audio/le-nom.wav', meaning: { tg: 'насаб', ru: 'фамилия' } }),
          entry({ id: 'la-nationalite', fr: 'la nationalité', gender: 'f', audio: undefined, meaning: { tg: 'шаҳрвандӣ', ru: 'гражданство' } }),
        ],
      }),
    );
    expect(r.errors).toEqual([]);
  });
});

describe('validateDeck: deck-level errors', () => {
  it('rejects a non-object root', () => {
    expect(errorsOf([])[0]).toContain('должен быть объект');
    expect(errorsOf(null)[0]).toContain('null');
  });

  it('requires format sluh-deck', () => {
    expect(errorsOf(deck({ format: undefined }))[0]).toContain('Нет поля format');
    expect(errorsOf(deck({ format: 'anki' }))[0]).toContain('Это не колода «Слуха»');
  });

  it('checks version: missing, not integer, newer, older', () => {
    expect(errorsOf(deck({ version: undefined }))[0]).toContain('Нет поля version');
    expect(errorsOf(deck({ version: '1' }))[0]).toContain('целым числом');
    expect(errorsOf(deck({ version: 2 }))[0]).toContain('Обновите приложение');
    expect(errorsOf(deck({ version: 0 }))[0]).toContain('не поддерживается');
  });

  it('checks deck id and title', () => {
    expect(errorsOf(deck({ id: 'Урок 1' }))[0]).toContain('id «Урок 1» не подходит');
    expect(errorsOf(deck({ id: undefined }))[0]).toContain('нет обязательного поля id');
    expect(errorsOf(deck({ title: '  ' }))[0]).toContain('пустая строка');
  });

  it('requires a non-empty entries list', () => {
    expect(errorsOf(deck({ entries: undefined }))[0]).toContain('Нет поля entries');
    expect(errorsOf(deck({ entries: {} }))[0]).toContain('должно быть списком');
    expect(errorsOf(deck({ entries: [] }))[0]).toContain('пуст');
  });

  it('warns about unknown deck fields', () => {
    const r = validateDeck(deck({ author: 'x' }));
    expect(r.errors).toEqual([]);
    expect(messages(r.warnings)[0]).toContain('неизвестное поле «author»');
  });

  it('returns no deck when there are errors', () => {
    expect(validateDeck(deck({ version: 2 })).deck).toBeNull();
  });
});

describe('validateDeck: entry errors', () => {
  const one = (over: Record<string, unknown>) => errorsOf(deck({ entries: [entry(over)] }));

  it('names the entry by number and id', () => {
    expect(one({ fr: '' })[0]).toMatch(/^Запись 1 \(id «bonjour»\), поле fr/);
    expect(one({ id: undefined })[0]).toMatch(/^Запись 1 \(«bonjour»\): нет обязательного поля id/);
  });

  it('rejects a non-object entry', () => {
    expect(errorsOf(deck({ entries: ['bonjour'] }))[0]).toContain('должна быть объектом');
  });

  it('rejects bad ids and duplicate ids', () => {
    expect(one({ id: 'Bonjour' })[0]).toContain('не подходит');
    expect(one({ id: '-x' })[0]).toContain('не подходит');
    expect(one({ id: 'a'.repeat(65) })[0]).toContain('не подходит');
    const dup = errorsOf(deck({ entries: [entry(), entry({ fr: 'salut' })] }));
    expect(dup).toEqual(['Запись 2: id «bonjour» уже есть у записи 1. id должны быть разными.']);
  });

  it('requires fr as non-empty plain text', () => {
    expect(one({ fr: undefined })[0]).toContain('нет обязательного поля');
    expect(one({ fr: 5 })[0]).toContain('должна быть строка, а сейчас число');
    expect(one({ fr: '<b>bonjour</b>' })[0]).toContain('HTML');
    expect(one({ fr: 'bonjour&nbsp;!' })[0]).toContain('HTML');
    expect(one({ audio: undefined, fr: 'bonjour [sound:x.wav]' })[0]).toContain('разметку Anki');
  });

  it('rejects IPA with brackets or slashes, warns when IPA is missing', () => {
    expect(one({ ipa: '[bɔ̃ʒuʁ]' })[0]).toContain('без скобок');
    expect(one({ ipa: '/bɔ̃ʒuʁ/' })[0]).toContain('без скобок');
    const r = validateDeck(deck({ entries: [entry({ ipa: undefined })] }));
    expect(r.errors).toEqual([]);
    expect(messages(r.warnings)).toEqual(['Запись 1 (id «bonjour»): нет IPA (произношения).']);
  });

  it('checks meaning: object, known languages, non-empty texts', () => {
    expect(one({ meaning: undefined })[0]).toContain('нет обязательного поля meaning');
    expect(one({ meaning: 'салом' })[0]).toContain('должно быть объектом');
    expect(one({ meaning: {} })[0]).toContain('хотя бы на одном языке');
    expect(one({ meaning: { fa: 'سلام' } })[0]).toContain('неизвестный язык значения «fa»');
    expect(one({ meaning: { tg: '' } })[0]).toContain('значение на tg: пустая строка');
  });

  it('accepts a single meaning language', () => {
    for (const lang of MEANING_LANGS) {
      expect(one({ meaning: { [lang]: 'x' } })).toEqual([]);
    }
  });

  it('checks audio paths', () => {
    expect(one({ audio: 'bonjour.mp3' })[0]).toContain('в папке audio/');
    expect(one({ audio: 'audio\\bonjour.mp3' })[0]).toContain('обратная косая');
    expect(one({ audio: 'audio/../deck.json.mp3' })[0]).toContain('недопустимый путь');
    expect(one({ audio: 'audio/bonjour.aiff' })[0]).toContain('неподдерживаемый тип');
    expect(one({ audio: 'audio/bonjour.MP3' })[0]).toContain('строчными');
    expect(one({ audio: '' })[0]).toContain('непустой строкой');
    for (const ext of AUDIO_EXTENSIONS) expect(one({ audio: `audio/a/b.${ext}` })).toEqual([]);
  });

  it('checks gender', () => {
    expect(one({ gender: 'masc' })[0]).toContain('Допустимо "m"');
    expect(one({ gender: null })[0]).toContain('не подходит');
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
    expect(one({ fr: '', skills: [], gender: 'x' })).toHaveLength(3);
  });
});

describe('validateDeck: warnings', () => {
  it('warns about unknown entry fields, duplicate fr and shared audio', () => {
    const r = validateDeck(
      deck({
        entries: [entry({ note: 'x' }), entry({ id: 'bonjour-2', fr: 'Bonjour' })],
      }),
    );
    expect(r.errors).toEqual([]);
    expect(messages(r.warnings)).toEqual([
      'Запись 1 (id «bonjour»): неизвестное поле «note» — будет пропущено.',
      'Запись 2: тот же французский текст «Bonjour», что у записи 1.',
      'Запись 2: файл «audio/bonjour.mp3» уже используется в записи 1.',
    ]);
  });

  it('warns when a meaning language is missing for some entries', () => {
    const r = validateDeck(
      deck({ entries: [entry(), entry({ id: 'merci', fr: 'merci', audio: undefined, meaning: { tg: 'ташаккур' } })] }),
    );
    expect(messages(r.warnings)).toEqual([
      'Значение на ru есть не у всех записей: не хватает у 1 из 2. Для них приложение покажет другой язык.',
    ]);
  });

  it('warns about surrounding spaces', () => {
    const r = validateDeck(deck({ entries: [entry({ fr: ' bonjour' })] }));
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
    const r = checkDeckArchive(['deck.json', 'audio/', 'audio/bonjour.mp3', '__MACOSX/._deck.json', 'audio/.DS_Store'], json);
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

  it('reports missing audio files, with a hint about letter case', () => {
    expect(messages(checkDeckArchive(['deck.json'], json).errors)).toEqual([
      'Запись 1: файла «audio/bonjour.mp3» нет в архиве.',
    ]);
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
});

describe('JSON Schema stays in sync with the validator', () => {
  const entrySchema = schema.$defs.entry;

  it('uses the same enums', () => {
    expect(entrySchema.properties.skills.items.enum).toEqual([...SKILLS]);
    expect(entrySchema.properties.meaning.propertyNames.enum).toEqual([...MEANING_LANGS]);
    expect(entrySchema.properties.gender.enum).toEqual([...GENDERS]);
    expect(entrySchema.properties.audio.pattern).toContain(`(${AUDIO_EXTENSIONS.join('|')})`);
  });

  it('uses the same id pattern, format and version', () => {
    expect(schema.$defs.id.pattern).toBe(ID_PATTERN.source);
    expect(schema.properties.format.const).toBe('sluh-deck');
    expect(schema.properties.version.const).toBe(1);
    expect(schema.required).toEqual(['format', 'version', 'id', 'title', 'entries']);
    expect(entrySchema.required).toEqual(['id', 'fr', 'meaning', 'skills']);
  });
});
