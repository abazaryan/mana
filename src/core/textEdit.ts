/**
 * Text edits of the custom phone keyboard (Р6): a key inserts at the caret, Backspace
 * deletes before it. Pure, so the keyboard can be tested without a browser. Positions
 * are UTF-16 offsets, as in `HTMLInputElement.selectionStart` / `selectionEnd`.
 */

export interface TextState {
  text: string;
  /** Selection start; equals `end` when there is only a caret. */
  start: number;
  end: number;
}

/** A selection inside the text, start ≤ end; out-of-range or reversed offsets are fixed. */
export function clampSelection(s: TextState): TextState {
  const n = s.text.length;
  const a = Math.min(Math.max(0, Math.trunc(s.start)), n);
  const b = Math.min(Math.max(0, Math.trunc(s.end)), n);
  return { text: s.text, start: Math.min(a, b), end: Math.max(a, b) };
}

/** The caret after the last character. */
export function caretAtEnd(text: string): TextState {
  return { text, start: text.length, end: text.length };
}

/** `chars` replace the selection (or go in at the caret); the caret goes after them. */
export function insertText(s: TextState, chars: string): TextState {
  const { text, start, end } = clampSelection(s);
  const caret = start + chars.length;
  return { text: text.slice(0, start) + chars + text.slice(end), start: caret, end: caret };
}

/**
 * Backspace: a selection is deleted; otherwise the character before the caret — a whole
 * grapheme, so `e` + a combining accent or a surrogate pair goes in one press.
 */
export function deleteBackward(s: TextState): TextState {
  const { text, start, end } = clampSelection(s);
  if (start !== end) return { text: text.slice(0, start) + text.slice(end), start, end: start };
  if (start === 0) return { text, start, end };
  const from = start - lastGraphemeLength(text.slice(0, start));
  return { text: text.slice(0, from) + text.slice(start), start: from, end: from };
}

function lastGraphemeLength(before: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    let last = '';
    for (const g of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(before)) last = g.segment;
    return last.length;
  }
  // No Segmenter: one code point.
  const cp = before.codePointAt(before.length - 2);
  return cp !== undefined && cp > 0xffff ? 2 : 1;
}

/**
 * Where the caret goes after the browser inserted text over `before`'s selection (a
 * paste): at the end of the inserted text. `afterLength` is the new text length.
 * Chrome on the owner's phone left it at the start (stage 5 lab, 20.10.2026).
 */
export function caretAfterInsert(before: TextState, afterLength: number): number {
  const { text, start, end } = clampSelection(before);
  const inserted = afterLength - (text.length - (end - start));
  return Math.min(Math.max(start, start + inserted), Math.max(0, afterLength));
}
