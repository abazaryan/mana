/**
 * Sign-in routes (stage 6a.2, R33 items 4–5, R37; STAGE6_RESEARCH 3.1–3.4, 7.3). Passwordless:
 * an invitation link creates an account and its first device; a pairing code from a signed-in
 * device adds another one. One answer for a wrong, expired or used invitation or code.
 *
 * The retry window (step "CPU of sign-in routes", 27.10.2026): an answer lost after the batch was
 * written (a 1102 or a 503) leaves the invitation or the code used and the device without a session.
 * The same device may use them again for RETRY_WINDOW: a new session replaces its earlier one,
 * nothing else is written, and it is no failed attempt — only if the retry matches what the first
 * attempt wrote (the same local id or a known earlier id, the same consent); otherwise invalid.
 *
 * Stage 6a.4 (R40): a device with answers names its local user. An account invitation takes it as
 * the new account's id (`localUserId`); a device invitation and a code add it as an earlier id of
 * the account (`formerUserId`). Taken by another account — 409 user_taken, and the invitation or
 * the code stays unused: the guard sits in the statement that marks it used.
 */
import { NOTICE_VERSION } from '../src/core/notice.ts';
import { normalizeCode } from '../src/core/pairingCode.ts';
import { aliasesOf, aliasesStatement, aliasStatus, CONSENT_OF_U, freeClause, freeForAccount, hasConsent, isKeyClash, isLocalUserId } from './aliases.ts';
import type { Call } from './api.ts';
import { ipBucket, recordFailure, waitBeforeAttempt } from './attempts.ts';
import { CODE_TTL, RETRY_WINDOW, SESSION_IDLE } from './config.ts';
import { clientBuild } from './guards.ts';
import { error, json } from './http.ts';
import { profileFrom } from './profile.ts';
import { clearCookie, getSession, newSessionToken, setCookie, type Session } from './session.ts';
import { isToken, isUuid, newPairingCode, pepperedHex, sameHash, sha256Hex } from './tokens.ts';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Longest device name and parent's name, in characters. */
export const DEVICE_NAME_MAX = 40;
export const PARENT_NAME_MAX = 100;

/**
 * A name typed by a person: spaces collapsed, 1…max characters, no control or bidi-override
 * characters (a zero-width non-joiner of Persian script stays). Otherwise null.
 */
export function cleanName(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name === '' || [...name].length > max) return null;
  if (/[\p{Cc}‪-‮⁦-⁩]/u.test(name)) return null;
  return name;
}

interface DeviceInput {
  id: string;
  name: string;
}

function readDevice(value: unknown): DeviceInput | null {
  if (!isObject(value) || !isUuid(value.id)) return null;
  const name = cleanName(value.name, DEVICE_NAME_MAX);
  return name === null ? null : { id: value.id.toLowerCase(), name };
}

/** The Worker secret for code and IP hashes (R37 item 3); without it these routes answer 500. */
function pepperOf(env: Env): string {
  const pepper = (env as Env & { AUTH_PEPPER?: string }).AUTH_PEPPER;
  if (!pepper) throw new Error('AUTH_PEPPER is not set');
  return pepper;
}

const invalid = () => error('invalid', 400);
const userTaken = () => error('user_taken', 409);
const noConsent = () => error('consent_required', 403);

function unauthorized(headers: Headers): Response {
  const profile = profileFrom(headers);
  return error('unauthorized', 401, profile === null ? undefined : { 'Set-Cookie': clearCookie(profile) });
}

type SessionHandler = (call: Call, session: Session) => Promise<Response>;

/** Routes for a signed-in device: 401 without a live session; a renewed cookie rides along. */
export function withSession(handler: SessionHandler): (call: Call) => Promise<Response> {
  return async (call) => {
    const session = await getSession(call.env.DB, call.request.headers, call.now);
    if (!session) return unauthorized(call.request.headers);
    const response = await handler(call, session);
    if (session.cookie && !response.headers.has('Set-Cookie')) response.headers.set('Set-Cookie', session.cookie);
    return response;
  };
}

