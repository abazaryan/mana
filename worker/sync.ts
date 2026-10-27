/**
 * Sync of the journal and the settings (stage 6a.3, R33 item 8, R39; STAGE6_RESEARCH 5.1–5.3,
 * 5.10). The server keeps each record as canonical JSON with its SHA-256; FSRS is never
 * computed here (cards are derived on the devices, R10).
 *
 * The number of D1 queries does not grow with a push: all records go in one JSON parameter
 * (json_each), so a push is the session read, the consent check and one batch of at most six
 * statements. Both routes need the account's consent to the current notice (403 otherwise).
 */
import { checkPushed, type RecordProblem, type StoredRecord } from '../src/core/journalRecord.ts';
import {
  isSyncedSetting,
  PULL_MAX,
  PUSH_MAX_RECORDS,
  validSetting,
  type PushResponse,
  type ServerSettings,
  type SettingChange,
} from '../src/core/syncProtocol.ts';
import { hasConsent } from './aliases.ts';
import type { Call } from './api.ts';
import { withSession } from './auth.ts';
import { PUSH_USES_RETURNING } from './config.ts';
import { API_HEADERS, error, json } from './http.ts';
import type { Session } from './session.ts';
import { sha256Hex } from './tokens.ts';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

const noConsent = () => error('consent_required', 403);

/** Settings changes in one push: a few keys, each once at most. */
const MAX_SETTINGS = 10;

interface Row extends StoredRecord {
  hash: string;
}

const INSERT_RECORDS = `INSERT INTO journal (user_id, id, type, at, device_id, deck_id, entry_id, rules, body, body_hash, received_at)
  SELECT ?1, json_extract(j.value, '$.id'), json_extract(j.value, '$.type'), json_extract(j.value, '$.at'),
    json_extract(j.value, '$.deviceId'), json_extract(j.value, '$.deckId'), json_extract(j.value, '$.entryId'),
    json_extract(j.value, '$.rules'), json_extract(j.value, '$.body'), json_extract(j.value, '$.hash'), ?3
  FROM json_each(?2) AS j WHERE true
  ON CONFLICT (user_id, id) DO NOTHING`;

const STORED_HASHES = `SELECT t.id AS id, t.body_hash AS hash FROM json_each(?2) AS j
  JOIN journal t ON t.user_id = ?1 AND t.id = json_extract(j.value, '$.id')`;

/** The settings rows of one push; the change number is the account's next one, given in the writing transaction. */
function settingsStatement(db: D1Database, mode: 'set' | 'init', userId: string, changes: string, now: number, deviceId: string) {
  const onConflict = mode === 'set' ? 'DO UPDATE SET value = excluded.value, server_rev = excluded.server_rev, updated_at = excluded.updated_at, device_id = excluded.device_id' : 'DO NOTHING';
  return db
    .prepare(
      `INSERT INTO user_settings (user_id, key, value, server_rev, updated_at, device_id)
       SELECT ?1, json_extract(j.value, '$.key'), json_extract(j.value, '$.value'),
         (SELECT COALESCE(MAX(server_rev), 0) + 1 FROM user_settings WHERE user_id = ?1), ?3, ?4
       FROM json_each(?2) AS j WHERE true
       ON CONFLICT (user_id, key) ${onConflict}`,
    )
    .bind(userId, changes, now, deviceId);
}

function readSettings(db: D1Database, userId: string) {
  return db.prepare('SELECT key, value, server_rev FROM user_settings WHERE user_id = ?').bind(userId);
}

/** Settings rows as the answer carries them; a key this server does not know is left out. */
function settingsOf(rows: readonly Json[]): ServerSettings {
  const out: ServerSettings = {};
  for (const row of rows) {
    if (isSyncedSetting(row.key) && typeof row.value === 'string') out[row.key] = { value: JSON.parse(row.value) as unknown, rev: Number(row.server_rev) };
  }
  return out;
}

/** The settings part of a push: valid changes by mode (the last of a key wins), and the refused keys. */
function readSettingChanges(value: unknown): { set: Json[]; init: Json[]; rejected: string[] } | null {
  if (value === undefined) return { set: [], init: [], rejected: [] };
  if (!Array.isArray(value) || value.length > MAX_SETTINGS) return null;
  const byKey = new Map<string, SettingChange>();
  const rejected: string[] = [];
  for (const item of value) {
    if (!isObject(item) || (item.mode !== 'set' && item.mode !== 'init')) return null;
    const key = String(item.key);
    if (!isSyncedSetting(item.key) || !validSetting(item.key, item.value)) {
      rejected.push(key);
      continue;
    }
    byKey.set(key, { key: item.key, value: item.value, mode: item.mode });
  }
  const row = (c: SettingChange): Json => ({ key: c.key, value: JSON.stringify(c.value) });
  const all = [...byKey.values()];
  return { set: all.filter((c) => c.mode === 'set').map(row), init: all.filter((c) => c.mode === 'init').map(row), rejected };
}

/**
 * The records of a push, checked: what to store, what is refused, and the ids sent twice with
 * different content — all of those are conflicts and none of them is stored (R39).
 */
