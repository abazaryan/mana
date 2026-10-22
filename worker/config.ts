/** The site's only origin: CSRF checks compare Origin with it (STAGE6_RESEARCH 2.2). */
export const ORIGIN = 'https://mana.amisipehr.workers.dev';

/**
 * Oldest client build allowed to change data (STAGE6_RESEARCH 5.5, Р36): UTC time of the build
 * as YYYYMMDDHHmm, like BUILD in src/core/build.ts. Raise it before pushing a change of
 * RULES_VERSION or of the record format; never into the future (a test checks), or every
 * client is refused.
 */
export const MIN_CLIENT = 202610220000;

/** Request body limit when a route sets none, bytes (7.4: sign-in 4 KB). */
export const DEFAULT_BODY_LIMIT = 4 * 1024;