/** Who owns a device id now (null — nobody): one id belongs to one account. */
async function deviceOwner(db: D1Database, id: string): Promise<string | null> {
  return (await db.prepare('SELECT user_id FROM devices WHERE id = ?').bind(id).first<string>('user_id')) ?? null;
}

/**
 * The device row, only if `guard` holds (this request won the invitation or the code): a new
 * row, or the same account's earlier one back from revoked — with the name it has (R42 item 11:
 * a name the person gave is not replaced by the default one a sign-in sends).
 */
function upsertDevice(db: D1Database, guard: string, guardArgs: unknown[], device: DeviceInput, userId: string, now: number, build: number | null) {
  return db
    .prepare(
      `INSERT INTO devices (id, user_id, name, created_at, last_seen_at, app_version, revoked_at)
       SELECT ?, ?, ?, ?, ?, ?, NULL WHERE ${guard}
       ON CONFLICT (id) DO UPDATE SET last_seen_at = excluded.last_seen_at,
         app_version = excluded.app_version, revoked_at = NULL
       WHERE devices.user_id = excluded.user_id`,
    )
    .bind(device.id, userId, device.name, now, now, build, ...guardArgs);
}

/** The device's name as stored, read last in the sign-in batch. */
function storedName(db: D1Database, deviceId: string, userId: string) {
  return db.prepare('SELECT name FROM devices WHERE id = ? AND user_id = ?').bind(deviceId, userId);
}

const nameFrom = (result: D1Result | undefined, fallback: string): string => {
  const name = (result?.results[0] as { name?: unknown } | undefined)?.name;
  return typeof name === 'string' ? name : fallback;
};

function insertSession(db: D1Database, guard: string, guardArgs: unknown[], tokenHash: string, userId: string, deviceId: string, now: number) {
  return db
    .prepare(
      `INSERT INTO sessions (token_hash, user_id, device_id, created_at, last_used_at, expires_at)
       SELECT ?, ?, ?, ?, ?, ? WHERE ${guard}
         AND EXISTS (SELECT 1 FROM devices WHERE id = ? AND user_id = ? AND revoked_at IS NULL)`,
    )
    .bind(tokenHash, userId, deviceId, now, now, now + SESSION_IDLE, ...guardArgs, deviceId, userId);
}

/** The earlier id, only if `guard` holds; an id the account already has is left as it is. */
function insertAlias(db: D1Database, guard: string, guardArgs: unknown[], userId: string, aliasId: string, now: number) {
  return db
    .prepare(`INSERT INTO user_aliases (user_id, alias_id, added_at) SELECT ?, ?, ? WHERE ${guard} ON CONFLICT (user_id, alias_id) DO NOTHING`)
    .bind(userId, aliasId, now, ...guardArgs);
}

/** What to do with a device's earlier id for `account`: refuse, write it, or nothing to write. */
async function formerIdPlan(db: D1Database, id: string, account: string): Promise<Response | 'add' | 'none'> {
  const status = await aliasStatus(db, id, account);
  if (status === 'taken') return userTaken();
  if (status !== 'free') return 'none';
  // A new earlier id is new data of the account: only with consent to the current notice (R40).
  return (await hasConsent(db, account)) ? 'add' : noConsent();
}

async function signedIn(db: D1Database, profile: number, token: string, userId: string, device: DeviceInput): Promise<Response> {
  return json({ userId, device, formerUserIds: await aliasesOf(db, userId) }, 200, { 'Set-Cookie': setCookie(profile, token) });
}

/**
 * SQL: the row (invitation or code) can be used now — unused and not expired — or this device used it
 * within the retry window. Parameters: now, the device id (null — none), now − RETRY_WINDOW.
 */
