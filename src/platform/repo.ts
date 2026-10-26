/**
 * Reads and writes of the IndexedDB data (docs/DATA_MODEL.md). Decisions are made by
 * pure code in src/core (planImport, rebuildCards, planRestore); this module runs
 * them inside transactions so a failure leaves the previous state whole.
 */
import Dexie from 'dexie';
import type { FSRS } from 'ts-fsrs';
import { parseBackup, planAccountRestore, planRestore, serializeBackup, type BackupError, type JournalBackup } from '../core/backup';
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
  OutboxRow,
  ReviewRecord,
  SettingsRow,
  VoiceCheck,
} from '../core/model';
import { createScheduler, RULES_VERSION } from '../core/scheduler';
import type { ManaDb } from './db';
import { notifyQueued } from './syncEvents';

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

/** Type answers on the device's own keyboard instead of the on-screen one (R31, device-only). */
export async function setSystemKeyboard(db: ManaDb, value: boolean): Promise<MetaRow> {
  return db.transaction('rw', db.meta, async () => {
    const row = await db.meta.get('device');
    if (!row) throw new Error('setSystemKeyboard: no device row');
    const next: MetaRow = { ...row, systemKeyboard: value };
    await db.meta.put(next);
    return next;
  });
}

/** Remember the answer of the "Voice check" for a learning language (R33 item 14, device-only). */
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
 * checks against the other installed decks of the same learning language (R28 item 8):
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

/**
 * Writes an import plan in one transaction. The journal is not touched. A deck
 * installed anew (first time, or again after `deleteDeck`) gets its cards rebuilt
 * from the journal, so its progress comes back (R34); an update keeps the cards.
 */
export async function applyImport(
  db: ManaDb,
  plan: ImportPlan,
  audio: readonly DeckAudio[],
  scheduler: FSRS = createScheduler(),
): Promise<void> {
  const deckId = plan.deck.id;
  const media: MediaRow[] = audio.map((a) => ({
    deckId,
    path: a.path,
    type: a.type,
    data: a.data,
    bytes: a.data.byteLength,
  }));
  await db.transaction('rw', [db.decks, db.entries, db.media, db.log, db.cards], async () => {
    await db.entries.where('deckId').equals(deckId).delete();
    await db.entries.bulkPut(plan.entries);
    await db.media.where('deckId').equals(deckId).delete();
    await db.media.bulkPut(media);
    await db.decks.put(plan.deck);
    if (plan.kind === 'install') await rebuildDeckCards(db, scheduler, deckId);
  });
}

/** The cards of one deck, for every user, rebuilt from the journal. */
async function rebuildDeckCards(db: ManaDb, scheduler: FSRS, deckId: string): Promise<void> {
  const log = await db.log.filter((r) => r.deckId === deckId).toArray();
  await db.cards.filter((c) => c.deckId === deckId).delete();
  for (const userId of new Set(log.map((r) => r.userId))) await db.cards.bulkPut(rebuildCards(scheduler, log, userId));
}

/**
 * Deletes a deck from this device (R34): the deck, its entries (hidden ones too), its
 * audio and its cards. The journal stays (R10): installing the deck again rebuilds the
 * cards from it, and entries already introduced are not introduced again.
 */
export async function deleteDeck(db: ManaDb, deckId: string): Promise<void> {
  await db.transaction('rw', [db.decks, db.entries, db.media, db.cards], async () => {
    await db.entries.where('deckId').equals(deckId).delete();
    await db.media.where('deckId').equals(deckId).delete();
    await db.cards.filter((c) => c.deckId === deckId).delete();
    await db.decks.delete(deckId);
  });
}

// ---------- Journal ----------

export type IntroInput = Pick<IntroRecord, 'at' | 'deckId' | 'entryId' | 'deckRevision' | 'sessionId'> &
  Partial<Pick<IntroRecord, 'echo' | 'copy' | 'tz' | 'tzOffsetMin' | 'audioSource' | 'voice'>>;
export type ReviewInput = Omit<ReviewRecord, 'id' | 'type' | 'userId' | 'deviceId' | 'fsrs' | 'rules'>;

/**
 * A new record of this device goes into the send queue in the same transaction — only while the
 * device is signed in and the record is the account's (stage 6a.3). Read here, not from memory:
 * another window may have signed in or out.
 */
