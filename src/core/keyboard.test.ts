import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOTTOM,
  KEY_HEIGHT_LANDSCAPE_PX,
  KEY_HEIGHT_PX,
  ROW_UNITS,
  bottomRowProblems,
  keyboardMode,
  keyboardRows,
  keyVariants,
  pickVariant,
  popupCells,
  popupGrid,
  popupPlacement,
  reachableChars,
  releasedChar,
  shiftChar,
  typedKeyboard,
  type PopupPick,
} from './keyboard';
import { FRENCH, LANGUAGE_PACKS, marksPattern, type KeyboardLayout } from './languages';

const units = (row: ReturnType<typeof keyboardRows>[number]) => row.indent * 2 + row.keys.reduce((n, k) => n + k.width, 0);

describe('French layout (R31)', () => {
  const rows = keyboardRows(FRENCH.keyboard);

  it('QWERTY, Shift and Backspace around the last row, then apostrophe, comma, space, period, Enter (R41)', () => {
    expect(rows.map((r) => r.keys.map((k) => k.char ?? `[${k.kind}]`).join(' '))).toEqual([
      'q w e r t y u i o p',
      'a s d f g h j k l',
      '[shift] z x c v b n m [backspace]',
      "' , [space] . [enter]",
    ]);
  });

  it('bottom row widths as Gboard on the owner phone; the space bar takes the rest (R41)', () => {
    expect(rows[3]!.keys.map((k) => k.width)).toEqual([1.35, 1, 5.25, 1, 1.4]);
    expect(rows[3]!.indent).toBe(0);
  });

  it('every row is 10 units wide; the short row is centred', () => {
    for (const r of rows) expect(units(r)).toBeCloseTo(10);
    expect(rows[1]!.indent).toBe(0.5);
    expect(rows[0]!.indent).toBe(0);
  });

  it('no digits anywhere: numbers are learnt spelt out', () => {
    for (const ch of reachableChars(FRENCH.keyboard)) expect(/\d/.test(ch)).toBe(false);
  });

  it('reaches every letter of R6 and the apostrophe and hyphen', () => {
    const all = reachableChars(FRENCH.keyboard);
    for (const ch of "é è ê ë à â ç î ï ô û ù ü œ æ ' -".split(' ')) expect(all.has(ch)).toBe(true);
  });

  it('the hyphen is the first variant of the apostrophe; comma and period have none (R41)', () => {
    expect(FRENCH.keyboard.variants["'"]![0]).toBe('-');
    expect(FRENCH.keyboard.variants[',']).toBeUndefined();
    expect(FRENCH.keyboard.variants['.']).toBeUndefined();
    expect(FRENCH.keyboard.variants["'"]).not.toContain('’');
  });

  it('the apostrophe offers the marks "." offered before R41 except the comma, in the same order', () => {
    const before = [',', '?', '!', ':', ';', '…', '«', '»', '"', '“', '”', '„'];
    expect(FRENCH.keyboard.variants["'"]).toEqual(['-', ...before.filter((m) => m !== ',')]);
  });

  it('the apostrophe marks, comma and period are exactly what the written check ignores; apostrophe and hyphen count', () => {
    const marks = FRENCH.keyboard.variants["'"]!.filter((m) => m !== '-');
    const ignored = FRENCH.writing.ignoredPunctuation!;
    for (const m of [',', '.', ...marks]) expect(m.replace(ignored, '')).toBe('');
    expect('abc é \'-'.replace(ignored, '')).toBe('abc é \'-');
    expect(new Set([',', '.', ...marks]).size).toBe(13);
  });

  it('every variant is one character, hangs on a key of the layout, and is not on the layout itself', () => {
    const bottomChars = FRENCH.keyboard.bottom!.flatMap((k) => (k.kind === 'char' ? [k.char] : []));
    const onLayout = new Set([...FRENCH.keyboard.rows.join(''), ...bottomChars]);
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
    expect(keyVariants(FRENCH.keyboard, "'", true)).toEqual(FRENCH.keyboard.variants["'"]);
    expect(shiftChar('ß', true)).toBe('ß');
  });
  it('without Shift nothing changes; a key without variants has none', () => {
    expect(shiftChar('é', false)).toBe('é');
    expect(keyVariants(FRENCH.keyboard, 'z', false)).toEqual([]);
  });
});

describe('another language from data only (R13)', () => {
  const german: KeyboardLayout = {
    rows: ['qwertzuiop', 'asdfghjkl', 'yxcvbnm'],
    bottom: [{ kind: 'char', char: ',', width: 1 }, { kind: 'space' }, { kind: 'char', char: '.', width: 1 }, { kind: 'enter', width: 1.5 }],
    variants: { a: ['ä'], s: ['ß'] },
  };
  it('a QWERTZ layout with its own bottom row and variants', () => {
    const rows = keyboardRows(german);
    expect(rows[0]!.keys.map((k) => k.char).join('')).toBe('qwertzuiop');
    expect(rows[3]!.keys.map((k) => k.char ?? k.kind)).toEqual([',', 'space', '.', 'enter']);
    expect(rows[3]!.keys.map((k) => k.width)).toEqual([1, 6.5, 1, 1.5]);
    for (const r of rows) expect(units(r)).toBeCloseTo(10);
    expect(keyVariants(german, 's', true)).toEqual(['ß']);
  });
});

