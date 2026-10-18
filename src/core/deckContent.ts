/**
 * Content checks of a deck (Р28): the meaning and the hints seen before the answer
 * must lead to exactly one answer, and the entry must carry what the app needs to
 * check it. Warnings only (the deck is accepted); the deck author fixes them before
 * publishing. Language rules — articles, pronouns, gender endings — come from the
 * language pack (`DeckRules`); the interface-language rules are here.
 *
 * Type-only imports, or `.ts` imports: run directly by Node through deckFormat.ts.
 */
import type { DeckIssue, DeckRules } from './deckFormat';
import type { DeckTerm } from './glossaryTerms';
import { TG_DECK_TERMS } from './tgDeckTerms.ts';

const UI_LANGS = ['tg', 'ru', 'en'] as const;
const NOTE_FIELDS = ['meaning', 'hint', 'note'] as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const q = (s: string) => `«${s}»`;

interface Raw {
  i: number;
  text: string;
  /** Lower case, typographic apostrophes folded. */
  low: string;
  meaning: Obj;
  hint: Obj | null;
  form: Obj | null;
  skills: string[];
  tags: string[];
  audio: boolean;
}

function readEntries(entries: readonly unknown[]): Raw[] {
  return entries.flatMap((raw, i) => {
    if (!isObj(raw) || typeof raw.text !== 'string') return [];
    const text = raw.text.trim();
    return [
      {
        i,
        text,
        low: text.toLowerCase().replace(/[’ʼ]/g, "'"),
        meaning: isObj(raw.meaning) ? raw.meaning : {},
        hint: isObj(raw.hint) ? raw.hint : null,
        form: isObj(raw.form) ? raw.form : null,
        skills: Array.isArray(raw.skills) ? raw.skills.filter((s): s is string => typeof s === 'string') : [],
        tags: Array.isArray(raw.tags) ? raw.tags.filter((s): s is string => typeof s === 'string') : [],
        audio: typeof raw.audio === 'string' && raw.audio.length > 0,
      },
    ];
  });
}

/** The leading article and the rest of a text, or null. */
export function splitLeadingArticle(low: string, articles: readonly string[]): { article: string; rest: string } | null {
  for (const a of [...articles].sort((x, y) => y.length - x.length)) {
    if (a.endsWith("'") ? low.startsWith(a) : low.startsWith(a + ' ')) {
      return { article: a, rest: low.slice(a.length).trim() };
    }
  }
  return null;
}

/** Comparable meaning: case, spaces and closing punctuation do not count. */
function meaningKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[\s.!?…]+$/u, '').trim();
}

const stable = (v: unknown): string =>
  isObj(v) ? `{${Object.keys(v).sort().map((k) => `${k}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v ?? null);

/** Grammar written into a meaning or hint instead of `form` (Р28): «(м.)», «(f.)», «(мард)», «(зан)»… */
const GRAMMAR_MARK = /\((?:м|ж|ср|m|f|n|masc|fem|муз|муан|мард|зан)\.?(?:\s*р\.)?\)/iu;

