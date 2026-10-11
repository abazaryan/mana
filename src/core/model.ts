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
}

export interface SettingsRow {
  userId: string;
  uiLang: UiLang;
  /** Language of meanings, hints and notes in decks (Р8). */
  meaningLang: UiLang;
  /** New entries per day (Р7); used from stage 4.2. */
  newPerDay: number;
  updatedAt: Date;
}

export const DEFAULT_NEW_PER_DAY = 5;

export function defaultSettings(userId: string, uiLang: UiLang, now: Date): SettingsRow {
  return { userId, uiLang, meaningLang: uiLang, newPerDay: DEFAULT_NEW_PER_DAY, updatedAt: now };
}

export interface DeckRow {
  id: string;
  /** ZIP file name without extension (Р15); updated on every import. */
  name: string;
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
}

/** Introduction of an entry (Р3): once per entry, no rating. */
export interface IntroRecord extends LogBase {
  type: 'intro';
  skill: null;
}

export type AnswerMode = 'voice' | 'typed' | 'skip';
export type Correction = 'lowered' | 'raised' | 'misrecognized';
export type FinalRating = 1 | 2 | 3 | 4;

/**
 * FSRS figures computed when the answer was recorded. For analysis only: the card
 * state is rebuilt from the journal, and a test checks the rebuild gives the same dates.
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
  suggested: FinalRating;
  reason: RatingReason;
  /** Goes to FSRS (Р4). */
  final: FinalRating;
  correction: Correction | null;
  fsrs: ReviewFsrs;
}

export type LogRecord = IntroRecord | ReviewRecord;

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
