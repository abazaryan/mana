import { describe, expect, it } from 'vitest';
import { caretAtEnd, clampSelection, deleteBackward, insertText, type TextState } from './textEdit';

const at = (text: string, start: number, end = start): TextState => ({ text, start, end });

describe('insertText', () => {
  it('goes in at the caret, the caret after it', () => {
    expect(insertText(at('le nm', 4), 'o')).toEqual(at('le nom', 5));
  });
  it('at the start and at the end', () => {
    expect(insertText(at('cole', 0), 'é')).toEqual(at('école', 1));
    expect(insertText(caretAtEnd('aujourd'), "'")).toEqual(at("aujourd'", 8));
  });
  it('into an empty field', () => {
    expect(insertText(caretAtEnd(''), 'ç')).toEqual(at('ç', 1));
  });
  it('replaces the selection', () => {
    expect(insertText(at('la nom', 0, 2), 'le')).toEqual(at('le nom', 2));
  });
  it('a reversed or out-of-range selection is fixed first', () => {
    expect(insertText(at('abc', 3, 1), 'X')).toEqual(at('aX', 2));
    expect(insertText(at('abc', 99), 'd')).toEqual(at('abcd', 4));
    expect(insertText(at('abc', -5), 'z')).toEqual(at('zabc', 1));
  });
  it('several characters at once (a pasted word)', () => {
    expect(insertText(at('le ', 3), 'nom')).toEqual(at('le nom', 6));
  });
});

describe('deleteBackward', () => {
  it('deletes the character before the caret', () => {
    expect(deleteBackward(at('le nom', 6))).toEqual(at('le no', 5));
    expect(deleteBackward(at('le nom', 3))).toEqual(at('lenom', 2));
  });
  it('does nothing at the start', () => {
    expect(deleteBackward(at('nom', 0))).toEqual(at('nom', 0));
    expect(deleteBackward(caretAtEnd(''))).toEqual(at('', 0));
  });
  it('deletes a selection, not the character before it', () => {
    expect(deleteBackward(at('le nom', 3, 6))).toEqual(at('le ', 3));
  });
  it('a precomposed accent is one character', () => {
    expect(deleteBackward(caretAtEnd('été'))).toEqual(at('ét', 2));
  });
  it('e + a combining accent goes in one press', () => {
    const decomposed = 'café';
    expect(deleteBackward(caretAtEnd(decomposed))).toEqual(at('caf', 3));
  });
  it('a surrogate pair goes in one press', () => {
    expect(deleteBackward(caretAtEnd('ok😀'))).toEqual(at('ok', 2));
  });
  it('œ and the apostrophe', () => {
    expect(deleteBackward(caretAtEnd('cœ'))).toEqual(at('c', 1));
    expect(deleteBackward(caretAtEnd("l'"))).toEqual(at('l', 1));
  });
});

describe('clampSelection', () => {
  it('keeps a valid selection', () => {
    expect(clampSelection(at('abc', 1, 2))).toEqual(at('abc', 1, 2));
  });
  it('rounds fractional offsets down', () => {
    expect(clampSelection(at('abc', 1.7))).toEqual(at('abc', 1));
  });
});
