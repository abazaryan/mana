/**
 * Reads and writes of the IndexedDB data (docs/DATA_MODEL.md). Decisions are made by
 * pure code in src/core (planImport, rebuildCards, planRestore); this module runs
 * them inside transactions so a failure leaves the previous state whole.
 */
import Dexie from 'dexie';
import type { FSRS } from 'ts-fsrs';
import { parseBackup, planRestore, serializeBackup, type BackupError } from '../core/backup';
import { rebuildCards, stepCard } from '../core/cards';
import type { DeckArchive, DeckAudio } from '../core/deckArchive';
import { planImport, type ImportPlan, type InstalledDeck } from '../core/deckImport';
import type {
  CardRow,
  DeckRow,
  EntryRow,
  IntroRecord,
  LogRecord,
  MediaRow,
  MetaRow,
  ReviewRecord,
  SettingsRow,
} from '../core/model';
import type { SluhDb } from './db';

export type NewId = () => string;
export const randomId: NewId = () => crypto.randomUUID();

export interface Actor {
  userId: string;
  deviceId: string;
}

/** Only the two ids: callers often pass the whole MetaRow. */
function who(a: Actor): Actor {
  return { userId: a.userId, deviceId: a.deviceId };
}

/** The local user and device; created on first run, unchanged afterwards. */
export async function ensureDevice(db: SluhDb, now = new Date(), newId: NewId = randomId): Promise<MetaRow> {
  return db.transaction('rw', db.meta, async () => {
    const found = await db.meta.get('device');
    if (found) return found;
    const row: MetaRow = { key: 'device', userId: newId(), deviceId: newId(), createdAt: now };
    await db.meta.add(row);
    return row;
  });
}

export function getSettings(db: SluhDb, userId: string): Promise<SettingsRow | undefined> {
  return db.settings.get(userId);
}

export async function putSettings(db: SluhDb, row: SettingsRow): Promise<void> {
  await db.settings.put(row);
}

// ---------- Decks ----------

export async function listDecks(db: SluhDb): Promise<DeckRow[]> {
  const decks = await db.decks.toArray();
  return decks.sort((a, b) => a.name.localeCompare(b.name));
}

export function getDeck(db: SluhDb, deckId: string): Promise<DeckRow | undefined> {
  return db.decks.get(deckId);
}

/** Entries in deck order; hidden ones only if asked. */
export async function listEntries(db: SluhDb, deckId: string, includeHidden = false): Promise<EntryRow[]> {
  const rows = await db.entries
    .where('[deckId+position]')
    .between([deckId, Dexie.minKey], [deckId, Dexie.maxKey])
    .toArray();
  return includeHidden ? rows : rows.filter((r) => !r.hidden);
}

export function getMedia(db: SluhDb, deckId: string, path: string): Promise<MediaRow | undefined> {
  return db.media.get([deckId, path]);
}

async function loadInstalled(db: SluhDb, deckId: string): Promise<InstalledDeck | null> {
  const deck = await db.decks.get(deckId);
  if (!deck) return null;
  const entries = await db.entries.where('deckId').equals(deckId).toArray();
  return { deck, entries };
}

/** The import plan for a checked archive (no errors). Nothing is written. */
export async function prepareImport(db: SluhDb, archive: DeckArchive, now = new Date()): Promise<ImportPlan> {
  const deck = archive.check.deck;
  if (!deck) throw new Error('prepareImport: the archive has errors');
  const audioBytes = archive.audio.reduce((n, a) => n + a.data.byteLength, 0);
  return planImport(deck, archive.name, audioBytes, await loadInstalled(db, deck.id), now);
}

/** Writes an import plan in one transaction. The journal and the cards are not touched. */
export async function applyImport(db: SluhDb, plan: ImportPlan, audio: readonly DeckAudio[]): Promise<void> {
  const deckId = plan.deck.id;
  const media: MediaRow[] = audio.map((a) => ({
    deckId,
    path: a.path,
    type: a.type,
    data: a.data,
    bytes: a.data.byteLength,
  }));
  await db.transaction('rw', db.decks, db.entries, db.media, async () => {
    await db.entries.where('deckId').equals(deckId).delete();
    await db.entries.bulkPut(plan.entries);
    await db.media.where('deckId').equals(deckId).delete();
    await db.media.bulkPut(media);
    await db.decks.put(plan.deck);
  });
}

