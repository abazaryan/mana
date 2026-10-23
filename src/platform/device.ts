import type { Clock } from '../core/ports';

export const browserClock: Clock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (h) => window.clearTimeout(h as number),
};

/**
 * IANA zone of the device right now (R29.3), read at every use: a trip changes it.
 * 'local' when the browser does not tell; offsets then come from the device clock.
 */
export function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  } catch {
    return 'local';
  }
}
