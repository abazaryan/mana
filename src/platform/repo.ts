/**
 * Reads and writes of the IndexedDB data (docs/DATA_MODEL.md). Decisions are made by
 * pure code in src/core (planImport, rebuildCards, planRestore); this module runs
 * them inside transactions so a failure leaves the previous state whole.
 */
import Dexie from 'dexie';
import type { FSRS } from 'ts-fsrs';
import { parseBackup, planRestore, serializeBackup, type BackupError } from '../core/backup';
import { answerCard, rebuildCards } from '../core/cards';
import type { DeckArchive, DeckAudio } from '../core/deckArchive';
import type { Skill } from '../core/deckFormat';
import { crossDeckWarnings } from '../core/deckContent';
import { deckTitle, primaryLanguage, type UiLang } from '../core/deckFormat';
import { planImport, type ImportPlan, type InstalledDeck } from '../core/deckImport';
import type {
  DrillRecord,
  CardRow,
  DeckRow,
  EntryRow,
  IntroRecord,
  LogRecord,
  MediaRow,
  MetaRow,
  ReviewRecord,
  SettingsRow,
  VoiceCheck,
} from '../core/model';
import { RULES_VERSION } from '../core/scheduler';
import type { ManaDb } from './db';

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
export async function ensureDevice(db: ManaDb, now = new Date(), newId: NewId = randomId): Promise<MetaRow> {
  return db.transaction('rw', db.meta, async () => {
    const found = await db.meta.get('device');
    if (found) return found;
    const row: MetaRow = { key: 'device', userId: newId(), deviceId: newId(), createdAt: now };
    await db.meta.add(row);
    return row;
  });
}

/** Remember (or forget) that this browser rejects recognizer hints. */
export async function setPhrasesUnsupported(db: ManaDb, value: boolean): Promise<MetaRow> {
  return db.transaction('rw', db.meta, async () => {
    const row = await db.meta.get('device');
    if (!row) throw new Error('setPhrasesUnsupported: no device row');
    const next: MetaRow = { ...row, phrasesUnsupported: value };
    await db.meta.put(next);
    return next;
  });
}

/** Type answers on the device's own keyboard instead of the on-screen one (Р31, device-only). */
export async function setSystemKeyboard(db: ManaDb, value: boolean): Promise<MetaRow> {
  return db.transaction('rw', db.meta, async () => {
    const row = await db.meta.get('device');
    if (!row) throw new Error('setSystemKeyboard: no device row');
    const next: MetaRow = { ...row, systemKeyboard: value };
    await db.meta.put(next);
    return next;
  });
}

/** Remember the answer of the "Voice check" for a learning language (Р33 п. 14, device-only). */
export async function setVoiceCheck(db: ManaDb, language: string, value: VoiceCheck): Promise<MetaRow> {
  return db.transaction('rw', db.meta, async () => {
    const row = await db.meta.get('device');
    if (!row) throw new Error('setVoiceCheck: no device row');
    const next: MetaRow = { ...row, voiceChecks: { ...row.voiceChecks, [primaryLanguage(language)]: value } };
    await db.meta.put(next);
    return next;
  });
}

/** Deck ids whose learning language has the browser voice checked "yes" on this device. */
export function voiceDecks(decks: readonly DeckRow[], meta: MetaRow): Set<string> {
  return new Set(decks.filter((d) => meta.voiceChecks?.[primaryLanguage(d.language)] === 'yes').map((d) => d.id));
}

/** Texts of every visible entry of the installed decks in a learning language (hint vocabulary). */
export async function entryTextsForLanguage(db: ManaDb, language: string): Promise<string[]> {
  const primary = (tag: string) => tag.split('-')[0]!.toLowerCase();
  const decks = (await db.decks.toArray()).filter((d) => primary(d.language) === primary(language));
  const texts: string[] = [];
  for (const d of decks.sort((a, b) => a.name.localeCompare(b.name))) {
    for (const e of await listEntries(db, d.id)) texts.push(e.text);
  }
  return texts;
}

export function getSettings(db: ManaDb, userId: string): Promise<SettingsRow | undefined> {
  return db.settings.get(userId);
}

export async function putSettings(db: ManaDb, row: SettingsRow): Promise<void> {
  await db.settings.put(row);
}

// ---------- Decks ----------

export async function listDecks(db: ManaDb): Promise<DeckRow[]> {
  const decks = await db.decks.toArray();
  return decks.sort((a, b) => a.name.localeCompare(b.name));
}

