/**
 * Sign-in routes (stage 6a.2, R33 items 4–5, R37; STAGE6_RESEARCH 3.1–3.4, 7.3). Passwordless:
 * an invitation link creates an account and its first device; a pairing code from a signed-in
 * device adds another one. One answer for a wrong, expired or used invitation or code.
 */
import { NOTICE_VERSION } from '../src/core/notice.ts';
import { normalizeCode } from '../src/core/pairingCode.ts';
import type { Call } from './api.ts';
import { ipBucket, recordFailure, waitBeforeAttempt } from './attempts.ts';
import { CODE_TTL, SESSION_IDLE } from './config.ts';
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
 * row, or the same account's earlier one renamed and back from revoked.
 */
function upsertDevice(db: D1Database, guard: string, guardArgs: unknown[], device: DeviceInput, userId: string, now: number, build: number | null) {
  return db
    .prepare(
      `INSERT INTO devices (id, user_id, name, created_at, last_seen_at, app_version, revoked_at)
       SELECT ?, ?, ?, ?, ?, ?, NULL WHERE ${guard}
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, last_seen_at = excluded.last_seen_at,
         app_version = excluded.app_version, revoked_at = NULL
       WHERE devices.user_id = excluded.user_id`,
    )
    .bind(device.id, userId, device.name, now, now, build, ...guardArgs);
}

function insertSession(db: D1Database, guard: string, guardArgs: unknown[], tokenHash: string, userId: string, deviceId: string, now: number) {
  return db
    .prepare(
      `INSERT INTO sessions (token_hash, user_id, device_id, created_at, last_used_at, expires_at)
       SELECT ?, ?, ?, ?, ?, ? WHERE ${guard}
         AND EXISTS (SELECT 1 FROM devices WHERE id = ? AND user_id = ? AND revoked_at IS NULL)`,
    )
    .bind(tokenHash, userId, deviceId, now, now, now + SESSION_IDLE, ...guardArgs, deviceId, userId);
}

function signedIn(profile: number, token: string, userId: string, device: DeviceInput): Response {
  return json({ userId, device }, 200, { 'Set-Cookie': setCookie(profile, token) });
}

/** POST /api/auth/invite {token} — what the invitation is, without using it. */
export async function inviteInfo({ env, body, now }: Call): Promise<Response> {
  if (!isObject(body)) return error('bad_request', 400);
  if (!isToken(body.token)) return invalid();
  const hash = await sha256Hex(body.token);
  const row = await env.DB.prepare('SELECT token_hash, kind, minor FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
    .bind(hash, now)
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

/**
 * POST /api/auth/redeem {token, device, consent?} — uses the invitation. One batch: the
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
    .prepare('SELECT token_hash, kind, user_id, minor FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
    .bind(tokenHash, now)
    .first<{ token_hash: string; kind: 'account' | 'device'; user_id: string | null; minor: number }>();
  if (!invite || !sameHash(invite.token_hash, tokenHash)) return invalid();

  const account = invite.kind === 'account';
  let minor = 0;
  if (account) {
    const byParent = consent?.by === 'parent' && consent.parentName !== null && consent.parentAgreed === true;
    const agreed = consent !== null && consent.version === NOTICE_VERSION && (consent.by === 'self' || byParent);
    // Under 16 by the invitation: only a parent's or guardian's consent counts.
    if (!agreed || (invite.minor === 1 && !byParent)) return error('consent_required', 400);
    // Under 16 by the invitation or by the answer "no" to the age question.
    minor = invite.minor === 1 || byParent ? 1 : 0;
  }
  const userId = account ? crypto.randomUUID() : invite.user_id!;
  const owner = await deviceOwner(db, device.id);
  if (owner !== null && owner !== userId) return error('device_taken', 409);

  const redeemId = crypto.randomUUID();
  const mine = 'EXISTS (SELECT 1 FROM invites WHERE token_hash = ? AND redeem_id = ?)';
  const mineArgs = [tokenHash, redeemId];
  const session = await newSessionToken();
  const statements = [
    db
      .prepare('UPDATE invites SET used_at = ?, used_device_id = ?, redeem_id = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING kind')
      .bind(now, device.id, redeemId, tokenHash, now),
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
  statements.push(insertSession(db, mine, mineArgs, session.hash, userId, device.id, now));
  const results = await db.batch(statements);
  if (results[0]?.results.length !== 1) return invalid();
  return signedIn(profile, session.token, userId, device);
}

/** POST /api/auth/pair {code, device} — a new device by a code from a signed-in one. */
export async function pair({ request, env, body, now }: Call): Promise<Response> {
  const db = env.DB;
  const profile = profileFrom(request.headers);
  if (!isObject(body) || profile === null || typeof body.code !== 'string') return error('bad_request', 400);
  const device = readDevice(body.device);
  if (!device) return error('bad_request', 400);
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
          .prepare('SELECT code_hash, user_id FROM pairing_codes WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?')
          .bind(codeHash, now)
          .first<{ code_hash: string; user_id: string }>();
  if (!row || codeHash === null || !sameHash(row.code_hash, codeHash)) {
    await recordFailure(db, bucket, now);
    return invalid();
  }
  const owner = await deviceOwner(db, device.id);
  if (owner !== null && owner !== row.user_id) return error('device_taken', 409);

  const mine = 'EXISTS (SELECT 1 FROM pairing_codes WHERE code_hash = ? AND used_at = ? AND used_device_id = ?)';
  const mineArgs = [codeHash, now, device.id];
  const session = await newSessionToken();
  const results = await db.batch([
    db
      .prepare('UPDATE pairing_codes SET used_at = ?, used_device_id = ? WHERE code_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id')
      .bind(now, device.id, codeHash, now),
    upsertDevice(db, mine, mineArgs, device, row.user_id, now, clientBuild(request.headers)),
    insertSession(db, mine, mineArgs, session.hash, row.user_id, device.id, now),
  ]);
  if (results[0]?.results.length !== 1) return invalid();
  return signedIn(profile, session.token, row.user_id, device);
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

/** GET /api/auth/me — who this device is signed in as. */
export const me = withSession(async (_call, session) => json({ userId: session.userId, device: { id: session.deviceId, name: session.deviceName } }));

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
