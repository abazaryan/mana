/**
 * The sync exchange between a device and the server (stage 6a.3, R39; STAGE6_RESEARCH 5.1, 5.10):
 * what the requests and answers carry, the synced settings and their allowed values. Shared by
 * the app and the Worker; no imports beyond kinds.ts.
 */
import type { RecordProblem } from './journalRecord.ts';
import { ID_PATTERN, UI_LANGS } from './kinds.ts';

/**
 * Records in one push that the server takes; the device sends at most PUSH_BATCH. 100 from
 * 27.10.2026 (step "CPU of sign-in routes": a warm push of 100 took ≈ 16 ms of CPU in workerd).
 */
export const PUSH_MAX_RECORDS = 100;
/** Body of a push, bytes (STAGE6_RESEARCH 7.4). */
export const PUSH_BODY_LIMIT = 1024 * 1024;
/**
 * Records in one pull, at most and by default; a larger limit is cut to this (an older app asks
 * 500 and follows `more`). 200 from 27.10.2026 (step "CPU of sign-in routes": a page of 500 took
 * ≈ 8 ms of CPU in workerd, of 200 ≈ 5 ms).
 */
export const PULL_MAX = 200;

/**
 * The settings every device of an account shares under a fixed key (R33 item 10); everything else
 * stays on the device. `newPerDay` is the shared limit from before R47: the server still takes it
 * (from older builds), this build neither sends nor takes it.
 */
export const SYNCED_SETTINGS = ['uiLang', 'meaningLang', 'newPerDay'] as const;

/** The daily limit of one deck (R47): `newPerDeck:<deck id>`; ":" is not in deck ids. */
export const DECK_LIMIT_PREFIX = 'newPerDeck:';
export type DeckLimitKey = `${typeof DECK_LIMIT_PREFIX}${string}`;
export type SyncedSetting = (typeof SYNCED_SETTINGS)[number] | DeckLimitKey;

export const deckLimitKey = (deckId: string): DeckLimitKey => `${DECK_LIMIT_PREFIX}${deckId}`;

/** The deck of a deck limit key; null for any other key. */
export function deckOfLimitKey(key: unknown): string | null {
  if (typeof key !== 'string' || !key.startsWith(DECK_LIMIT_PREFIX)) return null;
  const id = key.slice(DECK_LIMIT_PREFIX.length);
  return ID_PATTERN.test(id) ? id : null;
}

export const isSyncedSetting = (key: unknown): key is SyncedSetting => (SYNCED_SETTINGS as readonly unknown[]).includes(key) || deckOfLimitKey(key) !== null;

/** Settings changes in one push at most: the fixed keys and a key per deck (R47). */
export const MAX_SETTING_CHANGES = 50;
/** Deck limits one account keeps on the server (R47): a new deck key past this many is not stored. */
export const MAX_DECK_LIMITS = 200;

/** An allowed value of a synced setting. */
export function validSetting(key: SyncedSetting, value: unknown): boolean {
  if (key === 'newPerDay' || deckOfLimitKey(key) !== null) return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100;
  return (UI_LANGS as readonly unknown[]).includes(value);
}

/**
 * A setting sent to the server: `set` — changed on the device, it wins; `init` — the device's
 * value at its first sync after sign-in, kept only if the account has none yet.
 */
export interface SettingChange {
  key: SyncedSetting;
  value: unknown;
  mode: 'set' | 'init';
}

/** The account's settings on the server: value and change number by key. */
export type ServerSettings = Partial<Record<string, { value: unknown; rev: number }>>;

export interface PushRequest {
  records: unknown[];
  settings?: SettingChange[];
}

export interface PushResponse {
  /** Stored now. */
  stored: string[];
  /** Already there with the same content. */
  duplicate: string[];
  /** Already there with other content, or twice in this push with different content: nothing stored. */
  conflict: string[];
  rejected: { id: string | null; reason: RecordProblem }[];
  settings: ServerSettings;
  /** Keys refused (unknown key or value). */
  settingsRejected: string[];
  serverTime: number;
}

export interface PullResponse {
  /** Records as the server keeps them (canonical JSON), in seq order. */
  records: unknown[];
  /** The cursor after these records. */
  next: number;
  more: boolean;
  settings: ServerSettings;
  serverTime: number;
}