async function enqueue(db: ManaDb, record: LogRecord): Promise<boolean> {
  const meta = await db.meta.get('device');
  if (!meta?.account || meta.account.userId !== record.userId) return false;
  await db.outbox.add({ id: record.id, status: 'pending', queuedAt: record.at.getTime() });
  return true;
}

/** Appends a record of this device (and queues it for the server). */
/**
 * The writer's user as the database knows it now (inside the caller's transaction): an actor of
 * another window that still holds an earlier id from before a transfer writes as the account
 * (R40) — its record must not stay under the earlier id, outside the queue.
 */
async function currentUser(db: ManaDb, actor: Actor): Promise<string> {
  const meta = await db.meta.get('device');
  return meta && meta.userId !== actor.userId && meta.formerUserIds?.includes(actor.userId) ? meta.userId : actor.userId;
}

/** Appends a record of this device (and queues it for the server); returns it as stored. */
async function appendRecord<T extends LogRecord>(db: ManaDb, record: T): Promise<T> {
  const out = await db.transaction('rw', [db.log, db.meta, db.outbox], async () => {
    const stored: T = { ...record, userId: await currentUser(db, record) };
    await db.log.add(stored);
    return { stored, queued: await enqueue(db, stored) };
  });
  if (out.queued) notifyQueued();
  return out.stored;
}

export async function recordIntro(
  db: ManaDb,
  actor: Actor,
  input: IntroInput,
  newId: NewId = randomId,
): Promise<IntroRecord> {
  return appendRecord(db, { ...input, id: newId(), type: 'intro', skill: null, ...who(actor) } satisfies IntroRecord);
}

export type DrillInput = Omit<DrillRecord, 'id' | 'type' | 'userId' | 'deviceId'>;

/** Appends the short practice after Again (R25); never touches the card. */
export async function recordDrill(db: ManaDb, actor: Actor, input: DrillInput, newId: NewId = randomId): Promise<DrillRecord> {
  return appendRecord(db, { ...input, id: newId(), type: 'drill', ...who(actor) } satisfies DrillRecord);
}

/**
 * Appends an answer and updates its card in one transaction (and queues it for the server). A
 * return after Again (R29.2) is journaled, and the card stays as the first Again left it.
 *
 * The card is read inside the transaction, so a rebuild after records came from the server is
 * the base. If that card already holds a later answer (the other device's clock was ahead), a
 * step on top would differ from the journal order: the card is rebuilt from its history then.
 */
export async function recordReview(
  db: ManaDb,
  scheduler: FSRS,
  actor: Actor,
  input: ReviewInput,
  newId: NewId = randomId,
): Promise<{ record: ReviewRecord; card: CardRow }> {
  const out = await db.transaction('rw', [db.log, db.cards, db.meta, db.outbox], async () => {
    const userId = await currentUser(db, actor);
    const key: [string, string, string, string] = [userId, input.deckId, input.entryId, input.skill];
    const prev = (await db.cards.get(key)) ?? null;
    const late = prev?.lastReview != null && prev.lastReview.getTime() >= input.at.getTime();
    // Late: the snapshot is taken from the card as its answers before this one left it.
    const step = answerCard(scheduler, late ? await cardBefore(db, scheduler, key, input.at) : prev, input);
    const record: ReviewRecord = { ...input, id: newId(), type: 'review', userId, deviceId: actor.deviceId, rules: RULES_VERSION, fsrs: step.fsrs };
    await db.log.add(record);
    const queued = await enqueue(db, record);
    if (late) {
      const [card] = await rebuildCardKeys(db, scheduler, userId, [key]);
      return { record, card: card ?? prev!, queued };
    }
    if (!step.changed && prev) return { record, card: prev, queued };
    const card: CardRow = {
      ...step.card,
      userId,
      deckId: input.deckId,
      entryId: input.entryId,
      skill: input.skill,
      lastLogId: record.id,
    };
    await db.cards.put(card);
    return { record, card, queued };
  });
  if (out.queued) notifyQueued();
  return { record: out.record, card: out.card };
}

async function cardHistory(db: ManaDb, [userId, deckId, entryId, skill]: readonly [string, string, string, string]): Promise<LogRecord[]> {
  return db.log
    .where('[userId+deckId+entryId+skill+at]')
    .between([userId, deckId, entryId, skill, Dexie.minKey], [userId, deckId, entryId, skill, Dexie.maxKey])
    .toArray();
}

