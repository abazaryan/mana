/**
 * Stored data shapes (IndexedDB, docs/DATA_MODEL.md). Pure types and small helpers;
 * the Dexie schema itself lives in src/platform/db.ts.
 *
 * Three kinds of data: deck content (decks, entries, media — from the ZIP), the
 * append-only journal (log — the source of truth for progress, R10) and derived
 * FSRS state (cards — a cache rebuilt from the journal).
 */
import type { State } from 'ts-fsrs';
import type { DeckEntry, Localized, Skill, UiLang } from './deckFormat';
import type { Verdict } from './evaluate';
import type { RatingReason } from './rating';
import type { CardState } from './scheduler';

export interface MetaRow {
  key: 'device';
  /** Local user, created on first run; linked to an account at stage 6. */
  userId: string;
  deviceId: string;
  createdAt: Date;
  /**
   * Scheduling rules the stored cards were rebuilt with (R29.7). Below RULES_VERSION,
   * the app saves the journal to a file and rebuilds the cards before any study.
   */
  rulesVersion?: number;
  /**
   * This browser answered `phrases-not-supported` to recognizer hints: they are not
   * sent again until the setting is switched off and on (device-only, never synced).
   */
  phrasesUnsupported?: boolean;
  /**
   * Answers are typed on the device's own keyboard instead of the on-screen one (R31;
   * Settings, off by default). Device-only, never synced.
   */
  systemKeyboard?: boolean;
  /**
   * "Voice check" of the browser voice by primary language (`fr`), answered on this device
   * (R33 item 14): `yes` — entries without deck audio of that language may get `listen`;
   * `no` — heard nothing. Device-only, never synced.
   */
  voiceChecks?: Record<string, VoiceCheck>;
  /**
   * Signed in to an account on this device (stage 6a.2, STAGE6_RESEARCH 5.10); absent — the local
   * mode. The session itself is an HttpOnly cookie the app cannot read. Device-only, never synced.
   */
  account?: AccountMark;
  /** Sync with the account (stage 6a.3); absent until the first exchange after sign-in. Device-only. */
  sync?: SyncState;
  /**
   * The account's earlier ids (stage 6a.4, R40): installations whose answers joined the account,
   * as the server last listed them (sign-in, /api/auth/me). A backup file of one of them is the
   * account's. Records found under one of them are rewritten to the account. Device-only.
   */
  formerUserIds?: string[];
  /**
   * A sign-in that adds this device's answers to an account was sent (R40): written before the
   * request, removed when the device side is done. Found at start — /api/auth/me tells whether
   * the server took it, and the transfer is finished or forgotten. Device-only.
   */
  pendingTransfer?: { localUserId: string; at: Date };
  /**
   * The account's deletion was sent (stage 6a.5b, R42 item 8): written before the request, removed
   * when the answer is known. Found at start — /api/auth/me tells: 401 — deleted, 200 — not.
   * While it stands the device does not sync. Device-only.
   */
  pendingDeletion?: { userId: string; at: Date };
  /** A deletion that never reached the server (R42 item 8): the Account section says so until closed. */
  deleteNotDone?: Date;
  /**
   * This device was in an account and is no longer (R33 item 13, R42 item 7): `session` — a 401
   * (removed on another device, long unused, or the account deleted elsewhere); `deleted` — the
   * account was deleted here. The sign-in screen and the Account section explain it and offer to
   * clear the device, after a reload too. Gone with a new sign-in or with the data (clearing).
   * Never set on a device that was not signed in. Device-only.
   */
  accountLost?: { reason: 'session' | 'deleted'; at: Date };
}

/**
 * Where this device stands with the server (stage 6a.3, R39). The send status of each record
 * lives in `outbox`, never in the record itself: its canonical JSON must not change.
 */