async function readRecords(list: readonly unknown[], session: Session, now: number) {
  const rejected: { id: string | null; reason: RecordProblem }[] = [];
  const byId = new Map<string, Row>();
  const twice = new Set<string>();
  for (const v of list) {
    const check = checkPushed(v, session.userId, now);
    if (!check.ok) {
      rejected.push({ id: check.id, reason: check.reason });
      continue;
    }
    const row: Row = { ...check.record, hash: await sha256Hex(check.record.body) };
    const seen = byId.get(row.id);
    if (seen && seen.hash !== row.hash) twice.add(row.id);
    else byId.set(row.id, row);
  }
  for (const id of twice) byId.delete(id);
  return { rows: [...byId.values()], rejected, twice: [...twice] };
}

/**
 * POST /api/sync/push {records, settings?} — one batch, one transaction: either everything of
 * this push is stored or nothing (a repeat is safe: duplicates). Each record gets its outcome.
 * `returning` — see PUSH_USES_RETURNING; both ways are tested.
 */
export const makePush = (returning: boolean) => withSession(async ({ env, body, now }: Call, session) => {
  const db = env.DB;
  if (!(await hasConsent(db, session.userId))) return noConsent();
  if (!isObject(body) || !Array.isArray(body.records) || body.records.length > PUSH_MAX_RECORDS) return error('bad_request', 400);
  const settings = readSettingChanges(body.settings);
  if (!settings) return error('bad_request', 400);
  const { rows, rejected, twice } = await readRecords(body.records, session, now);

  const param = JSON.stringify(rows);
  const statements: D1PreparedStatement[] = [];
  let existing = -1;
  let inserted = -1;
  if (rows.length > 0) {
    if (!returning) existing = statements.push(db.prepare(STORED_HASHES).bind(session.userId, param)) - 1;
    inserted = statements.push(db.prepare(returning ? `${INSERT_RECORDS} RETURNING id` : INSERT_RECORDS).bind(session.userId, param, now)) - 1;
  }
  const hashes = rows.length > 0 ? statements.push(db.prepare(STORED_HASHES).bind(session.userId, param)) - 1 : -1;
  if (settings.set.length > 0) statements.push(settingsStatement(db, 'set', session.userId, JSON.stringify(settings.set), now, session.deviceId));
  if (settings.init.length > 0) statements.push(settingsStatement(db, 'init', session.userId, JSON.stringify(settings.init), now, session.deviceId));
  const read = statements.push(readSettings(db, session.userId)) - 1;
  const results = await db.batch<Json>(statements);

  const ids = (i: number) => new Set((results[i]?.results ?? []).map((r) => String(r.id)));
  const stored = new Map((hashes < 0 ? [] : results[hashes]!.results).map((r) => [String(r.id), String(r.hash)]));
  const before = returning ? null : ids(existing);
  const fresh = returning ? ids(inserted) : null;
  const out: PushResponse = { stored: [], duplicate: [], conflict: [...twice], rejected, settings: settingsOf(results[read]!.results), settingsRejected: settings.rejected, serverTime: now };
  for (const row of rows) {
    if (stored.get(row.id) !== row.hash) out.conflict.push(row.id);
    else if (fresh ? fresh.has(row.id) : !before!.has(row.id)) out.stored.push(row.id);
    else out.duplicate.push(row.id);
  }
  return json(out);
});

export const push = makePush(PUSH_USES_RETURNING);

/** A whole number from the query, `fallback` if absent; null if malformed or outside min…max. */
export function queryInt(params: URLSearchParams, name: string, fallback: number, min: number, max: number): number | null {
  const raw = params.get(name);
  if (raw === null) return fallback;
  if (!/^\d{1,15}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= min && n <= max ? n : null;
}

/**
 * A page size from the query: `max` when absent or larger (an older app asks more and follows
 * `more`); null if malformed or below 1.
 */
export function queryLimit(params: URLSearchParams, max: number): number | null {
  const n = queryInt(params, 'limit', max, 1, Number.MAX_SAFE_INTEGER);
  return n === null ? null : Math.min(n, max);
}

/**
 * GET /api/sync/pull?after=<seq>&limit=<n> — the account's records after the cursor, in seq
 * order, and every synced setting. Bodies go out as stored, without being parsed (CPU).
 */
export const pull = withSession(async ({ request, env, now }: Call, session) => {
  if (!(await hasConsent(env.DB, session.userId))) return noConsent();
  const params = new URL(request.url).searchParams;
  const after = queryInt(params, 'after', 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = queryLimit(params, PULL_MAX);
  if (after === null || limit === null) return error('bad_request', 400);
  const [records, settings] = await env.DB.batch<Json>([
    env.DB.prepare('SELECT seq, body FROM journal WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?').bind(session.userId, after, limit + 1),
    readSettings(env.DB, session.userId),
  ]);
  const page = records!.results.slice(0, limit);
  const more = records!.results.length > limit;
  const next = page.length > 0 ? Number(page[page.length - 1]!.seq) : after;
  const tail = JSON.stringify({ next, more, settings: settingsOf(settings!.results), serverTime: now }).slice(1);
  const text = `{"records":[${page.map((r) => String(r.body)).join(',')}],${tail}`;
  return new Response(text, { status: 200, headers: new Headers(API_HEADERS) });
});
