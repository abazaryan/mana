/**
 * The bench's synthetic world (all labels test-local-cpu-…): accounts, invitations, codes,
 * sessions and journals as SQL for node:sqlite (node-cpu.ts; workerd-cpu.ts replays the D1
 * answers recorded there). Tokens and codes are made here; the database gets only their hashes,
 * as the real flow writes them.
 * And the requests of every scenario, the way the app sends them (src/platform/api.ts).
 */
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { NOTICE_VERSION } from '../../src/core/notice.ts';
import { CODE_ALPHABET } from '../../src/core/pairingCode.ts';
import { MIN_CLIENT, ORIGIN } from '../../worker/config.ts';
import { makeRecords, storedRow } from './records.ts';

type Json = Record<string, unknown>;

export const LABEL = 'test-local-cpu';
const DAY = 86_400_000;

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
const hmac = (pepper: string, message: string): string => createHmac('sha256', pepper).update(message).digest('hex');
const token = (): string => randomBytes(32).toString('base64url');
const code = (): string => Array.from(randomBytes(8), (b) => CODE_ALPHABET[b % 32]).join('');
const q = (v: string | number | null): string => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);

export interface Session {
  userId: string;
  deviceId: string;
  cookie: string;
}

export interface Fixtures {
  /** Account invitations: adult, marked under 16, with the device's local id (transfer). */
  accountInvites: string[];
  minorInvites: string[];
  localInvites: { token: string; localUserId: string }[];
  /** Device invitations (recover.ts) of `main`, the same with an earlier id; of `p40` (S) and of `old` (M). */
  deviceInvites: string[];
  formerInvites: { token: string; former: string }[];
  sInvites: string[];
  mInvites: string[];
  /** Pairing codes of `main`, the same with an earlier id; one wrong code per attempt is any random one. */
  codes: string[];
  formerCodes: { code: string; former: string }[];
  main: Session;
  pull: Record<'p0' | 'p40' | 'p200' | 'p500', Session>;
  /** Accounts with consent to an older notice: adult (v2), under 16 (v1, parent). */
  consentSelf: Session[];
  consentParent: Session[];
  /** Accounts with a large journal of tiny rows: erased by the route / marked for the Cron. */
  deletes: Session[];
  crons: string[];
}

export interface WorldOptions {
  pepper: string;
  /** Rows of each consumable kind (invitations, codes, consent accounts). */
  n: number;
  /** Accounts erased by the route (30 000 rows) and by the Cron (40 000 rows). */
  deletes?: number;
  crons?: number;
  now?: number;
}

