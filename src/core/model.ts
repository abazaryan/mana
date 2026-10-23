/**
 * Stored data shapes (IndexedDB, docs/DATA_MODEL.md). Pure types and small helpers;
 * the Dexie schema itself lives in src/platform/db.ts.
 *
 * Three kinds of data: deck content (decks, entries, media — from the ZIP), the
 * append-only journal (log — the source of truth for progress, Р10) and derived
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
   * Scheduling rules the stored cards were rebuilt with (Р29.7). Below RULES_VERSION,
   * the app saves the journal to a file and rebuilds the cards before any study.
   */
  rulesVersion?: number;
  /**
   * This browser answered `phrases-not-supported` to recognizer hints: they are not
   * sent again until the setting is switched off and on (device-only, never synced).
   */
  phrasesUnsupported?: boolean;
  /**
   * Answers are typed on the device's own keyboard instead of the on-screen one (Р31;
   * Settings, off by default). Device-only, never synced.
   */
  systemKeyboard?: boolean;
  /**
   * "Voice check" of the browser voice by primary language (`fr`), answered on this device
   * (Р33 п. 14): `yes` — entries without deck audio of that language may get `listen`;
   * `no` — heard nothing. Device-only, never synced.
   */
  voiceChecks?: Record<string, VoiceCheck>;
  /**
   * Signed in to an account on this device (stage 6a.2, STAGE6_RESEARCH 5.10); absent — the local
   * mode. The session itself is an HttpOnly cookie the app cannot read. Device-only, never synced.
   */
  account?: AccountMark;
}

export interface AccountMark {
  /** The account's id; meta.userId equals it after sign-in. */
  userId: string;
  deviceName: string;
  since: Date;
}

export type VoiceCheck = 'yes' | 'no';

export interface SettingsRow {
  userId: string;
  uiLang: UiLang;
  /** Language of meanings, hints and notes in decks (Р8). */
  meaningLang: UiLang;
  /** New entries per day (Р7); used from stage 4.2. */
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
   * (Р30). Shown only when the deck has no title.
   */
  name: string;
  /** Deck name in interface languages from deck.json (Р30); kept when an update has none. */
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
  /** Order in the deck = order of introduction (Р15). */
  position: number;
  /** 1 = missing from the installed revision (Р15); not issued, progress kept. A number: IndexedDB cannot index booleans. */
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
  /** UUID v4; journals merge by it (Р10). */
  id: string;
  userId: string;
  deviceId: string;
  at: Date;
  deckId: string;
  entryId: string;
  deckRevision: number;
  /** One session (a portion, Р17.1). */
  sessionId: string;
  /** Zone of the device at the moment (IANA), from stage 4.4a (Р29.3); absent in older records = Europe/Luxembourg. */
  tz?: string;
  /** Minutes east of UTC at the moment in that zone; the app day of the record is counted with it. */
  tzOffsetMin?: number;
  /**
   * How the entry sounded on this card (Р33 п. 14): the deck audio file, the browser
   * voice, or nothing (no play, or it failed). Absent in records before 21.10.2026.
   */
  audioSource?: AudioSource;
  /** The browser voice that spoke (`audioSource: browser`), when the browser named it. */
  voice?: string | null;
}

export type AudioSource = 'file' | 'browser' | 'none';

/** "Say it aloud" during an introduction (Р22.5): recognised, never rated. */
export interface IntroEcho {
  /** Chosen recognizer alternative (or the typed text); '' if nothing was heard or the step was skipped. */
  answer: string;
  alternatives: string[];
  verdict: Verdict | null;
  skipped: boolean;
  /** From 16.10.2026: voice, or typed after three unrecognised attempts in a row. */
  mode?: 'voice' | 'typed';
  recognitionErrors?: RecognitionErrorEntry[];
  /** The "say the word 2–3 times" hint was shown (from 16.10.2026, Р23). */
  repeatHintShown?: boolean;
  /** Presses of "Once more" / retries of the microphone. */
  retries?: number;
  /** The whole text said k times (Р22, amendment of 16.10.2026). */
  repeats?: number;
  /** Typed after three unrecognised attempts: the keyboard of the first character (Р31). */
  keyboard?: TypedKeyboard | null;
  /** Typed: something was pasted (Р31). */
  pasted?: boolean;
}

/** "Copy it out" during an introduction, entries with `write` only (Р22.5): checked, never rated. */
export interface IntroCopy {
  typed: string;
  verdict: Verdict;
  errorType: string | null;
  /** Punctuation differed — shown, not counted (Р26). */
  punctuationNote?: boolean;
  /** The keyboard of the first character (Р31). */
  keyboard?: TypedKeyboard | null;
  /** Something was pasted (Р31). */
  pasted?: boolean;
}

/** Introduction of an entry (Р3): once per entry, no rating. */
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
 * What typed an answer (Р31): the on-screen keyboard, the device's own (Settings →
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
 * state unchanged (Р29.2).
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
  /** Added at stage 4.2 (Р22.7); absent in older records. Recognizer confidence per alternative. */
  confidences?: (number | null)[];
  /** Which alternative was checked (the best one). */
  altIndex?: number | null;
  /** What marked the start of the answer: speechstart, the first result, the first key. */
  latencySource?: LatencySource | null;
  recognitionErrors?: RecognitionErrorEntry[];
  /** The "say the word 2–3 times" hint was shown (from 16.10.2026, Р23). */
  repeatHintShown?: boolean;
  /** N: words in the reference (Р22.2). */
  wordCount?: number | null;
  /** E: reference words not heard. */
  unsaid?: number | null;
  /** The whole reference said k times ("sept sept" = 2); 1 for an ordinary answer (from 16.10.2026). */
  repeats?: number | null;
  /** Extra words heard. */
  extraWords?: number | null;
  /** `write`: the answer differs from the reference in punctuation, which is not counted (Р26). */
  punctuationNote?: boolean;
  /** Typed answers (from stage 5, Р31): the keyboard of the first character; null — nothing typed (only pasted). */
  keyboard?: TypedKeyboard | null;
  /** Typed answers (from stage 5, Р31): something was pasted. */
  pasted?: boolean;
  /** `listen` (stage 4.3): times the audio played before the answer (1 = only the automatic play). */
  plays?: number | null;
  /** `listen`: visible ms from the card shown to the end of the last play before the answer. */
  audioEndMs?: number | null;
  /** `listen`: visible ms from the card shown to the microphone ready after that play; latency counts from here. */
  micReadyMs?: number | null;
  /**
   * 0 = the card as planned; 1 or 2 = it came back in the portion after Again (Р25).
   * A return is journaled with its rating but does not change FSRS (Р29.2).
   */
  requeue?: number;
  /** Seconds since the previous answer on this pair (any day); null for the first one. */
  sincePairSec?: number | null;
  /** Other cards between this one and the previous card of the same entry in the portion (introduction included); null if none. */
  sinceEntryCards?: number | null;
  /** Seconds since the previous card of the same entry in the portion was finished; null if none. */
  sinceEntrySec?: number | null;
  /** Sound rules that made a word match (З1…З9, Ч). */
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
  /** Goes to FSRS (Р4). */
  final: FinalRating;
  correction: Correction | null;
  /** Version of the scheduling rules (Р29.4, `RULES_VERSION`); absent before stage 4.4a. */
  rules?: number;
  fsrs: ReviewFsrs;
}

/**
 * The short practice after Again (Р17.11, Р25): `speak` and `listen` — hear and say it
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
