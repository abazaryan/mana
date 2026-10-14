import { describe, expect, it } from 'vitest';
import type { Clock, RecognitionHandlers, SpeechRecognizer } from './ports';
import { RecognitionStartError } from './ports';
import { MIC_WATCHDOG_MS, VoiceCapture, type VoiceState } from './voice';

/** Fake time: `real` drives the watchdog and the mic delay, `vis` the visible clock. */
function setup(opts: { throwOnStart?: boolean } = {}) {
  const t = { real: 1000, vis: 0 };
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const clock: Clock = {
    now: () => t.real,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.push({ at: t.real + ms, fn, id });
      return id;
    },
    clearTimeout: (h) => {
      const k = timers.findIndex((x) => x.id === h);
      if (k >= 0) timers.splice(k, 1);
    },
  };
  const sessions: { h: RecognitionHandlers; aborted: boolean }[] = [];
  const recognizer: SpeechRecognizer = {
    supported: true,
    start(_lang, h) {
      if (opts.throwOnStart) throw new RecognitionStartError('start');
      const s = { h, aborted: false };
      sessions.push(s);
      return { abort: () => void (s.aborted = true) };
    },
  };
  const states: VoiceState[] = [];
  const v = new VoiceCapture({ recognizer, clock, visibleMs: () => t.vis, lang: 'fr-FR', onChange: (s) => states.push(s) });
  const advance = (ms: number, visible = true) => {
    t.real += ms;
    if (visible) t.vis += ms;
    for (const tm of [...timers]) {
      if (tm.at <= t.real) {
        timers.splice(timers.indexOf(tm), 1);
        tm.fn();
      }
    }
  };
  const h = () => sessions[sessions.length - 1]!.h;
  return { v, advance, h, sessions, states, t };
}

describe('VoiceCapture: latency', () => {
  it('measures from the microphone ready (audiostart) when it comes after the card', () => {
    const { v, advance, h } = setup();
    advance(200); // card shown 200 ms before the mic starts
    v.start();
    advance(300);
    h().onStart();
    advance(100);
    h().onAudioStart!();
    advance(1500);
    h().onSpeechStart();
    advance(800);
    h().onResult({ finalAlts: ['le nom', 'le non'], finalConfidences: [0.9, null], interim: '' });
    h().onEnd();
    expect(v.getState().phase).toBe('done');
    expect(v.outcome()).toMatchObject({
      alternatives: ['le nom', 'le non'],
      confidences: [0.9, null],
      latencyMs: 1500,
      latencySource: 'speechstart',
      micDelayMs: 400,
      totalMs: 2900,
      retries: 0,
      errors: [],
    });
  });

  it('falls back to start when there is no audiostart, and to the first result when there is no speechstart', () => {
    const { v, advance, h } = setup();
    v.start();
    advance(250);
    h().onStart();
    advance(1000);
    h().onResult({ finalAlts: null, interim: 'le', transcript: 'le' });
    advance(500);
    h().onResult({ finalAlts: ['le nom'], interim: '' });
    h().onEnd();
    expect(v.outcome()).toMatchObject({ latencyMs: 1000, latencySource: 'result', micDelayMs: 250 });
  });

  it('a microphone ready before the card counts from the card', () => {
    const { v, advance, h } = setup();
    v.start();
    h().onAudioStart!();
    advance(700);
    h().onSpeechStart();
    h().onResult({ finalAlts: ['oui'], interim: '' });
    h().onEnd();
    expect(v.outcome().latencyMs).toBe(700);
  });

  it('hidden time is not latency', () => {
    const { v, advance, h } = setup();
    v.start();
    h().onAudioStart!();
    advance(500);
    advance(60_000, false); // tab hidden
    advance(500);
    h().onSpeechStart();
    h().onResult({ finalAlts: ['oui'], interim: '' });
    h().onEnd();
    expect(v.outcome().latencyMs).toBe(1000);
  });

  it('over 120 s of visible time is unknown', () => {
    const { v, advance, h } = setup();
    v.start();
    h().onAudioStart!();
    advance(121_000);
    h().onSpeechStart();
    h().onResult({ finalAlts: ['oui'], interim: '' });
    h().onEnd();
    expect(v.outcome()).toMatchObject({ latencyMs: null, latencySource: null });
  });
});