const USABLE = '((used_at IS NULL AND expires_at > ?) OR (used_device_id = ? AND used_at >= ?))';

/** SQL guard of a retry batch: this device used the row (by its hash) within the window. */
const usedByDevice = (table: 'invites' | 'pairing_codes', key: 'token_hash' | 'code_hash') =>
  `EXISTS (SELECT 1 FROM ${table} WHERE ${key} = ? AND used_device_id = ? AND used_at >= ?)`;

/** POST /api/auth/invite {token, deviceId?} — what the invitation is, without using it (also to the device that used it, within the window). */
export async function inviteInfo({ env, body, now }: Call): Promise<Response> {
  if (!isObject(body) || (body.deviceId !== undefined && !isUuid(body.deviceId))) return error('bad_request', 400);
  if (!isToken(body.token)) return invalid();
  const hash = await sha256Hex(body.token);
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.toLowerCase() : null;
  const row = await env.DB.prepare(`SELECT token_hash, kind, minor FROM invites WHERE token_hash = ? AND ${USABLE}`)
    .bind(hash, now, deviceId, now - RETRY_WINDOW)
    .first<{ token_hash: string; kind: 'account' | 'device'; minor: number }>();
  if (!row || !sameHash(row.token_hash, hash)) return invalid();
  return json({ kind: row.kind, minor: row.minor === 1 });
}

interface ConsentInput {
  version: unknown;
  by: unknown;
  parentName: string | null;
  parentAgreed: unknown;
}

/** Who agreed to the current notice in this input: the person, a parent or guardian with a name, or nobody. */
function consentBy(consent: ConsentInput | null): 'self' | 'parent' | null {
  if (!consent || consent.version !== NOTICE_VERSION) return null;
  if (consent.by === 'self') return 'self';
  return consent.by === 'parent' && consent.parentName !== null && consent.parentAgreed === true ? 'parent' : null;
}

/** The device's earlier id is the account itself or already one of its earlier ids (nothing to write). */
async function formerIdKnown(db: D1Database, id: string, account: string): Promise<boolean> {
  const status = await aliasStatus(db, id, account);
  return status === 'same' || status === 'known';
}

/**
 * The retry batch: this device's sessions go and a new one comes — only while `guard` holds (the
 * device used the row within the window), the device is the account's and not signed out, and the
 * account is not being erased. Nothing else is written.
 */
async function signInAgain(db: D1Database, headers: Headers, profile: number, userId: string, device: DeviceInput, guard: string, guardArgs: unknown[], now: number): Promise<Response> {
  const ok = `${guard} AND EXISTS (SELECT 1 FROM devices WHERE id = ? AND user_id = ? AND revoked_at IS NULL) AND EXISTS (SELECT 1 FROM users WHERE id = ? AND deleting_at IS NULL)`;
  const okArgs = [...guardArgs, device.id, userId, userId];
  const session = await newSessionToken();
  const results = await db.batch([
    db.prepare(`DELETE FROM sessions WHERE device_id = ? AND ${ok}`).bind(device.id, ...okArgs),
    db
      .prepare(`INSERT INTO sessions (token_hash, user_id, device_id, created_at, last_used_at, expires_at) SELECT ?, ?, ?, ?, ?, ? WHERE ${ok} RETURNING token_hash`)
      .bind(session.hash, userId, device.id, now, now, now + SESSION_IDLE, ...okArgs),
    db.prepare(`UPDATE devices SET last_seen_at = ?, app_version = ? WHERE id = ? AND ${ok}`).bind(now, clientBuild(headers), device.id, ...okArgs),
    storedName(db, device.id, userId),
  ]);
  if (results[1]?.results.length !== 1) return invalid();
  return signedIn(db, profile, session.token, userId, { id: device.id, name: nameFrom(results.at(-1), device.name) });
}

interface UsedInvite {
  kind: 'account' | 'device';
  user_id: string | null;
}

