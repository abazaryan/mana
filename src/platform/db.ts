/**
 * IndexedDB schema (Dexie), described in docs/DATA_MODEL.md.
 * Changing indexes means a new `version(n)`; never edit version 1 in place.
 */
import Dexie, { type DexieOptions, type Table } from 'dexie';
import type { CardRow, DeckRow, EntryRow, LogRecord, MediaRow, MetaRow, SettingsRow } from '../core/model';

export const DB_NAME = 'mana';

export class ManaDb extends Dexie {
  meta!: Table<MetaRow, string>;
  settings!: Table<SettingsRow, string>;
  decks!: Table<DeckRow, string>;
  entries!: Table<EntryRow, [string, string]>;
  media!: Table<MediaRow, [string, string]>;
  log!: Table<LogRecord, string>;
  cards!: Table<CardRow, [string, string, string, string]>;

  constructor(name = DB_NAME, options?: DexieOptions) {
    super(name, options);
    this.version(1).stores({
      meta: 'key',
      settings: 'userId',
      decks: 'id',
      entries: '[deckId+entryId], deckId, [deckId+position]',
      media: '[deckId+path], deckId',
      log: 'id, [userId+at], [userId+deckId+entryId+skill+at], [userId+deckId+entryId+type]',
      cards: '[userId+deckId+entryId+skill], [userId+due], [userId+deckId]',
    });
  }
}

let shared: ManaDb | null = null;

/** The app's database (one per page). */
export function getDb(): ManaDb {
  shared ??= new ManaDb();
  return shared;
}
