import { describe, expect, it } from 'vitest';
import { extractDeckJson, readDeckJson } from './deckArchive';
import { checkDeckArchive, checkDeckJson } from './deckFormat';
import { installedForAi, reportForAi } from './deckReport';
import { LANGUAGE_PACKS } from './languages';

const deck = (entries: unknown[]) =>
  JSON.stringify({
    format: 'mana-deck',
    version: 1,
    id: 'my-fr-test-01',
    revision: 1,
    language: 'fr-FR',
    title: { ru: 'Тест' },
    tags: { word: { ru: 'слово' } },
    entries,
  });
const oui = { id: 'oui', text: 'oui', ipa: 'wi', meaning: { ru: 'да' }, tags: ['word'], skills: ['speak', 'listen'] };
const non = { id: 'non', text: 'non', ipa: 'nɔ̃', meaning: { ru: 'нет' }, tags: ['word'], skills: ['speak'] };
const opts = { languages: LANGUAGE_PACKS };
const fence = '`'.repeat(3);

describe('audio is optional per entry (R33 item 14)', () => {
  it('a deck without any audio is accepted with a note, not a warning', () => {
    const r = checkDeckArchive(['deck.json'], deck([oui, non]), opts);
    expect(r.deck).not.toBeNull();
    expect(r.warnings).toEqual([]);
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0]!.message).toContain('голосом браузера');
    expect(r.notes[0]!.message).toContain('listen');
  });

  it('some entries without audio: a warning (likely a forgotten file)', () => {
    const r = checkDeckArchive(['deck.json', 'audio/oui.mp3'], deck([{ ...oui, audio: 'audio/oui.mp3' }, non]), opts);
    expect(r.deck).not.toBeNull();
    expect(r.notes).toEqual([]);
    expect(r.warnings.map((w) => w.message).join()).toContain('Нет audio у 1 из 2 записей (записи 2)');
  });

  it('every entry with audio: nothing said', () => {
    const r = checkDeckArchive(['deck.json', 'audio/non.mp3'], deck([{ ...non, audio: 'audio/non.mp3' }]), opts);
    expect(r.warnings).toEqual([]);
    expect(r.notes).toEqual([]);
  });
});

describe('deck.json without an archive (R33 item 15)', () => {
  it('audio paths are not looked up, they are dropped, and the notes say so', () => {
    const r = checkDeckJson(deck([{ ...oui, audio: 'audio/oui.mp3' }, non]), opts);
    expect(r.errors).toEqual([]);
    expect(r.notes.map((n) => n.message).join(' ')).toContain('без архива: файлы audio (1) не приложены');
    const a = readDeckJson(deck([{ ...oui, audio: 'audio/oui.mp3' }, non]), 'my deck.json');
    expect(a.name).toBe('my deck');
    expect(a.audio).toEqual([]);
    expect(a.check.deck!.entries.every((e) => e.audio === undefined)).toBe(true);
  });

  it('pasted AI answer: the json block is taken, the deck id names it', () => {
    const answer = `Вот колода:\n\n${fence}json\n${deck([non])}\n${fence}\n\n| файл | текст |`;
    expect(JSON.parse(extractDeckJson(answer)).id).toBe('my-fr-test-01');
    expect(extractDeckJson(`Ответ: ${deck([non])} — готово`)).toBe(deck([non]));
    const a = readDeckJson(answer, null);
    expect(a.check.errors).toEqual([]);
    expect(a.name).toBe('my-fr-test-01');
  });

  it('broken JSON is an error with its place', () => {
    const r = readDeckJson('{"format": "mana-deck",', null);
    expect(r.check.deck).toBeNull();
    expect(r.check.errors).toHaveLength(1);
  });
});

describe('texts for the AI', () => {
  it('report lists errors, warnings and notes with paths and asks for the whole deck.json', () => {
    const text = reportForAi({
      deckId: 'my-fr-test-01',
      revision: 2,
      errors: [{ level: 'error', path: 'entries[0].form', message: 'Запись 1: form пустое.' }],
      warnings: [{ level: 'warning', path: '', message: 'К2: «oui» уже есть.' }],
      notes: [{ level: 'info', path: '', message: 'В колоде нет звука.' }],
    });
    expect(text).toContain('колоды my-fr-test-01, редакция 2');
    expect(text).toContain('ошибок 1, предупреждений 1, сведений 1');
    expect(text).toContain('1. [entries[0].form] Запись 1: form пустое.');
    expect(text).toContain('ПРЕДУПРЕЖДЕНИЯ');
    expect(text).toContain('СВЕДЕНИЯ (исправлять не нужно):\n1. В колоде нет звука.');
    expect(text).toContain('Верни deck.json целиком');
  });

  it('a clean check says so', () => {
    expect(reportForAi({ deckId: 'x', revision: 1, errors: [], warnings: [], notes: [] })).toContain('Ошибок и предупреждений нет.');
  });

  it('installed entries: visible ones, meanings, form and hint', () => {
    const text = installedForAi([
      {
        id: 'fr-lesson-01',
        title: 'Французский · Урок 1',
        language: 'fr-FR',
        entries: [
          { text: 'le nom', meaning: { tg: 'насаб', ru: 'фамилия' }, form: { determiner: 'definite' } },
          { text: 'salut', meaning: { ru: 'привет' }, hint: { ru: 'при встрече' } },
          { text: 'caché', meaning: { ru: 'скрыто' }, hidden: 1 },
        ],
      },
    ]);
    expect(text).toContain('«Французский · Урок 1» (id fr-lesson-01, fr-FR):');
    expect(text).toContain('- le nom — tg: насаб; ru: фамилия [form: definite]');
    expect(text).toContain('- salut — ru: привет (hint: ru: при встрече)');
    expect(text).not.toContain('caché');
    expect(installedForAi([])).toContain('Установленных колод нет.');
    expect(installedForAi([], 'en')).toContain('No decks installed.');
  });
});
