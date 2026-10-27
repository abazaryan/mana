/**
 * The sync exchange between a device and the server (stage 6a.3, R39; STAGE6_RESEARCH 5.1, 5.10):
 * what the requests and answers carry, the synced settings and their allowed values. Shared by
 * the app and the Worker; no imports beyond kinds.ts.
 */
import type { RecordProblem } from './journalRecord.ts';
import { UI_LANGS } from './kinds.ts';

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

/** The settings every device of an account shares (R33 item 10); everything else stays on the device. */
export const SYNCED_SETTINGS = ['uiLang', 'meaningLang', 'newPerDay'] as const;
export type SyncedSetting = (typeof SYNCED_SETTINGS)[number];

export const isSyncedSetting = (key: unknown): key is SyncedSetting => (SYNCED_SETTINGS as readonly unknown[]).includes(key);

/** An allowed value of a synced setting. */
export function validSetting(key: SyncedSetting, value: unknown): boolean {
  if (key === 'newPerDay') return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100;
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
export type ServerSettings = Partial<Record<SyncedSetting, { value: unknown; rev: number }>>;

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