export interface SyncState {
  /** The server's seq of the last record received (STAGE6_RESEARCH 5.1). */
  cursor: number;
  /** Change number of each synced setting as last taken from the server. */
  settingsRev: Partial<Record<string, number>>;
  /** Synced settings changed here and not yet accepted by the server. */
  dirty: string[];
  /** The last exchange that went through to the end. */
  lastOkAt?: Date;
  /**
   * This version of the app is older than the account's data: the server said 426, or records
   * came with newer scheduling rules. No exchange until the app is updated.
   */
  needsUpdate?: { reason: 'client' | 'rules'; build: number; at: Date };
  /** Records came with newer rules and the cards were not rebuilt: rebuild after the update. */
  needsRebuild?: boolean;
  /**
   * The server wants the account's consent to this notice version first (R39; 403 from sync, or
   * /api/auth/me at start); cleared by the next exchange that goes through, by me without the
   * need, or by the consent given (the screen — stage 6a.5b).
   */
  needsConsent?: { version: number; at: Date };
  /**
   * After a transfer, a new sign-in or a restore while signed in (R40): take everything from the
   * server before sending anything. A received record equal to a queued one leaves the queue
   * (the server has it); the last page clears the mark, then the rest of the queue goes.
   */
  pullFirst?: boolean;
}

export type OutboxStatus = 'pending' | 'rejected' | 'conflict';

/** A record of this device waiting for the server (stage 6a.3). Received records are never here. */
export interface OutboxRow {
  /** The record's id in `log`. */
  id: string;
  /** pending — to send; rejected / conflict — the server refused it: kept, never sent again by itself. */
  status: OutboxStatus;
  /** Why the server refused it (`future`, `schema`, …). */
  reason?: string;
  /** Order of sending: the record's time, ms. */
  queuedAt: number;
}

export interface AccountMark {
  /** The account's id; meta.userId equals it after sign-in. */
  userId: string;
  deviceName: string;
  since: Date;
  /** Under 16, as /api/auth/me last said (6a.5b): consent again comes from a parent or guardian. */
  minor?: boolean;
}

export type VoiceCheck = 'yes' | 'no';

export interface SettingsRow {
  userId: string;
  uiLang: UiLang;
  /** Language of meanings, hints and notes in decks (R8). */
  meaningLang: UiLang;
  /** New entries per day (R7); used from stage 4.2. */
  newPerDay: number;
  /** Recognizer hints from the words of the decks (experiment, off by default); absent = off. */
  biasing?: boolean;
  updatedAt: Date;
}

export const DEFAULT_NEW_PER_DAY = 5;

export function defaultSettings(userId: string, uiLang: UiLang, now: Date): SettingsRow {
  return { userId, uiLang, meaningLang: uiLang, newPerDay: DEFAULT_NEW_PER_DAY, updatedAt: now };
}

export interface DeckRow {
  id: string;
  /**
   * ZIP file name without extension at the first install; never changed by an update
   * (R30). Shown only when the deck has no title.
   */
  name: string;
  /** Deck name in interface languages from deck.json (R30); kept when an update has none. */
  title?: Localized;
  language: string;
  revision: number;
  formatVersion: number;
  tags: Record<string, Localized>;
  /** Entries in the installed revision. */
  entryCount: number;
  /** Entries kept from earlier revisions but missing from the installed one. */
  hiddenCount: number;
  audioBytes: number;
  importedAt: Date;
  updatedAt: Date;
}

export interface EntryRow extends Omit<DeckEntry, 'id' | 'audio'> {
  deckId: string;
  entryId: string;
  /** Order in the deck = order of introduction (R15). */
  position: number;
  /** 1 = missing from the installed revision (R15); not issued, progress kept. A number: IndexedDB cannot index booleans. */
  hidden: 0 | 1;
  /** Path inside the archive, the key in `media`. */
  audio: string | null;
}

export interface MediaRow {
  deckId: string;
  path: string;
  /** MIME type. */
  type: string;
  /** ArrayBuffer rather than Blob: stores reliably in every browser. */
  data: ArrayBuffer;
  bytes: number;
}

interface LogBase {
  /** UUID v4; journals merge by it (R10). */
  id: string;
  userId: string;
  deviceId: string;
  at: Date;
  deckId: string;
  entryId: string;
  deckRevision: number;
  /** One session (a portion, R17.1). */
  sessionId: string;
  /** Zone of the device at the moment (IANA), from stage 4.4a (R29.3); absent in older records = Europe/Luxembourg. */
  tz?: string;
  /** Minutes east of UTC at the moment in that zone; the app day of the record is counted with it. */
  tzOffsetMin?: number;
  /**
   * How the entry sounded on this card (R33 item 14): the deck audio file, the browser
   * voice, or nothing (no play, or it failed). Absent in records before 21.10.2026.
   */
  audioSource?: AudioSource;
  /** The browser voice that spoke (`audioSource: browser`), when the browser named it. */
  voice?: string | null;
}

