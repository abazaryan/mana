import { describe, expect, it } from 'vitest';
import { BUILD } from '../src/core/build.ts';
import { MIN_CLIENT } from './config.ts';

/** YYYYMMDDHHmm → a real UTC time, or NaN. */
function stampTime(stamp: number): number {
  const s = String(stamp);
  if (!/^\d{12}$/.test(s)) return NaN;
  const time = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12));
  return new Date(time).toISOString().slice(0, 16).replace(/\D/g, '') === s ? time : NaN;
}

describe('build number (R36)', () => {
  it('BUILD — this build, UTC YYYYMMDDHHmm', () => {
    expect(stampTime(BUILD)).not.toBeNaN();
    expect(Math.abs(stampTime(BUILD) - Date.now())).toBeLessThan(24 * 3600_000);
  });

  it('MIN_CLIENT is a real time and not in the future: a fresh build is never refused', () => {
    expect(stampTime(MIN_CLIENT)).not.toBeNaN();
    expect(MIN_CLIENT).toBeLessThanOrEqual(BUILD);
  });
});
