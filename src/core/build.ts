/** Replaced by Vite (`define` in vite.config.ts). */
declare const __MANA_BUILD__: number;

/**
 * This build's number: UTC time of the build as YYYYMMDDHHmm (Р36). From 6a.2 on every API
 * request sends it as X-Mana-Version; the server refuses changes from builds older than its
 * MIN_CLIENT (worker/config.ts) with 426.
 */
export const BUILD: number = __MANA_BUILD__;
