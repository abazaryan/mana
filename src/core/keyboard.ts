/**
 * The on-screen phone keyboard (Р6, Р31), the parts that need no browser: the keys
 * built from the language pack's layout, Shift, the long-press popup, which keyboard
 * is in use and what the journal records about it.
 */
import type { KeyboardLayout } from './languages';
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

const ROW_UNITS = 10;
const charKey = (c: string): Key => ({ id: c, kind: 'char', char: c, width: 1 });

/** The rows of the keyboard: the letter rows (Shift and Backspace around the last), then the space bar row. */
export function keyboardRows(layout: KeyboardLayout): KeyRow[] {
  const rows: Key[][] = layout.rows.map((r) => [...r].map(charKey));
  const last = rows[rows.length - 1];
  if (last) {
    const side = Math.max(1, (ROW_UNITS - last.length) / 2);
    last.unshift({ id: 'shift', kind: 'shift', width: side });
    last.push({ id: 'backspace', kind: 'backspace', width: side });
  }
  const around = [...layout.beforeSpace, ...layout.afterSpace].length;
  const enter = 1.5;
  rows.push([
    ...layout.beforeSpace.map(charKey),
    { id: 'space', kind: 'space', width: Math.max(3, ROW_UNITS - around - enter) },
    ...layout.afterSpace.map(charKey),
    { id: 'enter', kind: 'enter', width: enter },
  ]);
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
  const all = new Set<string>([...layout.rows.join(''), ...layout.beforeSpace, ...layout.afterSpace, ' ']);
  for (const vs of Object.values(layout.variants)) for (const v of vs) all.add(v);
  return all;
}

/** Popup grid for `count` variants: up to POPUP_MAX_COLS per row. */
export function popupGrid(count: number, maxCols = POPUP_MAX_COLS): { cols: number; rows: number } {
  const cols = Math.max(1, Math.min(count, maxCols));
  return { cols, rows: Math.max(1, Math.ceil(count / cols)) };
}

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
  /** How far beside or above the popup the finger may go and still choose. */
  slack: number;
  /** How far below the popup (over the key that opened it) the finger may go. */
  below: number;
}

/**
 * Which variant the finger is on. Beside the popup the nearest cell counts (within
 * `slack`); below it, over the key, the row nearest to the key; further away — none
 * (releasing there types nothing). A gap at the end of a short last row picks the last variant.
 */
export function pickVariant(p: PopupPick): number | null {
  const width = p.cols * p.cellW;
  const height = p.rows * p.cellH;
  if (p.x < p.left - p.slack || p.x > p.left + width + p.slack) return null;
  if (p.y < p.top - p.slack || p.y > p.top + height + p.below) return null;
  const col = Math.min(p.cols - 1, Math.max(0, Math.floor((p.x - p.left) / p.cellW)));
  const row = Math.min(p.rows - 1, Math.max(0, Math.floor((p.y - p.top) / p.cellH)));
  return Math.min(p.count - 1, row * p.cols + col);
}

/** What a released key types: the chosen variant if the popup was open (nothing if none chosen), else the key itself. */
export function releasedChar(p: { char: string; variants: readonly string[]; popupOpen: boolean; index: number | null }): string | null {
  if (!p.popupOpen) return p.char;
  return p.index === null ? null : (p.variants[p.index] ?? null);
}

/**
 * Which keyboard answers are typed with (Р31): the on-screen one on a touch device,
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

/** What the journal gets about a typed answer (Р31). */
export interface TypedInputInfo {
  keyboard: TypedKeyboard | null;
  pasted: boolean;
}