export type AudioSource = 'file' | 'browser' | 'none';

/** "Say it aloud" during an introduction (R22.5): recognised, never rated. */
export interface IntroEcho {
  /** Chosen recognizer alternative (or the typed text); '' if nothing was heard or the step was skipped. */
  answer: string;
  alternatives: string[];
  verdict: Verdict | null;
  skipped: boolean;
  /** From 16.10.2026: voice, or typed after three unrecognised attempts in a row. */
  mode?: 'voice' | 'typed';
  recognitionErrors?: RecognitionErrorEntry[];
  /** The "say the word 2–3 times" hint was shown (from 16.10.2026, R23). */
  repeatHintShown?: boolean;
  /** Presses of "Once more" / retries of the microphone. */
  retries?: number;
  /** The whole text said k times (R22, amendment of 16.10.2026). */
  repeats?: number;
  /** Typed after three unrecognised attempts: the keyboard of the first character (R31). */
  keyboard?: TypedKeyboard | null;
  /** Typed: something was pasted (R31). */
  pasted?: boolean;
}

/** "Copy it out" during an introduction, entries with `write` only (R22.5): checked, never rated. */
export interface IntroCopy {
  typed: string;
  verdict: Verdict;
  errorType: string | null;
  /** Punctuation differed — shown, not counted (R26). */
  punctuationNote?: boolean;
  /** The keyboard of the first character (R31). */
  keyboard?: TypedKeyboard | null;
  /** Something was pasted (R31). */
  pasted?: boolean;
}

/** Introduction of an entry (R3): once per entry, no rating. */
export interface IntroRecord extends LogBase {
  type: 'intro';
  skill: null;
  /** Added at stage 4.2; absent in older records. */
  echo?: IntroEcho | null;
  copy?: IntroCopy | null;
}

/** A recognizer error, a watchdog timeout or "nothing recognised", with its time from the card shown. */
export interface RecognitionErrorEntry {
  code: string;
  atMs: number;
}

export type LatencySource = 'speechstart' | 'result' | 'key';

/**
 * What typed an answer (R31): the on-screen keyboard, the device's own (Settings →
 * System keyboard) or a physical one. Taken from the first character; a paste is not one.
 */
export type TypedKeyboard = 'onscreen' | 'system' | 'physical';

/** Recognizer hints for an answer: sent, switched off, or wanted but not possible here. */
export type BiasingState = 'on' | 'off' | 'unavailable';

/** On-device recognition pack of a language (SpeechRecognition.available), or `unsupported` (no such API). */
export type SpeechPackState = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported';

export type AnswerMode = 'voice' | 'typed' | 'skip';
export type Correction = 'lowered' | 'raised' | 'misrecognized';
export type FinalRating = 1 | 2 | 3 | 4;

/**
 * FSRS figures computed when the answer was recorded. For analysis only: the card
 * state is rebuilt from the journal, and a test checks the rebuild gives the same
 * dates for records of the current rules version. A return after Again shows the
 * state unchanged (R29.2).
 */
export interface ReviewFsrs {
  stateBefore: State;
  dueBefore: Date;
  nextState: State;
  nextDue: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
}