/**
 * A retry of redeem by the device that used the invitation (within the window). It passes only if
 * it matches the first attempt: account — no localUserId or the account's id (which a localUserId
 * became), and the consent given by the same person as then; device — no formerUserId, or the
 * account itself, or already its earlier id. Anything else: invalid, nothing written.
 */
async function redeemAgain(db: D1Database, headers: Headers, profile: number, tokenHash: string, invite: UsedInvite, body: Json, consent: ConsentInput | null, device: DeviceInput, now: number): Promise<Response> {
  const userId = invite.user_id;
  if (!userId) return invalid();
  if (invite.kind === 'account') {
    if (body.formerUserId !== undefined) return error('bad_request', 400);
    if (body.localUserId !== undefined && body.localUserId !== userId) return invalid();
    const first = await db.prepare('SELECT given_by FROM consents WHERE user_id = ? AND device_id = ? ORDER BY given_at LIMIT 1').bind(userId, device.id).first<string>('given_by');
    const by = consentBy(consent);
    if (by === null || by !== first) return invalid();
  } else {
    if (body.localUserId !== undefined) return error('bad_request', 400);
    if (body.formerUserId !== undefined && !(await formerIdKnown(db, body.formerUserId as string, userId))) return invalid();
  }
  return signInAgain(db, headers, profile, userId, device, usedByDevice('invites', 'token_hash'), [tokenHash, device.id, now - RETRY_WINDOW], now);
}

/** The invitation as this device used it within the window, or null. */
function usedInvite(db: D1Database, tokenHash: string, deviceId: string, now: number) {
  return db
    .prepare('SELECT kind, user_id FROM invites WHERE token_hash = ? AND used_device_id = ? AND used_at >= ?')
    .bind(tokenHash, deviceId, now - RETRY_WINDOW)
    .first<UsedInvite>();
}

/**
 * POST /api/auth/redeem {token, device, consent?, localUserId? | formerUserId?} — uses the invitation. One batch: the
 * invitation is marked used only by the request whose redeem_id lands; every other statement
 * runs only for that request, so a second attempt with the same token creates nothing, and a
 * failure anywhere keeps nothing (the invitation stays unused).
 */
