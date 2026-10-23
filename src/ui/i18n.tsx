import { createContext, useContext, type ReactNode } from 'react';
import { translate, type Lang, type StringKey, type Vars } from './strings';

export interface I18n {
  lang: Lang;
  /** Language of meanings, hints and notes (R8). */
  meaningLang: Lang;
  t(key: StringKey, vars?: Vars): string;
}

const Ctx = createContext<I18n>({ lang: 'ru', meaningLang: 'ru', t: (k, v) => translate('ru', k, v) });

export function I18nProvider({ lang, meaningLang, children }: { lang: Lang; meaningLang: Lang; children: ReactNode }) {
  const value: I18n = { lang, meaningLang, t: (k, v) => translate(lang, k, v) };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  return useContext(Ctx);
}
