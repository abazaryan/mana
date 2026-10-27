/** The site's only origin: CSRF checks compare Origin with it (STAGE6_RESEARCH 2.2). */
export const ORIGIN = 'https://mana.amisipehr.workers.dev';

/**
 * Oldest client build allowed to change data (STAGE6_RESEARCH 5.5, R36): UTC time of the build
 * as YYYYMMDDHHmm, like BUILD in src/core/build.ts. Raise it before pushing a change of
 * RULES_VERSION, of the record format or of the notice version (R39); never into the future (a
 * test checks), or every client is refused. 24.10.2026: notice version 2 and sync (6a.3) — an
 * open tab of a 6a.2 build gets 426 ("out of date"), not a consent screen with the text of v1.
 * 27.10.2026: notice version 3 (6a.5c, R42 item 12) — above the build of 6a.5b on the site
 * (202610270709), whose consent screen would send version 2: its open tab gets 426 and reloads.
 */
export const MIN_CLIENT = 202610270740;

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
/**
 * The same device may use its invitation or code once more for this long after it did (step "CPU of
 * sign-in routes", 27.10.2026): an answer lost after the batch was written (a 1102 or a 503) must
 * not leave the person outside. Used rows are kept at least this long (cleanup.ts).
 */
export const RETRY_WINDOW = 10 * MINUTE;
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
 * Erasing an account (6a.5, R42 item 3). D1 counts queries per Worker invocation (Free: 50; a
 * batch is one): journal rows per portion; portions and time of one delete request; portions of
 * one Cron run, which also does the hourly cleanup.
 */
export const QUERIES_PER_INVOCATION = 50;
export const ERASE_PORTION = 1000;
export const ERASE_REQUEST_PORTIONS = 30;
export const ERASE_REQUEST_TIME = 20_000;
export const ERASE_CRON_PORTIONS = 40;
export const ERASE_CRON_TIME = 5 * MINUTE;

/**
 * Push (6a.3, R39): true — the insert tells which records it stored (RETURNING); false — the
 * same batch first reads which ids exist. Switch to false if D1 refuses RETURNING here.
 */
export const PUSH_USES_RETURNING = true;
