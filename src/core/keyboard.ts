/**
 * The on-screen phone keyboard (R6, R31), the parts that need no browser: the keys
 * built from the language pack's layout, Shift, the long-press popup, which keyboard
 * is in use and what the journal records about it.
 */
import type { BottomKey, KeyboardLayout } from './languages';
import type { TypedKeyboard } from './model';

/**
 * Key height in portrait: not below Gboard's (≈ 44 px on the owner's phone, 412 CSS px
 * wide, measured from screenshots 20.10.2026).
 */
export const KEY_HEIGHT_PX = 54;
/** Key height in a low landscape window: not below Gboard's landscape keys (≈ 36–38 px). */
export const KEY_HEIGHT_LANDSCAPE_PX = 40;
/** A press held this long opens the variants. */
export const LONG_PRESS_MS = 350;
/** Backspace held: first repeat after this, then every REPEAT_EVERY_MS. */
export const REPEAT_DELAY_MS = 450;
export const REPEAT_EVERY_MS = 70;
/** Variants per popup row. */
export const POPUP_MAX_COLS = 6;

export type KeyKind = 'char' | 'shift' | 'backspace' | 'space' | 'enter';

export interface Key {
  /** Stable within the layout: the character, or the kind for the special keys. */
  id: string;
  kind: KeyKind;
  /** `char` keys: the character without Shift. */
  char?: string;
  /** Width in key units; a letter row is 10 units. */
  width: number;
}

export interface KeyRow {
  keys: Key[];
  /** Units of empty space on each side (a short row is centred, as in Gboard). */
  indent: number;
}

/** A letter row is this many letter keys wide. */
export const ROW_UNITS = 10;
/** The space bar is never narrower than this many letter keys. */
const MIN_SPACE_UNITS = 3;
const charKey = (c: string, width = 1): Key => ({ id: c, kind: 'char', char: c, width });

/** The bottom row of a layout that gives none, or an invalid one: space and Enter only. */
export const DEFAULT_BOTTOM: readonly BottomKey[] = [{ kind: 'space' }, { kind: 'enter', width: 1.4 }];

/** What is wrong with a bottom row (empty = fine). Tested for every language pack. */
export function bottomRowProblems(layout: KeyboardLayout): string[] {
  const bottom = layout.bottom;
  if (!bottom) return [];
  const problems: string[] = [];
  const count = (kind: BottomKey['kind']) => bottom.filter((k) => k.kind === kind).length;
  if (count('space') !== 1) problems.push('exactly one space bar');
  if (count('enter') !== 1) problems.push('exactly one Enter');
  let fixed = 0;
  const chars = new Set<string>();
  for (const k of bottom) {
    if (k.kind === 'space') continue;
    if (!(k.width > 0)) problems.push(`width of ${k.kind === 'char' ? k.char : 'Enter'} must be positive`);
    fixed += k.width;
    if (k.kind !== 'char') continue;
    if ([...k.char].length !== 1) problems.push(`one character per key: ${k.char}`);
    if (chars.has(k.char)) problems.push(`repeated key ${k.char}`);
    if (layout.rows.join('').includes(k.char)) problems.push(`${k.char} is also in a letter row`);
    chars.add(k.char);
  }
  if (fixed > ROW_UNITS - MIN_SPACE_UNITS) problems.push(`keys other than space take ${fixed} of ${ROW_UNITS - MIN_SPACE_UNITS} units`);
  return problems;
}

/** The bottom row used: the layout's own, or DEFAULT_BOTTOM if it has none or an invalid one. */
export function bottomRow(layout: KeyboardLayout): readonly BottomKey[] {
  return layout.bottom && bottomRowProblems(layout).length === 0 ? layout.bottom : DEFAULT_BOTTOM;
}

/** The rows of the keyboard: the letter rows (Shift and Backspace around the last), then the bottom row. */
export function keyboardRows(layout: KeyboardLayout): KeyRow[] {
  const rows: Key[][] = layout.rows.map((r) => [...r].map((c) => charKey(c)));
  const last = rows[rows.length - 1];
  if (last) {
    const side = Math.max(1, (ROW_UNITS - last.length) / 2);
    last.unshift({ id: 'shift', kind: 'shift', width: side });
    last.push({ id: 'backspace', kind: 'backspace', width: side });
  }
  const bottom = bottomRow(layout);
  const fixed = bottom.reduce((n, k) => n + (k.kind === 'space' ? 0 : k.width), 0);
  rows.push(
    bottom.map((k): Key => {
      switch (k.kind) {
        case 'char':
          return charKey(k.char, k.width);
        case 'space':
          return { id: 'space', kind: 'space', width: Math.max(MIN_SPACE_UNITS, ROW_UNITS - fixed) };
        case 'enter':
          return { id: 'enter', kind: 'enter', width: k.width };
      }
    }),
  );
  return rows.map((keys) => ({ keys, indent: Math.max(0, (ROW_UNITS - keys.reduce((n, k) => n + k.width, 0)) / 2) }));
}

/** The character a key types: Shift makes letters capital; marks, and letters without a one-character capital (ß), stay. */
export function shiftChar(ch: string, shift: boolean): string {
  if (!shift) return ch;
  const up = ch.toUpperCase();
  return up.length === ch.length ? up : ch;
}

/** Long-press variants of a key, with Shift applied. */
export function keyVariants(layout: KeyboardLayout, ch: string, shift: boolean): string[] {
  return (layout.variants[ch] ?? []).map((v) => shiftChar(v, shift));
}