/** One card as the answers before `at` left it (null — none). */
async function cardBefore(db: ManaDb, scheduler: FSRS, key: readonly [string, string, string, string], at: Date): Promise<CardRow | null> {
  const earlier = (await cardHistory(db, key)).filter((r) => r.at.getTime() < at.getTime());
  return rebuildCards(scheduler, earlier, key[0])[0] ?? null;
}

/**
 * The cards of the given keys (user, deck, entry, skill) rebuilt from their whole history — inside
 * the caller's transaction (log and cards). A card is a function of its own answers only.
 */
export async function rebuildCardKeys(
  db: ManaDb,
  scheduler: FSRS,
  userId: string,
  keys: readonly (readonly [string, string, string, string])[],
): Promise<CardRow[]> {
  const out: CardRow[] = [];
  for (const [, deckId, entryId, skill] of keys) {
    const [card] = rebuildCards(scheduler, await cardHistory(db, [userId, deckId, entryId, skill]), userId);
    if (card) {
      await db.cards.put(card);
      out.push(card);
    } else {
      await db.cards.delete([userId, deckId, entryId, skill]);
    }
  }
  return out;
}

export async function userLog(db: ManaDb, userId: string): Promise<LogRecord[]> {
  return db.log
    .where('[userId+at]')
    .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
    .toArray();
}

/**
 * The last answer on one card (entry × skill); null if none. `skipReturns`: leave out
 * returns after Again — the Easy rule looks past them (R29.2); the seconds since the
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
  // Drills after Again share the index (they have a skill); they are no answers (R25).
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
  /** The user's cards in every deck: debts and the outlook count all decks (R29.5, R29.6). */
  cards: CardRow[];
  log: LogRecord[];
  decks: DeckRow[];
  /** Decks whose language has the browser voice checked on this device: `listen` without a file (R33 item 14). */
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

// ---------- New scheduling rules (R29.7) ----------

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

// ---------- Account (stage 6a.2, R37) ----------

/**
 * Any record in the journal of this installation, of any user. Until stage 6a.4 (transfer of
 * answers) such a device is refused sign-in; its data is not touched.
 */
export async function hasLocalAnswers(db: ManaDb): Promise<boolean> {
  return (await db.log.count()) > 0;
}

/**
 * A new device id for this installation — while the journal is empty, or on a transfer of answers
 * (`withAnswers`, R40): the records keep the old id, which has no meaning on the server beyond
 * "which device". Used when the server says the id belongs to another account (409 device_taken).
 */
export async function renewDeviceId(db: ManaDb, newId: NewId = randomId, withAnswers = false): Promise<MetaRow> {
  return db.transaction('rw', db.meta, db.log, async () => {
    if (!withAnswers && (await db.log.count()) > 0) throw new Error('renewDeviceId: the journal is not empty');
    const row = await db.meta.get('device');
    if (!row) throw new Error('renewDeviceId: no device row');
    const next: MetaRow = { ...row, deviceId: newId() };
    await db.meta.put(next);
    return next;
  });
}

/**
 * After sign-in: the account's id becomes the local user (STAGE6_RESEARCH 5.9 item 2, like a
 * restore adopts a backup's user) and the settings move with it; the account mark is kept.
 * Only on a device without answers — checked before signing in, and here again.
 */
export async function markSignedIn(db: ManaDb, userId: string, deviceName: string, now = new Date(), formerUserIds: readonly string[] = []): Promise<MetaRow> {
  return db.transaction('rw', [db.meta, db.settings, db.log], async () => {
    if ((await db.log.count()) > 0) throw new Error('markSignedIn: the journal is not empty');
    const meta = await db.meta.get('device');
    if (!meta) throw new Error('markSignedIn: no device row');
    if (meta.userId !== userId) {
      const settings = await db.settings.get(meta.userId);
      if (settings && !(await db.settings.get(userId))) {
        await db.settings.delete(meta.userId);
        await db.settings.put({ ...settings, userId });
      }
    }
    // A new account: its sync starts from nothing (cursor 0, settings first taken from the server).
    const { sync: _old, pendingTransfer: _none, formerUserIds: _earlier, accountLost: _lost, ...rest } = meta;
    const next: MetaRow = { ...rest, userId, account: { userId, deviceName, since: now }, ...(formerUserIds.length > 0 ? { formerUserIds: [...formerUserIds] } : {}) };
    await db.meta.put(next);
    return next;
  });
}