// ---------- Journal ----------

export type IntroInput = Pick<IntroRecord, 'at' | 'deckId' | 'entryId' | 'deckRevision' | 'sessionId'>;
export type ReviewInput = Omit<ReviewRecord, 'id' | 'type' | 'userId' | 'deviceId' | 'fsrs'>;

export async function recordIntro(
  db: SluhDb,
  actor: Actor,
  input: IntroInput,
  newId: NewId = randomId,
): Promise<IntroRecord> {
  const record: IntroRecord = { ...input, id: newId(), type: 'intro', skill: null, ...who(actor) };
  await db.log.add(record);
  return record;
}

/** Appends an answer and updates its card in one transaction. */
export async function recordReview(
  db: SluhDb,
  scheduler: FSRS,
  actor: Actor,
  input: ReviewInput,
  newId: NewId = randomId,
): Promise<{ record: ReviewRecord; card: CardRow }> {
  return db.transaction('rw', db.log, db.cards, async () => {
    const key: [string, string, string, string] = [actor.userId, input.deckId, input.entryId, input.skill];
    const prev = (await db.cards.get(key)) ?? null;
    const step = stepCard(scheduler, prev, input.final, input.at);
    const record: ReviewRecord = { ...input, id: newId(), type: 'review', ...who(actor), fsrs: step.fsrs };
    const card: CardRow = {
      ...step.card,
      userId: actor.userId,
      deckId: input.deckId,
      entryId: input.entryId,
      skill: input.skill,
      lastLogId: record.id,
    };
    await db.log.add(record);
    await db.cards.put(card);
    return { record, card };
  });
}

export async function userLog(db: SluhDb, userId: string): Promise<LogRecord[]> {
  return db.log
    .where('[userId+at]')
    .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
    .toArray();
}

async function replaceUserCards(db: SluhDb, scheduler: FSRS, userId: string): Promise<CardRow[]> {
  const cards = rebuildCards(scheduler, await userLog(db, userId), userId);
  await db.cards
    .where('[userId+deckId]')
    .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
    .delete();
  await db.cards.bulkPut(cards);
  return cards;
}

/** Throws away the stored cards of `userId` and rebuilds them from the journal. */
export async function rebuildUserCards(db: SluhDb, scheduler: FSRS, userId: string): Promise<CardRow[]> {
  return db.transaction('rw', db.log, db.cards, () => replaceUserCards(db, scheduler, userId));
}

// ---------- Backup ----------

export async function exportJournal(db: SluhDb, actor: Actor, now = new Date()): Promise<{ json: string; count: number }> {
  const records = await userLog(db, actor.userId);
  return { json: serializeBackup({ exportedAt: now, ...who(actor), records }), count: records.length };
}

export type RestoreResult =
  | { ok: true; added: number; skipped: number; userId: string }
  | { ok: false; error: BackupError | 'otherUser' };

/**
 * Adds the records of a backup file, skipping UUIDs already present, and rebuilds
 * the cards. An installation with an empty journal adopts the backup's user.
 */
export async function restoreJournal(db: SluhDb, scheduler: FSRS, text: string): Promise<RestoreResult> {
  const parsed = parseBackup(text);
  if (!parsed.ok) return parsed;
  const backup = parsed.backup;

  return db.transaction('rw', [db.meta, db.settings, db.log, db.cards], async (): Promise<RestoreResult> => {
    const meta = await db.meta.get('device');
    if (!meta) throw new Error('restoreJournal: no device row');
    const localHasRecords = (await userLog(db, meta.userId)).length > 0;
    const existingIds = new Set((await db.log.toCollection().primaryKeys()) as string[]);
    const plan = planRestore(backup, meta.userId, localHasRecords, existingIds);
    if (!plan.ok) return plan;

    let userId = meta.userId;
    if (plan.adoptUserId) {
      userId = plan.adoptUserId;
      await db.meta.put({ ...meta, userId });
      const settings = await db.settings.get(meta.userId);
      if (settings && !(await db.settings.get(userId))) {
        await db.settings.delete(meta.userId);
        await db.settings.put({ ...settings, userId });
      }
    }
    await db.log.bulkAdd(plan.add);
    await replaceUserCards(db, scheduler, userId);
    return { ok: true, added: plan.add.length, skipped: plan.skipped, userId };
  });
}