describe('bottom row (R41)', () => {
  const letters = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  it('every language pack has a valid bottom row', () => {
    for (const pack of LANGUAGE_PACKS) expect(bottomRowProblems(pack.keyboard)).toEqual([]);
  });
  it('no bottom row in the pack: space and Enter only', () => {
    const rows = keyboardRows({ rows: letters, variants: {} });
    expect(rows[3]!.keys.map((k) => k.kind)).toEqual(['space', 'enter']);
    expect(rows[3]!.keys.map((k) => k.width)).toEqual([8.6, 1.4]);
    expect(DEFAULT_BOTTOM).toHaveLength(2);
  });
  it('an invalid bottom row is reported and replaced by the default', () => {
    const bad: KeyboardLayout[] = [
      { rows: letters, bottom: [{ kind: 'char', char: '.', width: 1 }, { kind: 'enter', width: 1 }], variants: {} },
      { rows: letters, bottom: [{ kind: 'space' }, { kind: 'space' }, { kind: 'enter', width: 1 }], variants: {} },
      { rows: letters, bottom: [{ kind: 'space' }, { kind: 'char', char: '.', width: 6 }, { kind: 'enter', width: 1.5 }], variants: {} },
      { rows: letters, bottom: [{ kind: 'space' }, { kind: 'char', char: 'q', width: 1 }, { kind: 'enter', width: 1 }], variants: {} },
      { rows: letters, bottom: [{ kind: 'space' }, { kind: 'char', char: '.', width: 0 }, { kind: 'enter', width: 1 }], variants: {} },
    ];
    for (const layout of bad) {
      expect(bottomRowProblems(layout).length).toBeGreaterThan(0);
      expect(keyboardRows(layout)[3]!.keys.map((k) => k.kind)).toEqual(['space', 'enter']);
    }
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
  it('two rows: the first row is the bottom one, next to the key (R41); a gap at the end of a short row picks the last variant', () => {
    const two: PopupPick = { ...one, count: 9, cols: 6, rows: 2 };
    expect(pickVariant({ ...two, x: 105, y: 260 })).toBe(0);
    expect(pickVariant({ ...two, x: 105, y: 210 })).toBe(6);
    expect(pickVariant({ ...two, x: 335, y: 210 })).toBe(8);
    expect(pickVariant({ ...two, x: 105, y: 330 })).toBe(0);
    expect(pickVariant({ ...two, x: 335, y: 260 })).toBe(5);
  });
  it('cells top to bottom: the first row of variants is shown at the bottom, a short row left-aligned', () => {
    expect(popupCells(4, 4, 1)).toEqual([0, 1, 2, 3]);
    expect(popupCells(12, 6, 2)).toEqual([6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5]);
    expect(popupCells(9, 6, 2)).toEqual([6, 7, 8, null, null, null, 0, 1, 2, 3, 4, 5]);
  });
  it('near the touch point the first variant stays chosen', () => {
    const o = { ...one, origin: { x: 150, y: 300 } };
    expect(pickVariant({ ...o, x: 165, y: 320 })).toBe(0);
    expect(pickVariant({ ...o, x: 135, y: 290 })).toBe(0);
    expect(pickVariant({ ...o, x: 166, y: 300 })).toBe(1);
  });
});

/**
 * The apostrophe of the French bottom row on the owner's screens (R41), laid out as the
 * component does it: 3 px of keyboard padding each side, rows at most 560 px wide.
 */
describe('holding the apostrophe types the hyphen (R41)', () => {
  const screens = [
    { name: '412x718', vw: 412, keyTop: 650, keyH: 62 },
    { name: '360x718', vw: 360, keyTop: 650, keyH: 62 },
    { name: '740x330', vw: 740, keyTop: 278, keyH: 48 },
  ];
  for (const s of screens) {
    it(`${s.name}: ±15 px across, 20 px down to 10 px up from the touch point — hyphen; the popup stays on screen`, () => {
      const rowW = Math.min(s.vw - 6, 560);
      const rowLeft = (s.vw - rowW) / 2;
      const letterW = rowW / ROW_UNITS;
      const apostrophe = keyboardRows(FRENCH.keyboard)[3]!.keys[0]!;
      expect(apostrophe.char).toBe("'");
      const key = { left: rowLeft, top: s.keyTop, width: apostrophe.width * letterW, height: s.keyH };
      const variants = FRENCH.keyboard.variants["'"]!;
      const place = popupPlacement({ key, letterW, count: variants.length, viewportW: s.vw });
      expect(place.left).toBeGreaterThanOrEqual(4);
      expect(place.left + place.cols * place.cellW).toBeLessThanOrEqual(s.vw - 4);
      // Wherever the finger lands on the key, it may then shift a little.
      for (const fx of [key.left + 4, key.left + key.width / 2, key.left + key.width - 4]) {
        for (const fy of [key.top + 6, key.top + key.height / 2, key.top + key.height - 6]) {
          for (const dx of [-15, -7, 0, 7, 15]) {
            for (const dy of [-10, -5, 0, 10, 20]) {
              const index = pickVariant({
                count: variants.length,
                ...place,
                x: fx + dx,
                y: fy + dy,
                origin: { x: fx, y: fy },
                slack: place.cellW,
                below: key.height + 40,
              });
              expect(variants[index!]).toBe('-');
            }
          }
        }
      }
    });
  }
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

describe('keyboard mode and the journal (R31)', () => {
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
    expect(KEY_HEIGHT_PX).toBeGreaterThanOrEqual(44);
    expect(KEY_HEIGHT_LANDSCAPE_PX).toBeGreaterThanOrEqual(38);
  });
});
