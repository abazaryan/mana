/**
 * Sessions (R33 item 5, STAGE6_RESEARCH 2.1, 3.4): the cookie of the request's profile carries an
 * opaque token, the database its SHA-256. A session ends after SESSION_IDLE without requests;
 * a request moves that end — and renews the cookie — at most once per SESSION_TOUCH.
 */
import { clientBuild } from './guards.ts';
import { COOKIE_MAX_AGE, DEVICE_TOUCH, SESSION_IDLE, SESSION_TOUCH } from './config.ts';
import { profileFrom, sessionCookieName } from './profile.ts';
import { newToken, sameHash, sha256Hex } from './tokens.ts';

export function setCookie(profile: number, token: string): string {
  return `${sessionCookieName(profile)}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE}; Secure; HttpOnly; SameSite=Strict`;
}

export function clearCookie(profile: number): string {
  return `${sessionCookieName(profile)}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict`;
}

/** The value of one cookie from the Cookie header, or null. */
export function readCookie(headers: Headers, name: string): string | null {
  for (const part of (headers.get('Cookie') ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
}

export interface Session {
  tokenHash: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  profile: number;
  /** A renewed cookie to send with the response (once a day), or undefined. */
  cookie?: string;
}

/**
 * The live session of the request's profile, or null (no cookie, unknown, expired; also a
 * malformed X-Mana-Profile). Once a day: last_used_at and expires_at are written and the cookie
 * is renewed. The device's last_seen_at and app version — at most once an hour (6a.3: devices
 * sync often, the list of devices shows the last exchange).
 */
export async function getSession(db: D1Database, headers: Headers, now: number): Promise<Session | null> {
  const profile = profileFrom(headers);
  if (profile === null) return null;
  const token = readCookie(headers, sessionCookieName(profile));
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT s.token_hash, s.user_id, s.device_id, s.last_used_at, d.name, d.last_seen_at
       FROM sessions s JOIN devices d ON d.id = s.device_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(tokenHash, now)
    .first<{ token_hash: string; user_id: string; device_id: string; last_used_at: number; name: string; last_seen_at: number }>();
  if (!row || !sameHash(row.token_hash, tokenHash)) return null;
  const session: Session = { tokenHash, userId: row.user_id, deviceId: row.device_id, deviceName: row.name, profile };
  const seen = db.prepare('UPDATE devices SET last_seen_at = ?, app_version = ? WHERE id = ?').bind(now, clientBuild(headers), row.device_id);
  if (now - row.last_used_at >= SESSION_TOUCH) {
    await db.batch([db.prepare('UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE token_hash = ?').bind(now, now + SESSION_IDLE, tokenHash), seen]);
    session.cookie = setCookie(profile, token);
  } else if (now - row.last_seen_at >= DEVICE_TOUCH) {
    await seen.run();
  }
  return session;
}

/** A new session token: the value goes into the cookie, only its hash into the database. */
export async function newSessionToken(): Promise<{ token: string; hash: string }> {
  const token = newToken();
  return { token, hash: await sha256Hex(token) };
}
