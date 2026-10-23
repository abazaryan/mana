/**
 * One journal record in its JSON form, checked the same way everywhere (stage 6a.3, R39): a
 * backup file, the server when a device sends records, the device when it receives them. And
 * the canonical JSON the server stores and hashes: keys sorted, no spaces (STAGE6_RESEARCH 5.2),
 * so the same record sent again in another key order is no conflict.
 *
 * Known types (intro, review, drill) get their own checks; an unknown, later type passes with
 * valid common fields and is kept whole (STAGE6_RESEARCH 5.5). Times travel as the ISO strings
 * JSON.stringify writes for a Date: any other form would come back changed after a round trip
 * through a device and give a false conflict.
 *
 * No imports beyond kinds.ts: the Worker bundles this file.
 */
import { SKILLS, type Skill } from './kinds.ts';

type Json = Record<string, unknown>;

/** Largest record, bytes of its canonical JSON in UTF-8 (STAGE6_RESEARCH 5.3; records are ≈ 1 KB). */
export const MAX_RECORD_BYTES = 16 * 1024;
/** Records from further ahead of the server's clock are refused (R33 item 8). */
export const FUTURE_SLACK_MS = 2 * 60 * 60 * 1000;
/** No record is older than this (the journal starts on 14.10.2026). */
export const EARLIEST_AT = Date.UTC(2026, 9, 1);

/** Why the server refuses a record. */
export type RecordProblem = 'schema' | 'user' | 'size' | 'future' | 'past';

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const rating = (v: unknown): boolean => v === 1 || v === 2 || v === 3 || v === 4;
const skill = (v: unknown): v is Skill => (SKILLS as readonly unknown[]).includes(v);

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Milliseconds of a time written by JSON.stringify(Date); null for anything else. */
export function isoTime(v: unknown): number | null {
  if (typeof v !== 'string' || !ISO.test(v)) return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) || new Date(ms).toISOString() !== v ? null : ms;
}

/** The shape of a record: common fields, and the fields of its type when the type is known. */
export function validRecordShape(v: unknown): v is Json {
  if (!isObject(v)) return false;
  if (!text(v.id) || !text(v.type) || !text(v.userId) || !text(v.deviceId) || !text(v.deckId) || !text(v.entryId)) return false;
  if (isoTime(v.at) === null || typeof v.deckRevision !== 'number' || !text(v.sessionId)) return false;
  switch (v.type) {
    case 'intro':
      return v.skill === null;
    case 'drill':
      return skill(v.skill) && text(v.reviewId);
    case 'review':
      return (
        skill(v.skill) &&
        rating(v.final) &&
        rating(v.suggested) &&
        isObject(v.fsrs) &&
        isoTime(v.fsrs.dueBefore) !== null &&
        isoTime(v.fsrs.nextDue) !== null
      );
    default:
      return true;
  }
}

/**
 * A record of `userId` from JSON with its times as Dates (`at`; `fsrs.dueBefore` and
 * `fsrs.nextDue` of an answer); every other field as it came. Null if it is not one.
 */
export function reviveRecord(v: unknown, userId: string): Json | null {
  if (!validRecordShape(v) || v.userId !== userId) return null;
  const out: Json = { ...v, at: new Date(v.at as string) };
  if (v.type === 'review') {
    const fsrs = v.fsrs as Json;
    out.fsrs = { ...fsrs, dueBefore: new Date(fsrs.dueBefore as string), nextDue: new Date(fsrs.nextDue as string) };
  }
  return out;
}

/**
 * Canonical JSON: object keys sorted, no spaces; otherwise exactly JSON.stringify (a Date as
 * its ISO string, undefined fields left out, NaN and Infinity as null).
 */
export function canonicalJson(v: unknown): string {
  if (v instanceof Date) return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined || typeof x === 'function' ? 'null' : canonicalJson(x))).join(',')}]`;
  if (typeof v === 'object' && v !== null) {
    const parts: string[] = [];
    for (const key of Object.keys(v).sort()) {
      const x = (v as Json)[key];
      if (x === undefined || typeof x === 'function') continue;
      parts.push(`${JSON.stringify(key)}:${canonicalJson(x)}`);
    }
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

export const utf8Bytes = (s: string): number => new TextEncoder().encode(s).byteLength;

/** A record the server will store: its columns and its canonical JSON (the hash is taken apart). */
export interface StoredRecord {
  id: string;
  type: string;
  at: number;
  deviceId: string;
  deckId: string;
  entryId: string;
  /** The scheduling rules of an answer (R29.4); null for other records and for answers without one. */
  rules: number | null;
  body: string;
}

export type PushCheck = { ok: true; record: StoredRecord } | { ok: false; id: string | null; reason: RecordProblem };

/**
 * The server's check of one sent record: its shape, the account of the session (the device may
 * be another of the account's, 6a.4), its size and its time (`now` — the server's clock).
 */
export function checkPushed(v: unknown, userId: string, now: number): PushCheck {
  const id = isObject(v) && text(v.id) ? v.id : null;
  if (!validRecordShape(v)) return { ok: false, id, reason: 'schema' };
  if (v.userId !== userId) return { ok: false, id, reason: 'user' };
  const body = canonicalJson(v);
  if (utf8Bytes(body) > MAX_RECORD_BYTES) return { ok: false, id, reason: 'size' };
  const at = isoTime(v.at)!;
  if (at > now + FUTURE_SLACK_MS) return { ok: false, id, reason: 'future' };
  if (at < EARLIEST_AT) return { ok: false, id, reason: 'past' };
  const rules = v.type === 'review' && typeof v.rules === 'number' && Number.isInteger(v.rules) ? v.rules : null;
  return {
    ok: true,
    record: { id: v.id as string, type: v.type as string, at, deviceId: v.deviceId as string, deckId: v.deckId as string, entryId: v.entryId as string, rules, body },
  };
}
