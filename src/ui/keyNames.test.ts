import { describe, expect, it } from 'vitest';
import { keyboardRows } from '../core/keyboard';
import { FRENCH, LANGUAGE_PACKS } from '../core/languages';
import { NAMED, charKeyLabel } from './keyNames';

describe('screen reader labels of the on-screen keyboard (R31 item 9, R41)', () => {
  it('apostrophe: the hyphen by its name, then the marks as glyphs (approved by the owner 25.10.2026)', () => {
    const marks = '? ! : ; … « » " “ ” „';
    expect(charKeyLabel(FRENCH.keyboard, "'", false, 'tg')).toBe(`Апостроф, нигоҳ доред: хати пайванд, ${marks}`);
    expect(charKeyLabel(FRENCH.keyboard, "'", false, 'ru')).toBe(`Апостроф, удерживайте: дефис, ${marks}`);
    expect(charKeyLabel(FRENCH.keyboard, "'", false, 'en')).toBe(`Apostrophe, hold for hyphen, ${marks}`);
  });

  it('comma and period: names only, no variants', () => {
    expect(['tg', 'ru', 'en'].map((l) => charKeyLabel(FRENCH.keyboard, ',', false, l as 'tg'))).toEqual(['Вергул', 'Запятая', 'Comma']);
    expect(['tg', 'ru', 'en'].map((l) => charKeyLabel(FRENCH.keyboard, '.', false, l as 'tg'))).toEqual(['Нуқта', 'Точка', 'Period']);
  });

  it('letters as before: glyph, then the variants as glyphs', () => {
    expect(charKeyLabel(FRENCH.keyboard, 'e', false, 'tg')).toBe('e, нигоҳ доред: é è ê ë');
    expect(charKeyLabel(FRENCH.keyboard, 'e', true, 'en')).toBe('E, hold for É È Ê Ë');
    expect(charKeyLabel(FRENCH.keyboard, 'z', false, 'ru')).toBe('z');
  });

  it('every non-letter key of every bottom row has a name', () => {
    for (const pack of LANGUAGE_PACKS) {
      for (const key of keyboardRows(pack.keyboard)[pack.keyboard.rows.length]!.keys) {
        if (key.kind === 'char') expect(NAMED[key.char!]).toBeDefined();
      }
    }
  });
});