/**
 * The session is gone (a 401: removed on another device, long unused, the account deleted
 * elsewhere): the account mark goes and `accountLost` stays, so the explanation and the way to
 * clear the device survive a reload (R33 item 13). A device that was not signed in is left as it is.
 */
export function markAccountLost(db: ManaDb, now = new Date()): Promise<MetaRow> {
  return updateMeta(db, 'markAccountLost', (meta) => {
    if (!meta.account) return meta;
    const { account: _gone, ...rest } = meta;
    return { ...rest, accountLost: { reason: 'session', at: now } };
  });
}

/** Signed out by the person ("sign out, keep the data"): only the mark goes; journal, decks and settings stay. */
export async function markSignedOut(db: ManaDb): Promise<MetaRow> {
  return db.transaction('rw', db.meta, async () => {
    const meta = await db.meta.get('device');
    if (!meta) throw new Error('markSignedOut: no device row');
    const { account: _gone, ...rest } = meta;
    await db.meta.put(rest);
    return rest;
  });
}

/** One read-modify-write of the device row. */
function updateMeta(db: ManaDb, name: string, change: (meta: MetaRow) => MetaRow): Promise<MetaRow> {
  return db.transaction('rw', db.meta, async () => {
    const meta = await db.meta.get('device');
    if (!meta) throw new Error(`${name}: no device row`);
    const next = change(meta);
    await db.meta.put(next);
    return next;
  });
}

/**
 * What /api/auth/me says about the account (6a.5b, R42 item 6): under 16, and whether consent to
 * the current notice is still needed (`version` — that notice's version, NOTICE_VERSION).
 */
export function setAccountState(db: ManaDb, state: { minor: boolean; needsConsent: boolean }, version: number, now = new Date()): Promise<MetaRow> {
  return updateMeta(db, 'setAccountState', (meta) => {
    if (!meta.account) return meta;
    const next: MetaRow = { ...meta, account: { ...meta.account, minor: state.minor } };
    if (state.needsConsent) {
      next.sync = { ...(meta.sync ?? { cursor: 0, settingsRev: {}, dirty: [] }), needsConsent: meta.sync?.needsConsent ?? { version, at: now } };
    } else if (meta.sync?.needsConsent) {
      const { needsConsent: _given, ...sync } = meta.sync;
      next.sync = sync;
    }
    return next;
  });
}

/** Before the request that deletes the account (R42 item 8); a deletion that did not happen is forgotten. */
export function markPendingDeletion(db: ManaDb, now = new Date()): Promise<MetaRow> {
  return updateMeta(db, 'markPendingDeletion', (meta) => {
    const { deleteNotDone: _old, ...rest } = meta;
    return { ...rest, pendingDeletion: { userId: meta.userId, at: now } };
  });
}

/** The request never reached the server (or failed): the mark goes; `notDone` — the Account section says so. */
export function clearPendingDeletion(db: ManaDb, notDone: boolean, now = new Date()): Promise<MetaRow> {
  return updateMeta(db, 'clearPendingDeletion', (meta) => {
    const { pendingDeletion: _gone, ...rest } = meta;
    return notDone ? { ...rest, deleteNotDone: now } : rest;
  });
}

/** The Account section's "not deleted" line was closed. */
export function forgetDeleteNotDone(db: ManaDb): Promise<MetaRow> {
  return updateMeta(db, 'forgetDeleteNotDone', ({ deleteNotDone: _gone, ...rest }) => rest);
}

/**
 * The account is deleted (R42): on this device only what tied it to the account goes — the mark,
 * sync state, earlier ids, the send queue. The journal, decks and settings stay (under the same
 * userId) until the person saves or clears them; a later sign-in asks to add them, as on any
 * device with answers (R40).
 */
export async function finishAccountDeletion(db: ManaDb, now = new Date()): Promise<MetaRow> {
  return db.transaction('rw', db.meta, db.outbox, async () => {
    const meta = await db.meta.get('device');
    if (!meta) throw new Error('finishAccountDeletion: no device row');
    const { account: _a, sync: _s, formerUserIds: _f, pendingDeletion: _p, pendingTransfer: _t, deleteNotDone: _n, ...rest } = meta;
    // "Account deleted" stays on this device (after a reload too) until a new sign-in or clearing.
    const next: MetaRow = { ...rest, accountLost: { reason: 'deleted', at: now } };
    await db.outbox.clear();
    await db.meta.put(next);
    return next;
  });
}