export async function redeem({ request, env, body, now }: Call): Promise<Response> {
  const db = env.DB;
  const profile = profileFrom(request.headers);
  if (!isObject(body) || profile === null) return error('bad_request', 400);
  const device = readDevice(body.device);
  if (!device || (body.consent !== undefined && !isObject(body.consent))) return error('bad_request', 400);
  if ((body.localUserId !== undefined && !isLocalUserId(body.localUserId)) || (body.formerUserId !== undefined && !isLocalUserId(body.formerUserId))) {
    return error('bad_request', 400);
  }
  const consent: ConsentInput | null = isObject(body.consent)
    ? {
        version: body.consent.version,
        by: body.consent.by,
        parentName: cleanName(body.consent.parentName, PARENT_NAME_MAX),
        parentAgreed: body.consent.parentAgreed,
      }
    : null;
  if (await getSession(db, request.headers, now)) return error('already_signed_in', 409);
  if (!isToken(body.token)) return invalid();
  const tokenHash = await sha256Hex(body.token);
  const invite = await db
    .prepare(`SELECT token_hash, kind, user_id, minor, used_at FROM invites WHERE token_hash = ? AND ${USABLE}`)
    .bind(tokenHash, now, device.id, now - RETRY_WINDOW)
    .first<{ token_hash: string; kind: 'account' | 'device'; user_id: string | null; minor: number; used_at: number | null }>();
  if (!invite || !sameHash(invite.token_hash, tokenHash)) return invalid();
  if (invite.used_at !== null) return redeemAgain(db, request.headers, profile, tokenHash, invite, body, consent, device, now);

  const account = invite.kind === 'account';
  // localUserId names a new account, formerUserId an earlier id of an existing one.
  if (account ? body.formerUserId !== undefined : body.localUserId !== undefined) return error('bad_request', 400);
  const local = account ? (body.localUserId as string | undefined) : undefined;
  const former = account ? undefined : (body.formerUserId as string | undefined);
  let minor = 0;
  if (account) {
    const byParent = consent?.by === 'parent' && consent.parentName !== null && consent.parentAgreed === true;
    const agreed = consent !== null && consent.version === NOTICE_VERSION && (consent.by === 'self' || byParent);
    // Under 16 by the invitation: only a parent's or guardian's consent counts.
    if (!agreed || (invite.minor === 1 && !byParent)) return error('consent_required', 400);
    // Under 16 by the invitation or by the answer "no" to the age question.
    minor = invite.minor === 1 || byParent ? 1 : 0;
  }
  const userId = account ? (local ?? crypto.randomUUID()) : invite.user_id!;
  if (local !== undefined && !(await freeForAccount(db, local))) return userTaken();
  let addAlias = false;
  if (former !== undefined) {
    const plan = await formerIdPlan(db, former, userId);
    if (plan instanceof Response) return plan;
    addAlias = plan === 'add';
  }
  // The user is checked first: a device that was in another account is told so (user_taken).
  const owner = await deviceOwner(db, device.id);
  if (owner !== null && owner !== userId) return error('device_taken', 409);

  const redeemId = crypto.randomUUID();
  const mine = 'EXISTS (SELECT 1 FROM invites WHERE token_hash = ? AND redeem_id = ?)';
  const mineArgs = [tokenHash, redeemId];
  const session = await newSessionToken();
  const free = local !== undefined ? freeClause(local, null) : former !== undefined ? freeClause(former, userId) : null;
  const statements = [
    db
      .prepare(
        `UPDATE invites SET used_at = ?, used_device_id = ?, redeem_id = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?${free ? ` AND ${free.sql}` : ''} RETURNING kind`,
      )
      .bind(now, device.id, redeemId, tokenHash, now, ...(free?.args ?? [])),
  ];
  if (account) {
    statements.push(
      db.prepare('INSERT INTO users (id, label, minor, created_at) SELECT ?, label, ?, ? FROM invites WHERE token_hash = ? AND redeem_id = ?').bind(
        userId,
        minor,
        now,
        tokenHash,
        redeemId,
      ),
      db.prepare('UPDATE invites SET user_id = ? WHERE token_hash = ? AND redeem_id = ?').bind(userId, tokenHash, redeemId),
    );
  }
  statements.push(upsertDevice(db, mine, mineArgs, device, userId, now, clientBuild(request.headers)));
  if (account) {
    const byParent = consent!.by === 'parent';
    statements.push(
      db
        .prepare(
          `INSERT INTO consents (id, user_id, notice_version, given_by, parent_name, device_id, given_at)
           SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${mine}`,
        )
        .bind(crypto.randomUUID(), userId, NOTICE_VERSION, byParent ? 'parent' : 'self', byParent ? consent!.parentName : null, device.id, now, ...mineArgs),
    );
  }
  if (addAlias) statements.push(insertAlias(db, mine, mineArgs, userId, former!, now));
  statements.push(insertSession(db, mine, mineArgs, session.hash, userId, device.id, now), storedName(db, device.id, userId));
  let results: D1Result[];
  try {
    results = await db.batch(statements);
  } catch (e) {
    if (free && isKeyClash(e)) return userTaken();
    throw e;
  }
  if (results[0]?.results.length !== 1) {
    // Not marked used: this device used it meanwhile (another tab — a retry), gone, or the id was taken meanwhile (the guard).
    const again = await usedInvite(db, tokenHash, device.id, now);
    if (again) return redeemAgain(db, request.headers, profile, tokenHash, again, body, consent, device, now);
    if (local !== undefined && !(await freeForAccount(db, local))) return userTaken();
    if (former !== undefined && (await aliasStatus(db, former, userId)) === 'taken') return userTaken();
    return invalid();
  }
  return signedIn(db, profile, session.token, userId, { id: device.id, name: nameFrom(results.at(-1), device.name) });
}

