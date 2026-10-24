/** The site's only origin: CSRF checks compare Origin with it (STAGE6_RESEARCH 2.2). */
export const ORIGIN = 'https://mana.amisipehr.workers.dev';

/**
 * Oldest client build allowed to change data (STAGE6_RESEARCH 5.5, R36): UTC time of the build
 * as YYYYMMDDHHmm, like BUILD in src/core/build.ts. Raise it before pushing a change of
 * RULES_VERSION, of the record format or of the notice version (R39); never into the future (a
 * test checks), or every client is refused. 24.10.2026: notice version 2 and sync (6a.3) — an
 * open tab of a 6a.2 build gets 426 ("out of date"), not a consent screen with the text of v1.
 */
export const MIN_CLIENT = 202610241450;

/** Request body limit when a route sets none, bytes (7.4: sign-in 4 KB). */
export const DEFAULT_BODY_LIMIT = 4 * 1024;
/** Limit for the small sign-in bodies (a token or a code, a device name). */
export const SMALL_BODY_LIMIT = 1024;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Sign-in (R33 items 4–5, R37), milliseconds. */
export const INVITE_TTL = 48 * HOUR;
export const CODE_TTL = 10 * MINUTE;
/** A session ends after this long without requests… */
export const SESSION_IDLE = 180 * DAY;
/** …and a request moves that end (and the cookie) at most once per this. */
export const SESSION_TOUCH = DAY;
/** The device's last_seen_at and app version are written at most once per this (6a.3). */
export const DEVICE_TOUCH = HOUR;
/** The cookie: 400 days, Chrome's cap (STAGE6_RESEARCH 2.1), in seconds. */
export const COOKIE_MAX_AGE = 400 * 24 * 3600;

/**
 * Failed code attempts (STAGE6_RESEARCH 7.3): per IP hash — 10 in 10 minutes; all together —
 * 50 in an hour, then codes are closed to everyone for an hour (invitation links still work).
 */
export const IP_WINDOW = 10 * MINUTE;
export const IP_MAX_FAILURES = 10;
export const GLOBAL_WINDOW = HOUR;
export const GLOBAL_MAX_FAILURES = 50;
export const GLOBAL_LOCK = HOUR;

/**
 * Push (6a.3, R39): true — the insert tells which records it stored (RETURNING); false — the
 * same batch first reads which ids exist. Switch to false if D1 refuses RETURNING here.
 */
export const PUSH_USES_RETURNING = true;
