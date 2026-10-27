/**
 * Synthetic journal records for the bench, shaped like real ones: the mix of types, the size of
 * the canonical JSON and the number of keys follow tools/bench/.out/sizes.json (journal-sizes.ts,
 * numbers only); without that file — fixed sizes. Valid for the server's check (checkPushed).
 * No content of a real journal is used.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalJson, utf8Bytes } from '../../src/core/journalRecord.ts';
import type { Sizes, TypeSizes } from './journal-sizes.ts';
import { SIZES_FILE } from './paths.ts';

type Json = Record<string, unknown>;

const FALLBACK: Sizes = {
  records: 0,
  types: {
    review: { n: 80, bytes: [1000, 1000, 1000, 1000, 1000, 1000, 1000], topKeys: 40, allKeys: 52, nestedKeys: 7, arrayItems: 2 },
    intro: { n: 15, bytes: [500, 500, 500, 500, 500, 500, 500], topKeys: 12, allKeys: 19, nestedKeys: 7, arrayItems: 1 },
    drill: { n: 5, bytes: [650, 650, 650, 650, 650, 650, 650], topKeys: 18, allKeys: 27, nestedKeys: 9, arrayItems: 1 },
  },
};

export function loadSizes(): { sizes: Sizes; fromJournal: boolean } {
  if (!existsSync(SIZES_FILE)) return { sizes: FALLBACK, fromJournal: false };
  return { sizes: JSON.parse(readFileSync(SIZES_FILE, 'utf8')) as Sizes, fromJournal: true };
}

/** A small seeded generator: the same seed gives the same records. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const QUANTILES = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];

/** A size drawn from the quantiles (piecewise linear between them). */
function drawBytes(t: TypeSizes, u: number): number {
  for (let i = 1; i < QUANTILES.length; i++) {
    const q0 = QUANTILES[i - 1]!;
    const q1 = QUANTILES[i]!;
    if (u <= q1) {
      const b0 = t.bytes[i - 1]!;
      const b1 = t.bytes[i]!;
      return Math.round(b0 + ((u - q0) / (q1 - q0)) * (b1 - b0));
    }
  }
  return t.bytes[t.bytes.length - 1]!;
}

function uuid(r: () => number): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16));
  hex[12] = '4';
  hex[16] = '89ab'[Math.floor(r() * 4)]!;
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** Letters with a few accented ones (escapes: no non-Latin text in code). */
const LETTERS = 'abcdefghijklmnopqrstuvwxyz éèàç';

function word(r: () => number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += LETTERS[Math.floor(r() * LETTERS.length)];
  return s;
}

function nested(r: () => number, keys: number, iso: (ms: number) => string, at: number, review: boolean): Json {
  const out: Json = {};
  if (review) {
    out.dueBefore = iso(at - 86_400_000);
    out.nextDue = iso(at + 3 * 86_400_000);
  }
  for (let i = Object.keys(out).length; i < keys; i++) out[`n${String(i).padStart(2, '0')}`] = i % 3 === 0 ? Math.round(r() * 1000) / 100 : i % 3 === 1 ? Math.floor(r() * 10) : word(r, 4);
  return out;
}

export interface RecordOptions {
  userId: string;
  deviceId: string;
  /** Time of the record, ms UTC. */
  at: number;
  type: 'review' | 'intro' | 'drill';
  bytes: number;
  shape: TypeSizes;
}

/** One record of `type`, about `bytes` long as canonical JSON. */
export function makeRecord(r: () => number, o: RecordOptions): Json {
  const iso = (ms: number) => new Date(ms).toISOString();
  const base: Json = {
    id: uuid(r),
    type: o.type,
    userId: o.userId,
    deviceId: o.deviceId,
    deckId: 'bench-deck',
    entryId: `e${Math.floor(r() * 500)}`,
    at: iso(o.at),
    deckRevision: 3,
    sessionId: uuid(r),
  };
  if (o.type === 'intro') base.skill = null;
  else base.skill = 'speak';
  if (o.type === 'drill') base.reviewId = uuid(r);
  if (o.type === 'review') {
    base.final = 3;
    base.suggested = 3;
    base.rules = 2;
    base.fsrs = nested(r, o.shape.nestedKeys, iso, o.at, true);
  } else {
    base.meta = nested(r, o.shape.nestedKeys, iso, o.at, false);
  }
  base.alternatives = Array.from({ length: Math.max(1, o.shape.arrayItems) }, () => word(r, 7));
  base.answer = '';
  for (let i = Object.keys(base).length; i < o.shape.topKeys; i++) {
    base[`k${String(i).padStart(2, '0')}`] = i % 4 === 0 ? Math.floor(r() * 5000) : i % 4 === 1 ? r() < 0.5 : i % 4 === 2 ? Math.round(r() * 100000) / 1000 : word(r, 5);
  }
  const missing = o.bytes - utf8Bytes(canonicalJson(base));
  if (missing > 0) base.answer = word(r, missing);
  // Accented letters take two bytes: trim back to the size.
  while (utf8Bytes(canonicalJson(base)) > o.bytes && (base.answer as string).length > 0) base.answer = (base.answer as string).slice(0, -1);
  return base;
}

export interface Batch {
  records: Json[];
}

/** `count` records of the journal's mix of types, at times from `start` on (1 min apart). */
export function makeRecords(seed: number, count: number, userId: string, deviceId: string, start: number, sizes = loadSizes().sizes): Json[] {
  const r = rng(seed);
  const types = Object.entries(sizes.types).filter(([t]) => t === 'review' || t === 'intro' || t === 'drill') as ['review' | 'intro' | 'drill', TypeSizes][];
  const total = types.reduce((s, [, t]) => s + t.n, 0);
  const out: Json[] = [];
  for (let i = 0; i < count; i++) {
    let u = r() * total;
    let pick = types[0]!;
    for (const t of types) {
      if (u < t[1].n) {
        pick = t;
        break;
      }
      u -= t[1].n;
    }
    out.push(makeRecord(r, { userId, deviceId, at: start + i * 60_000, type: pick[0], bytes: drawBytes(pick[1], r()), shape: pick[1] }));
  }
  return out;
}

/** The journal row as the server stores it: canonical body and its SHA-256. */
export function storedRow(record: Json): { id: string; type: string; at: number; deviceId: string; deckId: string; entryId: string; rules: number | null; body: string; hash: string } {
  const body = canonicalJson(record);
  return {
    id: record.id as string,
    type: record.type as string,
    at: Date.parse(record.at as string),
    deviceId: record.deviceId as string,
    deckId: record.deckId as string,
    entryId: record.entryId as string,
    rules: record.type === 'review' ? (record.rules as number) : null,
    body,
    hash: createHash('sha256').update(body).digest('hex'),
  };
}