/** The device's name as the server knows it. */
export async function setAccountDeviceName(db: ManaDb, deviceName: string): Promise<MetaRow> {
  return db.transaction('rw', db.meta, async () => {
    const meta = await db.meta.get('device');
    if (!meta?.account) throw new Error('setAccountDeviceName: not signed in');
    const next: MetaRow = { ...meta, account: { ...meta.account, deviceName } };
    await db.meta.put(next);
    return next;
  });
}

// ---------- Transfer of answers (stage 6a.4, R40) ----------

/** Before a sign-in that adds this device's answers: remembered, so a closed tab is finished at start. */
export async function beginTransfer(db: ManaDb, now = new Date()): Promise<MetaRow> {
  return db.transaction('rw', db.meta, async () => {
    const meta = await db.meta.get('device');
    if (!meta) throw new Error('beginTransfer: no device row');
    const next: MetaRow = { ...meta, pendingTransfer: { localUserId: meta.userId, at: now } };
    await db.meta.put(next);
    return next;
  });
}

/** The server did not take the sign-in (or it was never sent): nothing to finish. */
export async function forgetTransfer(db: ManaDb): Promise<MetaRow> {
  return db.transaction('rw', db.meta, async () => {
    const meta = await db.meta.get('device');
    if (!meta) throw new Error('forgetTransfer: no device row');
    const { pendingTransfer: _gone, ...rest } = meta;
    await db.meta.put(rest);
    return rest;
  });
}

/** The account's earlier ids as the server lists them now (/api/auth/me, the alias route). */
export async function setFormerUserIds(db: ManaDb, ids: readonly string[]): Promise<MetaRow> {
  return db.transaction('rw', db.meta, async () => {
    const meta = await db.meta.get('device');
    if (!meta) throw new Error('setFormerUserIds: no device row');
    const known = new Set([...(meta.formerUserIds ?? []), ...ids]);
    known.delete(meta.userId);
    const next: MetaRow = { ...meta, formerUserIds: [...known] };
    await db.meta.put(next);
    return next;
  });
}

type CardKey = [string, string, string, string];

/**
 * Every record, card and the settings row of `from` become `to`'s (inside the caller's
 * transaction): only the userId changes — id, time, answers and deviceId stay, so the canonical
 * JSON is the one any device would get. Cards move as they are (their dates stay by
 * construction); a card `to` already has is rebuilt from the joined history. A record of `from`
 * in the send queue would mean it was meant for the server under that id: never rewritten.
 * Returns the moved records.
 */
async function moveUser(db: ManaDb, scheduler: FSRS, from: string, to: string): Promise<LogRecord[]> {
  const records = await userLog(db, from);
  if (records.length > 0) {
    if ((await db.outbox.bulkGet(records.map((r) => r.id))).some(Boolean)) throw new Error('moveUser: a record of an earlier id is in the send queue');
    await db.log.bulkPut(records.map((r) => ({ ...r, userId: to })));
  }
  const cards = await db.cards.where('[userId+deckId]').between([from, Dexie.minKey], [from, Dexie.maxKey]).toArray();
  if (cards.length > 0) {
    const key = (userId: string, c: CardRow): CardKey => [userId, c.deckId, c.entryId, c.skill];
    await db.cards.bulkDelete(cards.map((c) => key(from, c)));
    const there = await db.cards.bulkGet(cards.map((c) => key(to, c)));
    await db.cards.bulkPut(cards.filter((_, i) => !there[i]).map((c) => ({ ...c, userId: to })));
    const clash = cards.filter((_, i) => there[i]).map((c) => key(to, c));
    if (clash.length > 0) await rebuildCardKeys(db, scheduler, to, clash);
  }
  const settings = await db.settings.get(from);
  if (settings) {
    await db.settings.delete(from);
    if (!(await db.settings.get(to))) await db.settings.put({ ...settings, userId: to });
  }
  return records.map((r) => ({ ...r, userId: to }));
}

/** Records into the send queue, those already there (any status) left as they are. */
async function queueRecords(db: ManaDb, records: readonly LogRecord[]): Promise<number> {
  const there = await db.outbox.bulkGet(records.map((r) => r.id));
  const rows: OutboxRow[] = records.filter((_, i) => !there[i]).map((r) => ({ id: r.id, status: 'pending', queuedAt: r.at.getTime() }));
  await db.outbox.bulkAdd(rows);
  return rows.length;
}