export function getDeck(db: ManaDb, deckId: string): Promise<DeckRow | undefined> {
  return db.decks.get(deckId);
}

/** Entries in deck order; hidden ones only if asked. */
export async function listEntries(db: ManaDb, deckId: string, includeHidden = false): Promise<EntryRow[]> {
  const rows = await db.entries
    .where('[deckId+position]')
    .between([deckId, Dexie.minKey], [deckId, Dexie.maxKey])
    .toArray();
  return includeHidden ? rows : rows.filter((r) => !r.hidden);
}

export function getMedia(db: ManaDb, deckId: string, path: string): Promise<MediaRow | undefined> {
  return db.media.get([deckId, path]);
}

async function loadInstalled(db: ManaDb, deckId: string): Promise<InstalledDeck | null> {
  const deck = await db.decks.get(deckId);
  if (!deck) return null;
  const entries = await db.entries.where('deckId').equals(deckId).toArray();
  return { deck, entries };
}

/**
 * The import plan for a checked archive (no errors). Nothing is written. Adds the
 * checks against the other installed decks of the same learning language (Р28 п. 8):
 * their visible entries, the deck itself left out (a new revision is no repeat).
 */
export async function prepareImport(db: ManaDb, archive: DeckArchive, now = new Date(), uiLang: UiLang = 'ru'): Promise<ImportPlan> {
  const deck = archive.check.deck;
  if (!deck) throw new Error('prepareImport: the archive has errors');
  const audioBytes = archive.audio.reduce((n, a) => n + a.data.byteLength, 0);
  const plan = planImport(deck, archive.name, audioBytes, await loadInstalled(db, deck.id), now);
  const lang = primaryLanguage(deck.language);
  const others = [];
  for (const d of await listDecks(db)) {
    if (d.id === deck.id || primaryLanguage(d.language) !== lang) continue;
    others.push({ name: deckTitle(d, uiLang), entries: await listEntries(db, d.id) });
  }
  return { ...plan, crossDeck: crossDeckWarnings(deck.entries, others) };
}