/** POST /api/auth/pair {code, device, formerUserId?} — a new device by a code from a signed-in one. */
export async function pair({ request, env, body, now }: Call): Promise<Response> {
  const db = env.DB;
  const profile = profileFrom(request.headers);
  if (!isObject(body) || profile === null || typeof body.code !== 'string') return error('bad_request', 400);
  const device = readDevice(body.device);
  if (!device || (body.formerUserId !== undefined && !isLocalUserId(body.formerUserId))) return error('bad_request', 400);
  const former = body.formerUserId as string | undefined;
  if (await getSession(db, request.headers, now)) return error('already_signed_in', 409);
  const pepper = pepperOf(env);
  const bucket = await ipBucket(pepper, request.headers);
  const wait = await waitBeforeAttempt(db, bucket, now);
  if (wait > 0) return error('too_many_requests', 429, { 'Retry-After': String(Math.ceil(wait / 1000)) });

  const code = normalizeCode(body.code);
  const codeHash = code === null ? null : await pepperedHex(pepper, `pair:${code}`);
  const row =
    codeHash === null
      ? null
      : await db
          .prepare(`SELECT code_hash, user_id, used_at FROM pairing_codes WHERE code_hash = ? AND ${USABLE}`)
          .bind(codeHash, now, device.id, now - RETRY_WINDOW)
          .first<{ code_hash: string; user_id: string; used_at: number | null }>();
  if (!row || codeHash === null || !sameHash(row.code_hash, codeHash)) {
    await recordFailure(db, bucket, now);
    return invalid();
  }
  // The device that used this code, within the window: a retry, no failed attempt either way.
  if (row.used_at !== null) return pairAgain(db, request.headers, profile, codeHash, row.user_id, former, device, now);
  // The code is right from here on: a refusal below is no failed attempt, and the code stays unused.
  let addAlias = false;
  if (former !== undefined) {
    const plan = await formerIdPlan(db, former, row.user_id);
    if (plan instanceof Response) return plan;
    addAlias = plan === 'add';
  }
  const owner = await deviceOwner(db, device.id);
  if (owner !== null && owner !== row.user_id) return error('device_taken', 409);

  const mine = 'EXISTS (SELECT 1 FROM pairing_codes WHERE code_hash = ? AND used_at = ? AND used_device_id = ?)';
  const mineArgs = [codeHash, now, device.id];
  const session = await newSessionToken();
  const free = former !== undefined ? freeClause(former, row.user_id) : null;
  const statements = [
    db
      .prepare(
        `UPDATE pairing_codes SET used_at = ?, used_device_id = ? WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?${free ? ` AND ${free.sql}` : ''} RETURNING user_id`,
      )
      .bind(now, device.id, codeHash, now, ...(free?.args ?? [])),
    upsertDevice(db, mine, mineArgs, device, row.user_id, now, clientBuild(request.headers)),
  ];
  if (addAlias) statements.push(insertAlias(db, mine, mineArgs, row.user_id, former!, now));
  statements.push(insertSession(db, mine, mineArgs, session.hash, row.user_id, device.id, now), storedName(db, device.id, row.user_id));
  let results: D1Result[];
  try {
    results = await db.batch(statements);
  } catch (e) {
    if (free && isKeyClash(e)) return userTaken();
    throw e;
  }
  if (results[0]?.results.length !== 1) {
    // Not marked used: this device used it meanwhile (another tab — a retry), or the earlier id was taken meanwhile.
    if (await pairingCodeUsedBy(db, codeHash, device.id, now)) return pairAgain(db, request.headers, profile, codeHash, row.user_id, former, device, now);
    if (former !== undefined && (await aliasStatus(db, former, row.user_id)) === 'taken') return userTaken();
    return invalid();
  }
  return signedIn(db, profile, session.token, row.user_id, { id: device.id, name: nameFrom(results.at(-1), device.name) });
}

