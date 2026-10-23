/**
 * Texts the user copies into a chat with an AI (R33 item 15): the check report of a deck,
 * so the AI fixes every error and warning, and the entries of the installed decks, so a
 * new deck does not repeat them (K1/K2, R28 item 10). The report is in Russian, like the
 * validator messages; the installed list follows the language of the AI rules (R34).
 */
import type { DeckIssue, EntryForm, Localized } from './deckFormat';
import { M } from './deckMessages.ts';

export interface ReportInput {
  /** Deck id and revision, when deck.json was readable. */
  deckId: string | null;
  revision: number | null;
  errors: readonly DeckIssue[];
  /** Warnings of the validator and the checks against installed decks. */
  warnings: readonly DeckIssue[];
  notes: readonly DeckIssue[];
}

function section(title: string, items: readonly DeckIssue[]): string[] {
  if (items.length === 0) return [];
  return ['', title, ...items.map((i, k) => `${k + 1}. ${i.path ? `[${i.path}] ` : ''}${i.message}`)];
}

export function reportForAi(r: ReportInput): string {
  const what = !r.deckId ? M.whatDeck : r.revision === null ? M.whatDeckId(r.deckId) : M.whatDeckIdRevision(r.deckId, r.revision);
  const lines = [
    M.reportHeader(what, r.errors.length, r.warnings.length, r.notes.length),
    ...section(M.sectionErrors, r.errors),
    ...section(M.sectionWarnings, r.warnings),
    ...section(M.sectionNotes, r.notes),
    '',
    r.errors.length + r.warnings.length > 0
      ? M.fixInstructions
      : M.noIssues,
  ];
  return lines.join('\n');
}

export interface InstalledForAi {
  id: string;
  title: string;
  language: string;
  entries: readonly { text: string; meaning: Localized; hint?: Localized; form?: EntryForm; hidden?: 0 | 1 }[];
}

const LANGS = ['tg', 'ru', 'en'] as const;

function localized(v: Localized | undefined): string {
  return LANGS.flatMap((l) => (v?.[l] ? [`${l}: ${v[l]}`] : [])).join('; ');
}

function form(f: EntryForm | undefined): string {
  const parts = [f?.determiner, f?.gender, f?.number].filter(Boolean);
  return parts.length > 0 ? ` [form: ${parts.join(', ')}]` : '';
}

const INSTALLED = {
  ru: {
    head:
      M.installedHeading,
    none: M.installedNone,
  },
  en: {
    head:
      "THE LEARNER'S INSTALLED DECKS. Do not repeat these entries (the same text with the same form). " +
      'A new entry must not have the meaning of an entry here with another answer, unless form or hint tells them apart. ' +
      'The id of the new deck must differ from these ids.',
    none: 'No decks installed.',
  },
};

/** Visible entries of the installed decks as "text — meaning [form] (hint)", under the deck title and id. */
export function installedForAi(decks: readonly InstalledForAi[], lang: 'ru' | 'en' = 'ru'): string {
  const words = INSTALLED[lang];
  const lines = [words.head];
  for (const d of decks) {
    const visible = d.entries.filter((e) => !e.hidden);
    if (visible.length === 0) continue;
    lines.push('', `«${d.title}» (id ${d.id}, ${d.language}):`);
    for (const e of visible) {
      const hint = localized(e.hint);
      lines.push(`- ${e.text} — ${localized(e.meaning)}${form(e.form)}${hint ? ` (hint: ${hint})` : ''}`);
    }
  }
  if (lines.length === 1) lines.push('', words.none);
  return lines.join('\n');
}