/** The world as SQL statements and what the requests need. */
export function buildWorld(o: WorldOptions): { sql: string[]; fx: Fixtures } {
  const now = o.now ?? Date.now();
  const sql: string[] = [];
  const created = now - 30 * DAY;

  const user = (id: string, minor: 0 | 1, consent: { version: number; by: 'self' | 'parent' } | null, deviceId: string, marked = false) => {
    sql.push(`INSERT INTO users (id, label, minor, created_at, deleting_at) VALUES (${q(id)}, ${q(LABEL)}, ${minor}, ${created}, ${marked ? now - 60_000 : 'NULL'})`);
    if (consent) {
      const parent = consent.by === 'parent' ? q('Parent Name') : 'NULL';
      sql.push(`INSERT INTO consents (id, user_id, notice_version, given_by, parent_name, device_id, given_at) VALUES (${q(randomUUID())}, ${q(id)}, ${consent.version}, ${q(consent.by)}, ${parent}, ${q(deviceId)}, ${created})`);
    }
  };
  const device = (id: string, userId: string, revoked = false) =>
    sql.push(`INSERT INTO devices (id, user_id, name, created_at, last_seen_at, app_version, revoked_at) VALUES (${q(id)}, ${q(userId)}, 'Windows · Edge', ${created}, ${now}, ${MIN_CLIENT}, ${revoked ? created : 'NULL'})`);
  const session = (userId: string, deviceId: string): Session => {
    const t = token();
    sql.push(`INSERT INTO sessions (token_hash, user_id, device_id, created_at, last_used_at, expires_at) VALUES (${q(sha256(t))}, ${q(userId)}, ${q(deviceId)}, ${created}, ${now}, ${now + 180 * DAY})`);
    return { userId, deviceId, cookie: `__Host-mana_s=${t}` };
  };
  const settings = (userId: string, deviceId: string) => {
    const rows: [string, string][] = [['uiLang', '"tg"'], ['meaningLang', '"tg"'], ['newPerDay', '10']];
    rows.forEach(([key, value], i) =>
      sql.push(`INSERT INTO user_settings (user_id, key, value, server_rev, updated_at, device_id) VALUES (${q(userId)}, ${q(key)}, ${q(value)}, ${i + 1}, ${created}, ${q(deviceId)})`),
    );
  };
  /** A whole signed-in account: user, consent, device, session, settings. */
  const account = (minor: 0 | 1, consent: { version: number; by: 'self' | 'parent' } | null): Session => {
    const id = randomUUID();
    const dev = randomUUID();
    user(id, minor, consent, dev);
    device(dev, id);
    settings(id, dev);
    return session(id, dev);
  };
  const invite = (kind: 'account' | 'device', userId: string | null, minor: 0 | 1): string => {
    const t = token();
    sql.push(
      `INSERT INTO invites (token_hash, kind, user_id, label, minor, created_at, expires_at) VALUES (${q(sha256(t))}, ${q(kind)}, ${q(userId)}, ${kind === 'account' ? q(LABEL) : 'NULL'}, ${minor}, ${now}, ${now + 2 * DAY})`,
    );
    return t;
  };
  const pairingCode = (userId: string, deviceId: string): string => {
    const c = code();
    sql.push(`INSERT INTO pairing_codes (code_hash, user_id, created_by_device, created_at, expires_at) VALUES (${q(hmac(o.pepper, `pair:${c}`))}, ${q(userId)}, ${q(deviceId)}, ${now}, ${now + 2 * DAY})`);
    return c;
  };
  const journal = (s: Session, count: number, seed: number) => {
    for (const record of makeRecords(seed, count, s.userId, s.deviceId, now - 20 * DAY)) {
      const r = storedRow(record);
      sql.push(
        `INSERT INTO journal (user_id, id, type, at, device_id, deck_id, entry_id, rules, body, body_hash, received_at) VALUES (${q(s.userId)}, ${q(r.id)}, ${q(r.type)}, ${r.at}, ${q(r.deviceId)}, ${q(r.deckId)}, ${q(r.entryId)}, ${q(r.rules)}, ${q(r.body)}, ${q(r.hash)}, ${now - DAY})`,
      );
    }
  };
  /** `count` tiny rows (the erasure reads no bodies): generated inside SQLite. */
  const bigJournal = (userId: string, deviceId: string, count: number) =>
    sql.push(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${count})
       INSERT INTO journal (user_id, id, type, at, device_id, deck_id, entry_id, rules, body, body_hash, received_at)
       SELECT ${q(userId)}, 'big-' || i, 'review', ${created} + i, ${q(deviceId)}, 'bench-deck', 'e' || (i % 500), 2, '{"i":' || i || '}', 'h' || i, ${created} FROM n`,
    );

  const range = <T>(f: (i: number) => T): T[] => Array.from({ length: o.n }, (_, i) => f(i));

  const main = account(0, { version: NOTICE_VERSION, by: 'self' });
  const pull = {
    p0: account(0, { version: NOTICE_VERSION, by: 'self' }),
    p40: account(0, { version: NOTICE_VERSION, by: 'self' }),
    p200: account(0, { version: NOTICE_VERSION, by: 'self' }),
    p500: account(0, { version: NOTICE_VERSION, by: 'self' }),
  };
  journal(pull.p40, 40, 40);
  journal(pull.p200, 200, 200);
  journal(pull.p500, 500, 500);
  // M: an account under 16 whose only consent is to notice 1, by a parent (test-edge-minor).
  const old = account(1, { version: 1, by: 'parent' });

  const fx: Fixtures = {
    accountInvites: range(() => invite('account', null, 0)),
    minorInvites: range(() => invite('account', null, 1)),
    localInvites: range(() => ({ token: invite('account', null, 0), localUserId: randomUUID() })),
    deviceInvites: range(() => invite('device', main.userId, 0)),
    formerInvites: range(() => ({ token: invite('device', main.userId, 0), former: randomUUID() })),
    sInvites: range(() => invite('device', pull.p40.userId, 0)),
    mInvites: range(() => invite('device', old.userId, 0)),
    codes: range(() => pairingCode(main.userId, main.deviceId)),
    formerCodes: range(() => ({ code: pairingCode(main.userId, main.deviceId), former: randomUUID() })),
    main,
    pull,
    consentSelf: range(() => account(0, { version: 2, by: 'self' })),
    consentParent: range(() => account(1, { version: 1, by: 'parent' })),
    deletes: [],
    crons: [],
  };
  for (let i = 0; i < (o.deletes ?? 0); i++) {
    const s = account(0, { version: NOTICE_VERSION, by: 'self' });
    bigJournal(s.userId, s.deviceId, 30_000);
    fx.deletes.push(s);
  }
  for (let i = 0; i < (o.crons ?? 0); i++) {
    const id = randomUUID();
    const dev = randomUUID();
    user(id, 0, { version: NOTICE_VERSION, by: 'self' }, dev, true);
    device(dev, id, true);
    bigJournal(id, dev, 40_000);
    fx.crons.push(id);
  }
  return { sql, fx };
}

/** A request as the app sends it: method, path, headers, body text. */
export interface Call {
  method: 'GET' | 'POST';
  path: string;
  headers: Record<string, string>;
  body?: string;
}

function call(method: 'GET' | 'POST', path: string, body?: unknown, cookie?: string): Call {
  const headers: Record<string, string> = { Origin: ORIGIN, 'X-Mana-Version': String(MIN_CLIENT), 'X-Mana-Profile': '1' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  return { method, path, headers, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) };
}

const newDevice = () => ({ id: randomUUID(), name: 'Windows · Edge' });
const SELF = { version: NOTICE_VERSION, by: 'self' };
const PARENT = { version: NOTICE_VERSION, by: 'parent', parentName: 'Parent Name', parentAgreed: true };
const SETTINGS_INIT = [
  { key: 'uiLang', value: 'tg', mode: 'init' },
  { key: 'meaningLang', value: 'tg', mode: 'init' },
  { key: 'newPerDay', value: 10, mode: 'init' },
];

export const invite = (t: string) => call('POST', '/api/auth/invite', { token: t });
export const redeem = (t: string, extra: Json = {}) => call('POST', '/api/auth/redeem', { token: t, device: newDevice(), ...extra });
export const pair = (c: string, extra: Json = {}) => call('POST', '/api/auth/pair', { code: c, device: newDevice(), ...extra });
export const me = (cookie: string) => call('GET', '/api/auth/me', undefined, cookie);
export const consent = (cookie: string, parent: boolean) => call('POST', '/api/auth/consent', { consent: parent ? PARENT : SELF }, cookie);
export const pull = (cookie: string, after = 0, limit = 500) => call('GET', `/api/sync/pull?after=${after}&limit=${limit}`, undefined, cookie);
/** A push as nextBatch builds it: records as JSON.stringify writes them, settings with the first batch. */
export const push = (cookie: string, records: readonly Json[], withSettings: boolean) =>
  call('POST', '/api/sync/push', `{"records":[${records.map((r) => JSON.stringify(r)).join(',')}]${withSettings ? `,"settings":${JSON.stringify(SETTINGS_INIT)}` : ''}}`, cookie);
export const erase = (cookie: string) => call('POST', '/api/account/delete', { confirm: 'delete' }, cookie);
export const consentBody = { self: SELF, parent: PARENT };

/** Cookie of the session a sign-in answer sets (first part of Set-Cookie). */
export function cookieFrom(setCookie: string | null): string | null {
  return setCookie ? setCookie.split(';')[0]! : null;
}

/** Fresh records for a push of `count`, unique per (seed). */
export function freshRecords(seed: number, count: number, userId: string, deviceId: string, now = Date.now()): Json[] {
  return makeRecords(seed, count, userId, deviceId, now - 3 * DAY + seed * 1000);
}