describe('VoiceCapture: results and errors', () => {
  it('keeps the interim text when the recognizer ends without a final result', () => {
    const { v, h } = setup();
    v.start();
    h().onAudioStart!();
    h().onSpeechStart();
    h().onResult({ finalAlts: null, interim: 'bonjour', transcript: 'bonjour' });
    h().onEnd();
    expect(v.getState()).toMatchObject({ phase: 'done', transcript: 'bonjour' });
    expect(v.outcome()).toMatchObject({ alternatives: ['bonjour'], confidences: [null] });
  });

  it('live transcript follows the results', () => {
    const { v, h, states } = setup();
    v.start();
    h().onAudioStart!();
    h().onResult({ finalAlts: null, interim: 'je', transcript: 'je' });
    h().onResult({ finalAlts: null, interim: 'je parle', transcript: 'je parle' });
    expect(states.map((s) => s.transcript).filter(Boolean)).toEqual(['je', 'je parle']);
  });

  it('nothing recognised → failed with `no-result`, retry counts and keeps every error', () => {
    const { v, advance, h, sessions } = setup();
    v.start();
    h().onAudioStart!();
    advance(3000);
    h().onError('no-speech');
    expect(v.getState()).toMatchObject({ phase: 'failed', error: 'no-speech', fatal: false });
    expect(sessions[0]!.aborted).toBe(true);
    v.start();
    h().onAudioStart!();
    h().onNoMatch!();
    h().onEnd();
    expect(v.getState()).toMatchObject({ phase: 'failed', error: 'no-result' });
    v.start();
    h().onAudioStart!();
    h().onSpeechStart();
    h().onResult({ finalAlts: ['oui'], interim: '' });
    h().onEnd();
    const o = v.outcome();
    expect(o.retries).toBe(2);
    expect(o.errors.map((e) => e.code)).toEqual(['no-speech', 'nomatch', 'no-result']);
    expect(o.errors[0]!.atMs).toBe(3000);
  });

  it('a permission error is fatal', () => {
    const { v, h } = setup();
    v.start();
    h().onError('not-allowed');
    expect(v.getState()).toMatchObject({ phase: 'failed', fatal: true });
  });

  it('watchdog: no microphone within 5 s', () => {
    const { v, advance, sessions } = setup();
    v.start();
    advance(MIC_WATCHDOG_MS - 1);
    expect(v.getState().phase).toBe('starting');
    advance(1);
    expect(v.getState()).toMatchObject({ phase: 'failed', error: 'watchdog' });
    expect(sessions[0]!.aborted).toBe(true);
    expect(v.outcome().micDelayMs).toBeNull();
  });

  it('no watchdog once the microphone started', () => {
    const { v, advance, h } = setup();
    v.start();
    h().onStart();
    advance(MIC_WATCHDOG_MS * 2);
    expect(v.getState().phase).toBe('listening');
  });

  it('a recognizer that cannot start fails fatally', () => {
    const { v } = setup({ throwOnStart: true });
    v.start();
    expect(v.getState()).toMatchObject({ phase: 'failed', error: 'start', fatal: true });
  });

  it('callbacks of an aborted attempt are ignored; our own abort is no error', () => {
    const { v, h } = setup();
    v.start();
    const old = h();
    v.abort();
    old.onError('aborted');
    old.onResult({ finalAlts: ['x'], interim: '' });
    old.onEnd();
    expect(v.getState().phase).toBe('idle');
    expect(v.outcome()).toMatchObject({ alternatives: [], errors: [] });
  });
});
