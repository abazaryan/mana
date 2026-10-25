/**
 * What the screen reader says for a key of the on-screen keyboard (R31 item 9, R41).
 */
import { keyVariants, shiftChar } from '../core/keyboard';
import type { KeyboardLayout } from '../core/languages';
import { translate, type Lang, type StringKey } from './strings';

/**
 * Characters whose name the screen reader gets instead of the glyph. By the character,
 * not the language pack: a comma is a comma in any learning language.
 */
export const NAMED: Readonly<Record<string, StringKey>> = { "'": 'kb.apostrophe', '-': 'kb.hyphen', ',': 'kb.comma', '.': 'kb.period' };

/**
 * A character key: its name or glyph, then "hold for …" if it has variants. Variants
 * are glyphs; a named one is said by its name, lower case, followed by a comma (R41).
 */
export function charKeyLabel(layout: KeyboardLayout, ch: string, shift: boolean, lang: Lang): string {
  const named = NAMED[ch];
  const name = named ? translate(lang, named) : shiftChar(ch, shift);
  const vs = keyVariants(layout, ch, shift);
  if (vs.length === 0) return name;
  const list = vs
    .map((v, i) => {
      const key = NAMED[v];
      const item = key ? lowerFirst(translate(lang, key), lang) : v;
      return i === vs.length - 1 ? item : item + (key ? ', ' : ' ');
    })
    .join('');
  return `${name}, ${translate(lang, 'kb.hold', { list })}`;
}

function lowerFirst(s: string, lang: Lang): string {
  return s.charAt(0).toLocaleLowerCase(lang) + s.slice(1);
}