/** A retry of pair by the device that used the code (within the window): as redeemAgain for a device invitation. */
async function pairAgain(db: D1Database, headers: Headers, profile: number, codeHash: string, userId: string, former: string | undefined, device: DeviceInput, now: number): Promise<Response> {
  if (former !== undefined && !(await formerIdKnown(db, former, userId))) return invalid();
  return signInAgain(db, headers, profile, userId, device, usedByDevice('pairing_codes', 'code_hash'), [codeHash, device.id, now - RETRY_WINDOW], now);
}

async function pairingCodeUsedBy(db: D1Database, codeHash: string, deviceId: string, now: number): Promise<boolean> {
  const row = await db.prepare('SELECT 1 AS one FROM pairing_codes WHERE code_hash = ? AND used_device_id = ? AND used_at >= ?').bind(codeHash, deviceId, now - RETRY_WINDOW).first();
  return row !== null;
}

/** POST /api/auth/pairing-code — a code for a new device; the account's earlier code is gone. */
export const issueCode = withSession(async ({ env, now }, session) => {
  const pepper = pepperOf(env);
  const code = newPairingCode();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM pairing_codes WHERE user_id = ?').bind(session.userId),
    env.DB.prepare('INSERT INTO pairing_codes (code_hash, user_id, created_by_device, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(
      await pepperedHex(pepper, `pair:${code}`),
      session.userId,
      session.deviceId,
      now,
      now + CODE_TTL,
    ),
  ]);
  return json({ code, expiresAt: now + CODE_TTL });
});

/**
 * GET /api/auth/me — who this device is signed in as, the account's earlier ids (R40), whether it
 * is under 16 and whether it still needs consent to the current notice (R42 item 6). One query.
 */
export const me = withSession(async ({ env }, session) => {
  const db = env.DB;
  const [aliases, account] = await db.batch<Record<string, unknown>>([
    aliasesStatement(db, session.userId),
    db.prepare(`SELECT u.minor AS minor, ${CONSENT_OF_U} AS consent FROM users u WHERE u.id = ?1`).bind(session.userId, NOTICE_VERSION),
  ]);
  const row = account!.results[0];
  return json({
    userId: session.userId,
    device: { id: session.deviceId, name: session.deviceName },
    formerUserIds: aliases!.results.map((r) => String(r.alias_id)),
    minor: Number(row?.minor) === 1,
    needsConsent: !Number(row?.consent),
  });
});

/**
 * POST /api/auth/consent {consent} — consent to the current notice again (R42 item 6): under 16 —
 * only a parent's or guardian's with a name, otherwise only the person's own; the age question
 * is not asked again. Rows are only added; an account that already has the consent it needs gets
 * 200 and no new row.
 */
export const giveConsent = withSession(async ({ env, body, now }, session) => {
  if (!isObject(body) || !isObject(body.consent) || (body.consent.by !== 'self' && body.consent.by !== 'parent')) return error('bad_request', 400);
  const db = env.DB;
  const given = body.consent;
  const minor = Number(await db.prepare('SELECT minor FROM users WHERE id = ?').bind(session.userId).first('minor')) === 1;
  const parentName = given.by === 'parent' ? cleanName(given.parentName, PARENT_NAME_MAX) : null;
  const byParent = given.by === 'parent' && parentName !== null && given.parentAgreed === true;
  if (given.version !== NOTICE_VERSION || (minor ? !byParent : given.by !== 'self')) return error('consent_required', 400);
  await db
    .prepare(
      `INSERT INTO consents (id, user_id, notice_version, given_by, parent_name, device_id, given_at)
       SELECT ?3, ?1, ?2, ?4, ?5, ?6, ?7 WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ?1 AND ${CONSENT_OF_U})`,
    )
    .bind(session.userId, NOTICE_VERSION, crypto.randomUUID(), byParent ? 'parent' : 'self', byParent ? parentName : null, session.deviceId, now)
    .run();
  return json({ ok: true });
});