/** Every character the keyboard can type (without Shift). */
export function reachableChars(layout: KeyboardLayout): Set<string> {
  const all = new Set<string>([...layout.rows.join(''), ' ']);
  for (const k of bottomRow(layout)) if (k.kind === 'char') all.add(k.char);
  for (const vs of Object.values(layout.variants)) for (const v of vs) all.add(v);
  return all;
}

/** Popup grid for `count` variants: up to POPUP_MAX_COLS per row. */
export function popupGrid(count: number, maxCols = POPUP_MAX_COLS): { cols: number; rows: number } {
  const cols = Math.max(1, Math.min(count, maxCols));
  return { cols, rows: Math.max(1, Math.ceil(count / cols)) };
}

/**
 * The popup's cells top to bottom, left to right: variant indexes, null for an empty
 * cell. The first row of variants (the preselected one first) is the bottom row, next
 * to the key under the finger; further rows go up (R41). A short row is left-aligned.
 */
export function popupCells(count: number, cols: number, rows: number): (number | null)[] {
  const cells: (number | null)[] = [];
  for (let shown = 0; shown < rows; shown++) {
    const row = rows - 1 - shown;
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      cells.push(i < count ? i : null);
    }
  }
  return cells;
}

/** A rectangle in viewport coordinates. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PopupPlacement {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  left: number;
  top: number;
}

/**
 * Where the popup of a key goes: cells as wide as a letter key (R41; not the pressed
 * key, which may be wider), the first variant over the key as far as the screen allows,
 * never closer than 4 px to a side.
 */
export function popupPlacement(p: { key: Box; letterW: number; count: number; viewportW: number }): PopupPlacement {
  const { cols, rows } = popupGrid(p.count);
  const cellW = Math.max(p.letterW, 40);
  const cellH = Math.min(p.key.height, 52);
  const width = cols * cellW;
  const left = Math.min(Math.max(4, p.key.left + p.key.width / 2 - cellW / 2), Math.max(4, p.viewportW - width - 4));
  return { cols, rows, cellW, cellH, left, top: p.key.top - rows * cellH - 6 };
}

/**
 * While the finger stays this close to where it touched the key, the preselected first
 * variant stays chosen (R41): a held finger always shifts a little.
 */
export const STILL_X_PX = 15;
export const STILL_UP_PX = 10;
export const STILL_DOWN_PX = 20;

export interface PopupPick {
  count: number;
  cols: number;
  rows: number;
  /** Popup cell size and its top-left corner, in the same coordinates as x and y. */
  cellW: number;
  cellH: number;
  left: number;
  top: number;
  /** Finger position. */
  x: number;
  y: number;
  /** Where the finger touched the key; near it the first variant stays chosen. */
  origin?: { x: number; y: number };
  /** How far beside or above the popup the finger may go and still choose. */
  slack: number;
  /** How far below the popup (over the key that opened it) the finger may go. */
  below: number;
}

/**
 * Which variant the finger is on. Near the touch point — the first; beside the popup the
 * nearest cell counts (within `slack`); below it, over the key, the row nearest to the key
 * (the first row, R41); further away — none (releasing there types nothing). A gap at the
 * end of a short row picks the last variant.
 */
export function pickVariant(p: PopupPick): number | null {
  if (p.origin) {
    const dx = p.x - p.origin.x;
    const dy = p.y - p.origin.y;
    if (Math.abs(dx) <= STILL_X_PX && dy >= -STILL_UP_PX && dy <= STILL_DOWN_PX) return 0;
  }
  const width = p.cols * p.cellW;
  const height = p.rows * p.cellH;
  if (p.x < p.left - p.slack || p.x > p.left + width + p.slack) return null;
  if (p.y < p.top - p.slack || p.y > p.top + height + p.below) return null;
  const col = Math.min(p.cols - 1, Math.max(0, Math.floor((p.x - p.left) / p.cellW)));
  const shown = Math.min(p.rows - 1, Math.max(0, Math.floor((p.y - p.top) / p.cellH)));
  return Math.min(p.count - 1, (p.rows - 1 - shown) * p.cols + col);
}

/** What a released key types: the chosen variant if the popup was open (nothing if none chosen), else the key itself. */
export function releasedChar(p: { char: string; variants: readonly string[]; popupOpen: boolean; index: number | null }): string | null {
  if (!p.popupOpen) return p.char;
  return p.index === null ? null : (p.variants[p.index] ?? null);
}

/**
 * Which keyboard answers are typed with (R31): the on-screen one on a touch device,
 * the device's own when the owner chose it in Settings, a physical one elsewhere.
 */
export type KeyboardMode = 'onscreen' | 'system' | 'physical';

export function keyboardMode(p: { coarsePointer: boolean; systemKeyboard: boolean }): KeyboardMode {
  if (!p.coarsePointer) return 'physical';
  return p.systemKeyboard ? 'system' : 'onscreen';
}

/** What typed the first character of an answer: an on-screen key or the browser's own input (not a paste). */
export type FirstInput = 'onscreen' | 'native' | null;

/**
 * The journal's `keyboard` for a typed answer. With the on-screen keyboard up, native
 * input can only come from a physical keyboard (the system one is hidden).
 */
export function typedKeyboard(mode: KeyboardMode, first: FirstInput): TypedKeyboard | null {
  if (first === null) return null;
  if (first === 'onscreen') return 'onscreen';
  return mode === 'system' ? 'system' : 'physical';
}

/** What the journal gets about a typed answer (R31). */
export interface TypedInputInfo {
  keyboard: TypedKeyboard | null;
  pasted: boolean;
}