export interface Adopted {
  meta: MetaRow;
  /** Records put into the send queue. */
  queued: number;
}

/**
 * After the server took a sign-in with this device's answers (R40), in one transaction: the
 * records, cards and settings of the local user and of every earlier id move to the account
 * (nothing moves when the account is the local user: the first device, or signing in again);
 * every record of the account not yet in the send queue goes there; the sync starts again from
 * the server's first record and takes everything before sending (pullFirst). Repeating it changes
 * nothing.
 */
export async function adoptAccount(
  db: ManaDb,
  scheduler: FSRS,
  accountId: string,
  deviceName: string,
  formerUserIds: readonly string[],
  now = new Date(),
): Promise<Adopted> {
  const out = await db.transaction('rw', [db.meta, db.settings, db.log, db.cards, db.outbox], async (): Promise<Adopted> => {
    const meta = await db.meta.get('device');
    if (!meta) throw new Error('adoptAccount: no device row');
    const earlier = new Set([...(meta.formerUserIds ?? []), ...formerUserIds, meta.userId]);
    earlier.delete(accountId);
    for (const id of earlier) await moveUser(db, scheduler, id, accountId);
    const queued = await queueRecords(db, await userLog(db, accountId));
    const { sync: _old, pendingTransfer: _done, accountLost: _lost, ...rest } = meta;
    const since = meta.account?.userId === accountId ? meta.account.since : now;
    const next: MetaRow = {
      ...rest,
      userId: accountId,
      account: { userId: accountId, deviceName, since },
      formerUserIds: [...earlier],
      sync: { cursor: 0, settingsRev: {}, dirty: [], pullFirst: true },
    };
    await db.meta.put(next);
    return { meta: next, queued };
  });
  if (out.queued > 0) notifyQueued();
  return out;
}

/**
 * At start on a signed-in device: records still under an earlier id (written by another window
 * or an older build after the transfer) move to the account and into the queue — they were never
 * sent. True — something moved.
 */
export async function settleLeftovers(db: ManaDb, scheduler: FSRS): Promise<boolean> {
  const moved = await db.transaction('rw', [db.meta, db.settings, db.log, db.cards, db.outbox], async () => {
    const meta = await db.meta.get('device');
    if (!meta?.account || meta.account.userId !== meta.userId) return 0;
    let n = 0;
    for (const id of meta.formerUserIds ?? []) {
      if (id === meta.userId || (await db.log.where('[userId+at]').between([id, Dexie.minKey], [id, Dexie.maxKey]).count()) === 0) continue;
      n += await queueRecords(db, await moveUser(db, scheduler, id, meta.userId));
    }
    return n;
  });
  if (moved > 0) notifyQueued();
  return moved > 0;
}

export type AccountRestoreResult = { ok: true; added: number; skipped: number } | { ok: false; error: 'unknownUser' | 'signedOut' };

/**
 * A backup file on a signed-in device (R40), in one transaction: its records join the account's
 * journal under the account's id (ids already here skipped), go into the send queue, the cards
 * are rebuilt; the sync takes everything from the server before sending (pullFirst), so records
 * the server already has are not sent again. The file must be the account's or an earlier id's.
 */
export async function restoreForAccount(db: ManaDb, scheduler: FSRS, backup: JournalBackup): Promise<AccountRestoreResult> {
  const out = await db.transaction('rw', [db.meta, db.settings, db.log, db.cards, db.outbox], async (): Promise<AccountRestoreResult> => {
    const meta = await db.meta.get('device');
    if (!meta?.account || meta.account.userId !== meta.userId) return { ok: false, error: 'signedOut' };
    const existingIds = new Set((await db.log.toCollection().primaryKeys()) as string[]);
    const plan = planAccountRestore(backup, meta.userId, meta.formerUserIds ?? [], existingIds);
    if (!plan.ok) return plan;
    if (plan.add.length > 0) {
      await db.log.bulkAdd(plan.add);
      await queueRecords(db, plan.add);
      await replaceUserCards(db, scheduler, meta.userId);
      const sync = meta.sync ?? { cursor: 0, settingsRev: {}, dirty: [] };
      await db.meta.put({ ...meta, sync: { ...sync, cursor: 0, pullFirst: true } });
    }
    return { ok: true, added: plan.add.length, skipped: plan.skipped };
  });
  if (out.ok && out.added > 0) notifyQueued();
  return out;
}