/** One answer on one card (entry × skill). Written once, with the final rating. */
export interface ReviewRecord extends LogBase {
  type: 'review';
  skill: Skill;
  /** The entry text at the time of the answer. */
  expected: string;
  mode: AnswerMode;
  answer: string;
  alternatives: string[];
  verdict: Verdict;
  errorType: string | null;
  /** Time to the start of the answer; null = unknown or over 120 s. */
  latencyMs: number | null;
  totalMs: number | null;
  micDelayMs: number | null;
  retries: number;
  recognitionLang: string | null;
  /** Added at stage 4.2 (R22.7); absent in older records. Recognizer confidence per alternative. */
  confidences?: (number | null)[];
  /** Which alternative was checked (the best one). */
  altIndex?: number | null;
  /** What marked the start of the answer: speechstart, the first result, the first key. */
  latencySource?: LatencySource | null;
  recognitionErrors?: RecognitionErrorEntry[];
  /** The "say the word 2–3 times" hint was shown (from 16.10.2026, R23). */
  repeatHintShown?: boolean;
  /** N: words in the reference (R22.2). */
  wordCount?: number | null;
  /** E: reference words not heard. */
  unsaid?: number | null;
  /** The whole reference said k times ("sept sept" = 2); 1 for an ordinary answer (from 16.10.2026). */
  repeats?: number | null;
  /** Extra words heard. */
  extraWords?: number | null;
  /** `write`: the answer differs from the reference in punctuation, which is not counted (R26). */
  punctuationNote?: boolean;
  /** Typed answers (from stage 5, R31): the keyboard of the first character; null — nothing typed (only pasted). */
  keyboard?: TypedKeyboard | null;
  /** Typed answers (from stage 5, R31): something was pasted. */
  pasted?: boolean;
  /** `listen` (stage 4.3): times the audio played before the answer (1 = only the automatic play). */
  plays?: number | null;
  /** `listen`: visible ms from the card shown to the end of the last play before the answer. */
  audioEndMs?: number | null;
  /** `listen`: visible ms from the card shown to the microphone ready after that play; latency counts from here. */
  micReadyMs?: number | null;
  /**
   * 0 = the card as planned; 1 or 2 = it came back in the portion after Again (R25).
   * A return is journaled with its rating but does not change FSRS (R29.2).
   */
  requeue?: number;
  /** Seconds since the previous answer on this pair (any day); null for the first one. */
  sincePairSec?: number | null;
  /** Other cards between this one and the previous card of the same entry in the portion (introduction included); null if none. */
  sinceEntryCards?: number | null;
  /** Seconds since the previous card of the same entry in the portion was finished; null if none. */
  sinceEntrySec?: number | null;
  /** Sound rules that made a word match (Z1…Z9 and the digits rule, see cyrillicData.ts). */
  soundRules?: string[];
  /** Recognizer adapter (`web-speech`); from the stage 4.2 amendments. */
  recognizer?: string | null;
  biasing?: BiasingState;
  /** Hint words sent with the attempt that gave the answer. */
  phrasesCount?: number;
  processLocally?: boolean;
  /** On-device pack state checked when the session started (hints on only). */
  speechPack?: SpeechPackState | null;
  suggested: FinalRating;
  reason: RatingReason;
  /** Goes to FSRS (R4). */
  final: FinalRating;
  correction: Correction | null;
  /** Version of the scheduling rules (R29.4, `RULES_VERSION`); absent before stage 4.4a. */
  rules?: number;
  fsrs: ReviewFsrs;
}

/**
 * The short practice after Again (R17.11, R25): `speak` and `listen` — hear and say it
 * aloud; `write` — copy it out once. Never rated; written after its answer, which it
 * points to. FSRS and the Easy rule skip it.
 */
export interface DrillRecord extends LogBase {
  type: 'drill';
  skill: Skill;
  /** The answer rated Again. */
  reviewId: string;
  skipped: boolean;
  echo: IntroEcho | null;
  copy: IntroCopy | null;
}

export type LogRecord = IntroRecord | ReviewRecord | DrillRecord;

/** Derived FSRS state of one card; rebuilt from the journal at any time. */
export interface CardRow extends CardState {
  userId: string;
  deckId: string;
  entryId: string;
  skill: Skill;
  lastLogId: string;
}

/** Journal order: by time, then by id (stable across devices). */
export function compareLog(a: Pick<LogBase, 'at' | 'id'>, b: Pick<LogBase, 'at' | 'id'>): number {
  const d = a.at.getTime() - b.at.getTime();
  if (d !== 0) return d;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function cardKey(c: { deckId: string; entryId: string; skill: Skill }): string {
  return `${c.deckId}/${c.entryId}/${c.skill}`;
}
