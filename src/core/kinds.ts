/**
 * Small enumerations shared by the app, the scripts and the Worker (stage 6a.3). No imports:
 * the Worker bundles this file without the deck checks around it.
 */

export const SKILLS = ['listen', 'speak', 'write'] as const;
export type Skill = (typeof SKILLS)[number];

/** Interface languages; meanings, hints, notes and tag names are given in them. */
export const UI_LANGS = ['tg', 'ru', 'en'] as const;
export type UiLang = (typeof UI_LANGS)[number];
