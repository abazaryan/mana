import { describe, expect, it } from 'vitest';
import table from '../../docs/I18N_TG.md?raw';
import { FORM_LABELS } from '../core/deckFormat';
import { LANGUAGE_PACKS } from '../core/languages';
import { STRINGS, tableExtras, tajikTable, translate, type Lang } from './strings';

const LANGS: Lang[] = ['tg', 'ru', 'en'];
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('interface strings', () => {
  it('every string exists in all three languages with the same placeholders', () => {
    for (const [key, tr] of Object.entries(STRINGS)) {
      for (const l of LANGS) expect(tr[l].trim(), `${key}.${l}`).not.toBe('');
      expect(placeholders(tr.tg), key).toEqual(placeholders(tr.ru));
      expect(placeholders(tr.en), key).toEqual(placeholders(tr.ru));
    }
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(translate('ru', 'decks.entries', { n: 30 })).toBe('Записей: 30');
    expect(translate('tg', 'decks.entries', { n: 30 })).toBe('Омӯзбаргҳо: 30');
    expect(translate('en', 'decks.entries')).toBe('Entries: {n}');
  });

  it('docs/I18N_TG.md is up to date (npm run i18n:table)', () => {
    expect(table.replace(/\r\n/g, '\n')).toBe(tajikTable(tableExtras(FORM_LABELS, LANGUAGE_PACKS)));
  });
});