/** Writes an import plan in one transaction. The journal and the cards are not touched. */
export async function applyImport(db: ManaDb, plan: ImportPlan, audio: readonly DeckAudio[]): Promise<void> {
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

export type IntroInput = Pick<IntroRecord, 'at' | 'deckId' | 'entryId' | 'deckRevision' | 'sessionId'> &
  Partial<Pick<IntroRecord, 'echo' | 'copy' | 'tz' | 'tzOffsetMin' | 'audioSource' | 'voice'>>;
export type ReviewInput = Omit<ReviewRecord, 'id' | 'type' | 'userId' | 'deviceId' | 'fsrs' | 'rules'>;

export async function recordIntro(
  db: ManaDb,
  actor: Actor,
  input: IntroInput,
  newId: NewId = randomId,
): Promise<IntroRecord> {
  const record: IntroRecord = { ...input, id: newId(), type: 'intro', skill: null, ...who(actor) };
  await db.log.add(record);
  return record;
}

export type DrillInput = Omit<DrillRecord, 'id' | 'type' | 'userId' | 'deviceId'>;

/** Appends the short practice after Again (Р25); never touches the card. */
export async function recordDrill(db: ManaDb, actor: Actor, input: DrillInput, newId: NewId = randomId): Promise<DrillRecord> {
  const record: DrillRecord = { ...input, id: newId(), type: 'drill', ...who(actor) };
  await db.log.add(record);
  return record;
}

/**
 * Appends an answer and updates its card in one transaction. A return after Again
 * (Р29.2) is journaled, and the card stays as the first Again left it.
 */
export async function recordReview(
  db: ManaDb,
  scheduler: FSRS,
  actor: Actor,
  input: ReviewInput,
  newId: NewId = randomId,
): Promise<{ record: ReviewRecord; card: CardRow }> {
  return db.transaction('rw', db.log, db.cards, async () => {
    const key: [string, string, string, string] = [actor.userId, input.deckId, input.entryId, input.skill];
    const prev = (await db.cards.get(key)) ?? null;
    const step = answerCard(scheduler, prev, input);
    const record: ReviewRecord = { ...input, id: newId(), type: 'review', ...who(actor), rules: RULES_VERSION, fsrs: step.fsrs };
    if (!step.changed && prev) {
      await db.log.add(record);
      return { record, card: prev };
    }
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

export async function userLog(db: ManaDb, userId: string): Promise<LogRecord[]> {
  return db.log
    .where('[userId+at]')
    .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
    .toArray();
}

/**
 * The last answer on one card (entry × skill); null if none. `skipReturns`: leave out
 * returns after Again — the Easy rule looks past them (Р29.2); the seconds since the
 * previous answer (`sincePairSec`) do not.
 */
export async function lastReview(
  db: ManaDb,
  userId: string,
  deckId: string,
  entryId: string,
  skill: Skill,
  skipReturns = false,
): Promise<ReviewRecord | null> {
  // Drills after Again share the index (they have a skill); they are no answers (Р25).
  const last = await db.log
    .where('[userId+deckId+entryId+skill+at]')
    .between([userId, deckId, entryId, skill, Dexie.minKey], [userId, deckId, entryId, skill, Dexie.maxKey])
    .reverse()
    .filter((r) => r.type === 'review' && !(skipReturns && (r.requeue ?? 0) > 0))
    .first();
  return last && last.type === 'review' ? last : null;
}

export interface SessionData {
  /** Entries of every installed deck, hidden ones included. */
  entries: EntryRow[];
  /** The user's cards in every deck: debts and the outlook count all decks (Р29.5, Р29.6). */
  cards: CardRow[];
  log: LogRecord[];
  decks: DeckRow[];
  /** Decks whose language has the browser voice checked on this device: `listen` without a file (Р33 п. 14). */
  voiceDecks: Set<string>;
}

/** What buildSession and the outlook need: every deck, since debts and the daily limits span them all. */
export async function loadSessionData(db: ManaDb, userId: string): Promise<SessionData> {
  const [entries, cards, log, decks, meta] = await Promise.all([
    db.entries.toArray(),
    db.cards.where('[userId+deckId]').between([userId, Dexie.minKey], [userId, Dexie.maxKey]).toArray(),
    userLog(db, userId),
    db.decks.toArray(),
    db.meta.get('device'),
  ]);
  return { entries, cards, log, decks, voiceDecks: meta ? voiceDecks(decks, meta) : new Set() };
}

async function replaceUserCards(db: ManaDb, scheduler: FSRS, userId: string): Promise<CardRow[]> {
  const cards = rebuildCards(scheduler, await userLog(db, userId), userId);
  await db.cards
    .where('[userId+deckId]')
    .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
    .delete();
  await db.cards.bulkPut(cards);
  return cards;
}

/** Throws away the stored cards of `userId` and rebuilds them from the journal. */
export async function rebuildUserCards(db: ManaDb, scheduler: FSRS, userId: string): Promise<CardRow[]> {
  return db.transaction('rw', db.log, db.cards, () => replaceUserCards(db, scheduler, userId));
}

// ---------- New scheduling rules (Р29.7) ----------

/**
 * The stored cards were built with older rules and the user has answers: the app
 * saves the journal and rebuilds the cards before any study. Without answers there
 * is nothing to rebuild, and the new version is simply remembered.
 */
export async function needsRulesUpdate(db: ManaDb, meta: MetaRow): Promise<boolean> {
  if ((meta.rulesVersion ?? 0) >= RULES_VERSION) return false;
  const any = await db.log
    .where('[userId+at]')
    .between([meta.userId, Dexie.minKey], [meta.userId, Dexie.maxKey])
    .filter((r) => r.type === 'review')
    .first();
  if (any) return true;
  await db.transaction('rw', db.meta, () => markRules(db));
  return false;
}

async function markRules(db: ManaDb): Promise<MetaRow> {
  const row = await db.meta.get('device');
  if (!row) throw new Error('markRules: no device row');
  const next: MetaRow = { ...row, rulesVersion: RULES_VERSION };
  await db.meta.put(next);
  return next;
}

/** Rebuilds the cards of the user with the current rules and remembers it. The journal is not touched. */
export async function applyRulesUpdate(db: ManaDb, scheduler: FSRS, userId: string): Promise<MetaRow> {
  return db.transaction('rw', db.meta, db.log, db.cards, async () => {
    await replaceUserCards(db, scheduler, userId);
    return markRules(db);
  });
}

// ---------- Backup ----------

export async function exportJournal(db: ManaDb, actor: Actor, now = new Date()): Promise<{ json: string; count: number }> {
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
export async function restoreJournal(db: ManaDb, scheduler: FSRS, text: string): Promise<RestoreResult> {
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
