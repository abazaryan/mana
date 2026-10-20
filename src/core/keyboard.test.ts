import { describe, expect, it } from 'vitest';
import {
  KEY_HEIGHT_LANDSCAPE_PX,
  KEY_HEIGHT_PX,
  keyboardMode,
  keyboardRows,
  keyVariants,
  pickVariant,
  popupGrid,
  reachableChars,
  releasedChar,
  shiftChar,
  typedKeyboard,
  type PopupPick,
} from './keyboard';
import { FRENCH, marksPattern, type KeyboardLayout } from './languages';

const units = (row: ReturnType<typeof keyboardRows>[number]) => row.indent * 2 + row.keys.reduce((n, k) => n + k.width, 0);

describe('French layout (Р31)', () => {
  const rows = keyboardRows(FRENCH.keyboard);

  it('QWERTY, Shift and Backspace around the last row, then apostrophe, hyphen, space, period, Enter', () => {
    expect(rows.map((r) => r.keys.map((k) => k.char ?? `[${k.kind}]`).join(' '))).toEqual([
      'q w e r t y u i o p',
      'a s d f g h j k l',
      '[shift] z x c v b n m [backspace]',
      "' - [space] . [enter]",
    ]);
  });

  it('every row is 10 units wide; the short row is centred', () => {
    for (const r of rows) expect(units(r)).toBeCloseTo(10);
    expect(rows[1]!.indent).toBe(0.5);
    expect(rows[0]!.indent).toBe(0);
  });

  it('no digits anywhere: numbers are learnt spelt out', () => {
    for (const ch of reachableChars(FRENCH.keyboard)) expect(/\d/.test(ch)).toBe(false);
  });

  it('reaches every letter of Р6 and the apostrophe and hyphen', () => {
    const all = reachableChars(FRENCH.keyboard);
    for (const ch of "é è ê ë à â ç î ï ô û ù ü œ æ ' -".split(' ')) expect(all.has(ch)).toBe(true);
  });

  it('the apostrophe and hyphen are on the main layout, not behind a long press', () => {
    expect(FRENCH.keyboard.beforeSpace).toEqual(["'", '-']);
  });

  it('long press on "." offers exactly the punctuation the written check ignores', () => {
    const marks = FRENCH.keyboard.variants['.']!;
    expect(marks).not.toContain('.');
    const ignored = FRENCH.writing.ignoredPunctuation!;
    for (const m of ['.', ...marks]) expect(m.replace(ignored, '')).toBe('');
    // …and nothing else is ignored.
    expect('abc é \'-'.replace(ignored, '')).toBe('abc é \'-');
    expect(new Set(['.', ...marks]).size).toBe(marks.length + 1);
  });

  it('every variant is one character, hangs on a key of the layout, and is not on the layout itself', () => {
    const onLayout = new Set([...FRENCH.keyboard.rows.join(''), ...FRENCH.keyboard.beforeSpace, ...FRENCH.keyboard.afterSpace]);
    for (const [base, vs] of Object.entries(FRENCH.keyboard.variants)) {
      expect(onLayout.has(base)).toBe(true);
      expect(vs.length).toBeGreaterThan(0);
      for (const v of vs) {
        expect([...v]).toHaveLength(1);
        expect(onLayout.has(v)).toBe(false);
      }
    }
  });

  it('the ignored-punctuation pattern matches exactly what the hand-written one did before the list', () => {
    const before = /[.,!?;:…«»"“”„]/g;
    let sample = '« Ça va ? » — oui… “bien”, „ja“; non: si! ’ ‘ ‹ › – —';
    for (let c = 32; c < 127; c++) sample += String.fromCharCode(c);
    expect(sample.replace(FRENCH.writing.ignoredPunctuation!, '')).toBe(sample.replace(before, ''));
  });
});

describe('marksPattern', () => {
  it('escapes the characters special inside a class', () => {
    const p = marksPattern([']', '^', '-', '\\', 'a']);
    expect('x]^-\\ay'.replace(p, '')).toBe('xy');
  });
});

describe('Shift', () => {
  it('capitals for letters and their variants', () => {
    expect(shiftChar('e', true)).toBe('E');
    expect(keyVariants(FRENCH.keyboard, 'e', true)).toEqual(['É', 'È', 'Ê', 'Ë']);
    expect(keyVariants(FRENCH.keyboard, 'o', true)).toEqual(['Ô', 'Œ']);
    expect(keyVariants(FRENCH.keyboard, 'a', true)).toEqual(['À', 'Â', 'Æ']);
  });
  it('marks stay; ß has no one-character capital and stays', () => {
    expect(shiftChar("'", true)).toBe("'");
    expect(keyVariants(FRENCH.keyboard, '.', true)).toEqual(FRENCH.keyboard.variants['.']);
    expect(shiftChar('ß', true)).toBe('ß');
  });
  it('without Shift nothing changes; a key without variants has none', () => {
    expect(shiftChar('é', false)).toBe('é');
    expect(keyVariants(FRENCH.keyboard, 'z', false)).toEqual([]);
  });
});

describe('another language from data only (Р13)', () => {
  const german: KeyboardLayout = { rows: ['qwertzuiop', 'asdfghjkl', 'yxcvbnm'], beforeSpace: ['-'], afterSpace: ['.'], variants: { a: ['ä'], s: ['ß'] } };
  it('a QWERTZ layout with its own variants', () => {
    const rows = keyboardRows(german);
    expect(rows[0]!.keys.map((k) => k.char).join('')).toBe('qwertzuiop');
    expect(rows[3]!.keys.map((k) => k.char ?? k.kind)).toEqual(['-', 'space', '.', 'enter']);
    for (const r of rows) expect(units(r)).toBeCloseTo(10);
    expect(keyVariants(german, 's', true)).toEqual(['ß']);
  });
});

describe('popup', () => {
  it('one row up to six, then more rows', () => {
    expect(popupGrid(1)).toEqual({ cols: 1, rows: 1 });
    expect(popupGrid(4)).toEqual({ cols: 4, rows: 1 });
    expect(popupGrid(12)).toEqual({ cols: 6, rows: 2 });
    expect(popupGrid(13)).toEqual({ cols: 6, rows: 3 });
  });

  const one: PopupPick = { count: 4, cols: 4, rows: 1, cellW: 40, cellH: 50, left: 100, top: 200, x: 0, y: 0, slack: 20, below: 120 };
  it('the finger over a cell picks it', () => {
    expect(pickVariant({ ...one, x: 105, y: 220 })).toBe(0);
    expect(pickVariant({ ...one, x: 185, y: 220 })).toBe(2);
    expect(pickVariant({ ...one, x: 259, y: 249 })).toBe(3);
  });
  it('below the popup, over the key, the horizontal position still picks', () => {
    expect(pickVariant({ ...one, x: 150, y: 300 })).toBe(1);
  });
  it('just beside the popup: the nearest cell', () => {
    expect(pickVariant({ ...one, x: 90, y: 220 })).toBe(0);
    expect(pickVariant({ ...one, x: 270, y: 220 })).toBe(3);
  });
  it('far away: nothing', () => {
    expect(pickVariant({ ...one, x: 50, y: 220 })).toBeNull();
    expect(pickVariant({ ...one, x: 150, y: 100 })).toBeNull();
    expect(pickVariant({ ...one, x: 150, y: 400 })).toBeNull();
  });
  it('two rows; the gap at the end of a short last row picks the last variant', () => {
    const two: PopupPick = { ...one, count: 9, cols: 6, rows: 2 };
    expect(pickVariant({ ...two, x: 105, y: 210 })).toBe(0);
    expect(pickVariant({ ...two, x: 105, y: 260 })).toBe(6);
    expect(pickVariant({ ...two, x: 335, y: 260 })).toBe(8);
    expect(pickVariant({ ...two, x: 335, y: 300 })).toBe(8);
  });
});

describe('releasedChar', () => {
  const variants = ['é', 'è'];
  it('a tap types the key', () => {
    expect(releasedChar({ char: 'e', variants, popupOpen: false, index: null })).toBe('e');
  });
  it('a long press types the chosen variant, or nothing', () => {
    expect(releasedChar({ char: 'e', variants, popupOpen: true, index: 1 })).toBe('è');
    expect(releasedChar({ char: 'e', variants, popupOpen: true, index: null })).toBeNull();
  });
});

describe('keyboard mode and the journal (Р31)', () => {
  it('touch device: on-screen unless the system keyboard is chosen; otherwise physical', () => {
    expect(keyboardMode({ coarsePointer: true, systemKeyboard: false })).toBe('onscreen');
    expect(keyboardMode({ coarsePointer: true, systemKeyboard: true })).toBe('system');
    expect(keyboardMode({ coarsePointer: false, systemKeyboard: false })).toBe('physical');
    expect(keyboardMode({ coarsePointer: false, systemKeyboard: true })).toBe('physical');
  });
  it('the keyboard of the first character', () => {
    expect(typedKeyboard('onscreen', 'onscreen')).toBe('onscreen');
    // The system keyboard is hidden: native input is a physical keyboard.
    expect(typedKeyboard('onscreen', 'native')).toBe('physical');
    expect(typedKeyboard('system', 'native')).toBe('system');
    expect(typedKeyboard('physical', 'native')).toBe('physical');
    expect(typedKeyboard('onscreen', null)).toBeNull();
  });
  it('keys are not smaller than Gboard on the owner phone', () => {
    expect(KEY_HEIGHT_PX).toBeGreaterThanOrEqual(39);
    expect(KEY_HEIGHT_LANDSCAPE_PX).toBeGreaterThanOrEqual(34);
  });
});
