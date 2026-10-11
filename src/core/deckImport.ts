/**
 * What a deck import changes (Р2, Р15, Р17.9). Pure: the caller reads the installed
 * deck, asks the user to confirm when needed and writes the plan in one transaction.
 *
 * - Entries are matched by id: present → content and position updated, shown again
 *   if they were hidden; missing from the new revision → hidden, content kept.
 * - The journal and the cards are never touched by an import.
 * - Same revision → "reinstall?"; older revision → warning; a deck with the same id
 *   but a mostly different set of entries (or another language) → warning.
 */
import type { Deck } from './deckFormat';
import { primaryLanguage } from './deckFormat';
import type { DeckRow, EntryRow } from './model';

export interface InstalledDeck {
  deck: DeckRow;
  /** All entry rows of the deck, hidden ones included. */
  entries: EntryRow[];
}

export type ImportConfirm =
  | { type: 'reinstall'; revision: number }
  | { type: 'older'; installed: number; incoming: number }
  | {
      type: 'different';
      installedName: string;
      /** Entry ids present in both. */
      shared: number;
      installedCount: number;
      incomingCount: number;
      installedLanguage: string;
      languageChanged: boolean;
    };

export interface ImportSummary {
  added: number;
  updated: number;
  /** Newly hidden: missing from the new revision. */
  hidden: number;
  /** Were hidden, back in the new revision. */
  restored: number;
}

export interface ImportPlan {
  kind: 'install' | 'update';
  deck: DeckRow;
  /** Every entry row of the deck after the import, hidden ones included. */
  entries: EntryRow[];
  summary: ImportSummary;
  /** Questions to ask before writing; empty = write right away. */
  confirm: ImportConfirm[];
}

/**
 * Below this share of common entry ids (of the smaller deck) a deck with the same id
 * is probably another deck that reused the id.
 */
export const MIN_SHARED_SHARE = 0.5;

export function planImport(
  deck: Deck,
  name: string,
  audioBytes: number,
  installed: InstalledDeck | null,
  now: Date,
): ImportPlan {
  const old = new Map((installed?.entries ?? []).map((e) => [e.entryId, e]));
  const summary: ImportSummary = { added: 0, updated: 0, hidden: 0, restored: 0 };

  const entries: EntryRow[] = deck.entries.map((e, position) => {
    const prev = old.get(e.id);
    if (!prev) summary.added++;
    else if (prev.hidden) summary.restored++;
    else summary.updated++;
    const row: EntryRow = {
      deckId: deck.id,
      entryId: e.id,
      position,
      hidden: 0,
      text: e.text,
      meaning: e.meaning,
      audio: e.audio ?? null,
      skills: e.skills,
    };
    if (e.ipa !== undefined) row.ipa = e.ipa;
    if (e.hint !== undefined) row.hint = e.hint;
    if (e.note !== undefined) row.note = e.note;
    if (e.gender !== undefined) row.gender = e.gender;
    if (e.form !== undefined) row.form = e.form;
    if (e.tags !== undefined) row.tags = e.tags;
    return row;
  });

  const incomingIds = new Set(deck.entries.map((e) => e.id));
  for (const prev of old.values()) {
    if (incomingIds.has(prev.entryId)) continue;
    if (!prev.hidden) summary.hidden++;
    entries.push({ ...prev, hidden: 1 });
  }

  const hiddenCount = entries.length - deck.entries.length;
  const row: DeckRow = {
    id: deck.id,
    name,
    language: deck.language,
    revision: deck.revision,
    formatVersion: deck.version,
    tags: deck.tags ?? {},
    entryCount: deck.entries.length,
    hiddenCount,
    audioBytes,
    importedAt: installed?.deck.importedAt ?? now,
    updatedAt: now,
  };

  const confirm: ImportConfirm[] = [];
  if (installed) {
    const was = installed.deck.revision;
    if (deck.revision === was) confirm.push({ type: 'reinstall', revision: was });
    else if (deck.revision < was) confirm.push({ type: 'older', installed: was, incoming: deck.revision });

    const shared = deck.entries.filter((e) => old.has(e.id)).length;
    const smaller = Math.min(old.size, deck.entries.length);
    const languageChanged = primaryLanguage(installed.deck.language) !== primaryLanguage(deck.language);
    if (languageChanged || (smaller > 0 && shared / smaller < MIN_SHARED_SHARE)) {
      confirm.push({
        type: 'different',
        installedName: installed.deck.name,
        shared,
        installedCount: old.size,
        incomingCount: deck.entries.length,
        installedLanguage: installed.deck.language,
        languageChanged,
      });
    }
  }

  return { kind: installed ? 'update' : 'install', deck: row, entries, summary, confirm };
}