/**
 * POST /api/auth/alias {aliasId} — a backup file of another installation joins the account
 * (R40): its local userId becomes an earlier id of the account. The account itself or an id it
 * already has — nothing to write; another account's — 409 user_taken; a new one needs consent.
 */
export const addAlias = withSession(async ({ env, body, now }, session) => {
  if (!isObject(body) || !isLocalUserId(body.aliasId)) return error('bad_request', 400);
  const db = env.DB;
  const id = body.aliasId;
  const plan = await formerIdPlan(db, id, session.userId);
  if (plan instanceof Response) return plan;
  if (plan === 'add') {
    const free = freeClause(id, session.userId);
    try {
      await insertAlias(db, free.sql, free.args, session.userId, id, now).run();
    } catch (e) {
      if (isKeyClash(e)) return userTaken();
      throw e;
    }
    if ((await aliasStatus(db, id, session.userId)) !== 'known') return userTaken();
  }
  return json({ formerUserIds: await aliasesOf(db, session.userId) });
});

/** GET /api/auth/devices — the account's devices that are not removed or signed out. */
export const devices = withSession(async ({ env }, session) => {
  const { results } = await env.DB.prepare(
    'SELECT id, name, last_seen_at FROM devices WHERE user_id = ? AND revoked_at IS NULL ORDER BY last_seen_at DESC, created_at',
  )
    .bind(session.userId)
    .all<{ id: string; name: string; last_seen_at: number }>();
  return json({ devices: results.map((d) => ({ id: d.id, name: d.name, lastSeenAt: d.last_seen_at, current: d.id === session.deviceId })) });
});

/** POST /api/auth/device {name} — renames this device. */
export const renameDevice = withSession(async ({ env, body }, session) => {
  const name = isObject(body) ? cleanName(body.name, DEVICE_NAME_MAX) : null;
  if (name === null) return error('bad_request', 400);
  await env.DB.prepare('UPDATE devices SET name = ? WHERE id = ?').bind(name, session.deviceId).run();
  return json({ ok: true, name });
});

/**
 * POST /api/auth/devices/revoke {deviceId} — removes a device of the account: its sessions are
 * deleted, its next request gets 401. Another account's device and an unknown one — the same 404.
 */
export const revokeDevice = withSession(async ({ env, body, now }, session) => {
  if (!isObject(body) || !isUuid(body.deviceId)) return error('bad_request', 400);
  const deviceId = body.deviceId.toLowerCase();
  const owned = await env.DB.prepare('SELECT 1 AS one FROM devices WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
    .bind(deviceId, session.userId)
    .first();
  if (!owned) return error('not_found', 404);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE device_id = ?').bind(deviceId),
    env.DB.prepare('UPDATE devices SET revoked_at = ? WHERE id = ?').bind(now, deviceId),
  ]);
  return json({ ok: true }, 200, deviceId === session.deviceId ? { 'Set-Cookie': clearCookie(session.profile) } : undefined);
});

/** POST /api/auth/logout — ends this device's session; never refused (no 426), also without one. */
export async function logout({ request, env, now }: Call): Promise<Response> {
  const profile = profileFrom(request.headers);
  if (profile === null) return error('bad_request', 400);
  const session = await getSession(env.DB, request.headers, now);
  if (session) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.tokenHash),
      env.DB.prepare('UPDATE devices SET revoked_at = ? WHERE id = ? AND NOT EXISTS (SELECT 1 FROM sessions WHERE device_id = ?)').bind(
        now,
        session.deviceId,
        session.deviceId,
      ),
    ]);
  }
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(profile) });
}
