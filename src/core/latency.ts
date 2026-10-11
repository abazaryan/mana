/**
 * A latency clock that runs only while the card is on screen. Ported from
 * LivreVivant (src/lib/learning/latency.ts @ 503f4af).
 *
 * `Date.now() - shownAt` keeps counting through a locked phone and a hidden
 * tab, so a well-known word gets logged as minutes of thinking. Here visible
 * stretches are summed and hidden ones dropped. `believableLatency` is the outer
 * guard for what the tab cannot see (a laptop that sleeps with the tab visible
 * may send no visibility event at all).
 *
 * Pure: the browser wiring (`visibilitychange`) is a UI hook, stage 4.
 */

export interface ElapsedState {
  /** When the current visible stretch began; null while hidden. */
  visibleSince: number | null;
  /** Sum of the visible stretches that have already finished. */
  accumulatedMs: number;
}

export type ElapsedEvent = { type: 'hide' | 'show'; at: number };

/** Start the clock at `at`, running or not depending on the current visibility. */
export function startElapsed(at: number, isVisible: boolean): ElapsedState {
  return { visibleSince: isVisible ? at : null, accumulatedMs: 0 };
}

/**
 * Fold one visibility event into the state. Redundant events are ignored:
 * browsers do fire `hide` twice, and `show` on an already visible tab.
 */
export function applyElapsed(s: ElapsedState, e: ElapsedEvent): ElapsedState {
  if (e.type === 'hide') {
    if (s.visibleSince === null) return s;
    return { visibleSince: null, accumulatedMs: s.accumulatedMs + delta(s.visibleSince, e.at) };
  }
  if (s.visibleSince !== null) return s;
  return { visibleSince: e.at, accumulatedMs: s.accumulatedMs };
}

/** Visible milliseconds so far, as of `at`. Does not mutate the state. */
export function elapsedMs(s: ElapsedState, at: number): number {
  return s.visibleSince === null ? s.accumulatedMs : s.accumulatedMs + delta(s.visibleSince, at);
}

/** A stretch whose end precedes its start (clock moved back) contributes zero. */
function delta(from: number, to: number): number {
  return Math.max(0, to - from);
}

/**
 * Latency ceiling for the review log. Past two minutes the number reports an
 * interruption, not thinking time.
 */
export const MAX_RESPONSE_TIME_MS = 120_000;

/** Latency worth believing; an interrupted or unmeasured one is unknown (null). */
export function believableLatency(ms: number | null | undefined): number | null {
  if (ms === undefined || ms === null || !Number.isFinite(ms) || ms < 0) return null;
  return ms > MAX_RESPONSE_TIME_MS ? null : ms;
}
