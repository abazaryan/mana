import { describe, expect, it } from 'vitest';
import {
  applyElapsed,
  believableLatency,
  elapsedMs,
  MAX_RESPONSE_TIME_MS,
  startElapsed,
  type ElapsedEvent,
} from './latency';

/** Fold a sequence of events, left to right, onto a starting state. */
function fold(at: number, isVisible: boolean, events: ElapsedEvent[]) {
  return events.reduce(applyElapsed, startElapsed(at, isVisible));
}

describe('elapsed clock', () => {
  it('counts the whole span when the tab stays visible', () => {
    expect(elapsedMs(startElapsed(1000, true), 6000)).toBe(5000);
  });

  it('excludes the hidden stretch', () => {
    // 2 s visible, 60 s hidden (phone locked), 3 s visible again.
    const s = fold(0, true, [
      { type: 'hide', at: 2000 },
      { type: 'show', at: 62_000 },
    ]);
    expect(elapsedMs(s, 65_000)).toBe(5000);
  });

  it('does not count a stretch twice when hide fires twice', () => {
    const s = fold(0, true, [
      { type: 'hide', at: 2000 },
      { type: 'hide', at: 9000 },
      { type: 'show', at: 10_000 },
    ]);
    expect(elapsedMs(s, 11_000)).toBe(3000);
  });

  it('does not restart the stretch when show fires while already visible', () => {
    expect(elapsedMs(fold(0, true, [{ type: 'show', at: 4000 }]), 5000)).toBe(5000);
  });

  it('freezes at the moment of hiding', () => {
    expect(elapsedMs(fold(0, true, [{ type: 'hide', at: 5000 }]), 3_600_000)).toBe(5000);
  });

  it('counts only the visible part when started on a hidden tab', () => {
    expect(elapsedMs(fold(0, false, [{ type: 'show', at: 10_000 }]), 13_000)).toBe(3000);
  });

  it('never goes negative when the clock moves backwards', () => {
    expect(elapsedMs(startElapsed(10_000, true), 9000)).toBe(0);
    const s = fold(10_000, true, [
      { type: 'hide', at: 9000 },
      { type: 'show', at: 9500 },
    ]);
    expect(elapsedMs(s, 10_500)).toBe(1000);
  });

  it('leaves the state untouched when read', () => {
    const s = startElapsed(1000, true);
    elapsedMs(s, 6000);
    expect(s).toEqual({ visibleSince: 1000, accumulatedMs: 0 });
    expect(elapsedMs(s, 8000)).toBe(7000);
  });
});

describe('believableLatency', () => {
  it('keeps values up to and including the 120 s ceiling', () => {
    expect(MAX_RESPONSE_TIME_MS).toBe(120_000);
    expect(believableLatency(0)).toBe(0);
    expect(believableLatency(119_000)).toBe(119_000);
    expect(believableLatency(MAX_RESPONSE_TIME_MS)).toBe(MAX_RESPONSE_TIME_MS);
  });

  it('records an interrupted or missing latency as unknown', () => {
    expect(believableLatency(MAX_RESPONSE_TIME_MS + 1)).toBeNull();
    expect(believableLatency(undefined)).toBeNull();
    expect(believableLatency(null)).toBeNull();
    expect(believableLatency(-5)).toBeNull();
    expect(believableLatency(Number.NaN)).toBeNull();
  });
});