function startsWithWord(text: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}])${esc}`, 'iu').test(text);
}

/** Every content warning of the deck (Р28). `rules` absent: only the interface-language checks. */
export function contentWarnings(entries: readonly unknown[], rules: DeckRules | undefined, terms: readonly DeckTerm[] = TG_DECK_TERMS): DeckIssue[] {
  const out: DeckIssue[] = [];
  const warn = (path: string, message: string) => out.push({ level: 'warning', path, message });
  const list = readEntries(entries);
  const n = (e: Raw) => `Запись ${e.i + 1} ${q(e.text)}`;

  // В1. The same meaning (in any interface language) and nothing before the answer to tell them apart.
  for (let b = 0; b < list.length; b++) {
    for (let a = 0; a < b; a++) {
      const x = list[a]!;
      const y = list[b]!;
      if (stable(x.form) !== stable(y.form) || stable(x.hint) !== stable(y.hint)) continue;
      const lang = UI_LANGS.find((l) => {
        const mx = x.meaning[l];
        const my = y.meaning[l];
        return typeof mx === 'string' && typeof my === 'string' && meaningKey(mx) !== '' && meaningKey(mx) === meaningKey(my);
      });
      if (!lang) continue;
      warn(
        `entries[${y.i}].meaning.${lang}`,
        `Записи ${x.i + 1} и ${y.i + 1} (${q(x.text)}, ${q(y.text)}): одинаковое значение (${lang}) ${q(String(x.meaning[lang]))}, ` +
          'а form и hint их не различают — у карточки два правильных ответа. Разведите значения или добавьте hint / form (Р28).',
      );
    }
  }

  for (const e of list) {
    // В8. Grammar marks in a meaning or hint.
    for (const field of ['meaning', 'hint'] as const) {
      const v = field === 'meaning' ? e.meaning : e.hint;
      if (!v) continue;
      for (const l of UI_LANGS) {
        const s = v[l];
        if (typeof s === 'string' && GRAMMAR_MARK.test(s)) {
          warn(`entries[${e.i}].${field}.${l}`, `${n(e)}: в ${field}.${l} ${q(s)} грамматика текстом — род и форму указывайте в form (Р28).`);
        }
      }
    }
    // Rejected Tajik words (docs/GLOSSARY_TG.md).
    for (const field of NOTE_FIELDS) {
      const v = field === 'meaning' ? e.meaning : field === 'hint' ? e.hint : null;
      const raw = field === 'note' ? (entries[e.i] as Obj).note : v;
      const tg = isObj(raw) && typeof raw.tg === 'string' ? raw.tg : null;
      if (!tg) continue;
      for (const t of terms) {
        if (startsWithWord(tg, t.word)) {
          warn(
            `entries[${e.i}].${field}.tg`,
            `Запись ${e.i + 1}: в ${field}.tg слово ${q(t.word)} (${q(tg)}) — по глоссарию: ${t.use}. Грамматику указывайте в form, не текстом.`,
          );
        }
      }
    }
    // В9. `listen` needs deck audio (Р25).
    if (e.skills.includes('listen') && !e.audio) {
      warn(`entries[${e.i}].skills`, `${n(e)}: есть listen, но нет audio — карточка listen не будет выдаваться (Р25).`);
    }
    // В10. tu / vous: the English meaning must say which (Р22, 16.10.2026).
    const en = e.meaning.en;
    if (rules && typeof en === 'string') {
      // Hyphenated words are read part by part (parlez-vous), except the listed nouns (rendez-vous).
      const words = (e.low.match(/\p{L}+(?:-\p{L}+)*'?/gu) ?? []).flatMap((w) => (rules.notAddress.includes(w) ? [] : w.split('-')));
      const informal = words.some((w) => rules.informal.includes(w));
      const formal = words.some((w) => rules.formal.includes(w));
      if (informal && !/\(informal\)/i.test(en)) {
        warn(`entries[${e.i}].meaning.en`, `${n(e)}: обращение на «ты» — в конце en-значения нужна пометка «(informal)».`);
      }
      if (formal && !/\(formal\)/i.test(en)) {
        warn(`entries[${e.i}].meaning.en`, `${n(e)}: обращение на «вы» — в конце en-значения нужна пометка «(formal)».`);
      }
    }
  }

  if (!rules) return out;

  for (const e of list) {
    const art = splitLeadingArticle(e.low, rules.articles);
    const determiner = e.form?.determiner;
    // В2. A word with an article and no form.determiner: «le livre» or «un livre»?
    if (e.tags.includes('word') && art && determiner === undefined) {
      warn(`entries[${e.i}].form`, `${n(e)}: слово с артиклем без form.determiner — неясно, какой артикль нужен в ответе (Р14, Р28).`);
    }
    if (determiner !== undefined) {
      // В4. Only `write` checks the gender (Р23 п. 4).
      if (!e.skills.includes('write')) {
        warn(`entries[${e.i}].skills`, `${n(e)}: существительное с артиклем без write — род нигде не проверяется (Р23 п. 4, Р28).`);
      }
      // В3. l' hides the gender: the indefinite pair is required.
      if (art && rules.genderlessArticles.includes(art.article)) {
        const pair = list.some((o) => {
          if (o === e || o.form?.determiner !== 'indefinite') return false;
          const oa = splitLeadingArticle(o.low, rules.articles);
          return !!oa && rules.indefiniteArticles.includes(oa.article) && oa.rest === art.rest;
        });
        if (!pair) {
          warn(
            `entries[${e.i}].text`,
            `${n(e)}: род по артиклю ${q(art.article)} не виден — нужна вторая запись с неопределённым артиклем ` +
              `(${rules.indefiniteArticles.join(' или ')} + ${q(art.rest)}) и с write (Р23 п. 4, Р28).`,
          );
        }
      }
    }
    const hasGender = e.form?.gender !== undefined;
    // В6. il / elle / ils / elles: the meaning languages often hide it (tg «ӯ», «онҳо»).
    const first = e.low.split(/[\s']/)[0] ?? '';
    if (rules.subjectPronouns.includes(first) && !rules.impersonal.some((p) => e.low.startsWith(p)) && !hasGender) {
      warn(`entries[${e.i}].form`, `${n(e)}: подлежащее ${q(first)} — нужен form.gender: в значении (например, tg «ӯ», «онҳо») род не виден (Р28).`);
    }
    // В7. A number with gender (un / une).
    const bare = e.low.replace(/[\s.!?…]+$/u, '');
    if (rules.genderedNumbers.includes(bare) && !hasGender) {
      warn(`entries[${e.i}].form`, `${n(e)}: число с родом — нужен form.gender (Р28).`);
    }
  }

  // В5. Two forms that differ only in the gender ending (ami / amie, ravi / ravie): both need form.gender.
  const base = (e: Raw) => splitLeadingArticle(e.low, rules.articles)?.rest ?? e.low;
  for (const x of list) {
    for (const y of list) {
      if (x === y) continue;
      const bx = base(x);
      const by = base(y);
      const paired = rules.genderEndings.some(([m, f]) => bx.endsWith(m) && by === bx.slice(0, bx.length - m.length) + f && bx !== by);
      if (!paired) continue;
      for (const e of [x, y]) {
        if (e.form?.gender === undefined) {
          const other = e === x ? y : x;
          warn(`entries[${e.i}].form`, `${n(e)}: есть форма другого рода (${q(other.text)}) — у обеих записей нужен form.gender (Р16, Р28).`);
        }
      }
    }
  }
  // A pair is seen from both sides: keep each warning once.
  return out.filter((w, k) => out.findIndex((o) => o.path === w.path && o.message === w.message) === k);
}
