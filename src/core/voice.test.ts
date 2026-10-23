import { describe, expect, it } from 'vitest';
import type { Clock, RecognitionHandlers, RecognitionOptions, SpeechRecognizer } from './ports';
import { RecognitionStartError } from './ports';
import { MIC_WATCHDOG_MS, VoiceCapture, type VoiceState } from './voice';

/** Fake time: `real` drives the watchdog and the mic delay, `vis` the visible clock. */
function setup(opts: { throwOnStart?: boolean; options?: RecognitionOptions } = {}) {
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
  const sessions: { h: RecognitionHandlers; aborted: boolean; options: RecognitionOptions | undefined }[] = [];
  let unsupportedCalls = 0;
  const recognizer: SpeechRecognizer = {
    supported: true,
    start(_lang, h, options) {
      if (opts.throwOnStart) throw new RecognitionStartError('start');
      const s = { h, aborted: false, options };
      sessions.push(s);
      return { abort: () => void (s.aborted = true) };
    },
  };
  const states: VoiceState[] = [];
  const v = new VoiceCapture({
    recognizer,
    clock,
    visibleMs: () => t.vis,
    lang: 'fr-FR',
    onChange: (s) => states.push(s),
    ...(opts.options ? { options: () => opts.options! } : {}),
    onPhrasesUnsupported: () => void unsupportedCalls++,
  });
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
  return { v, advance, h, sessions, states, t, unsupported: () => unsupportedCalls };
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

describe('VoiceCapture: unrecognised attempts in a row', () => {
  it('counts no-speech / no-result in a row; a success resets the count', () => {
    const { v, h } = setup();
    for (let k = 1; k <= 3; k++) {
      v.start();
      h().onAudioStart!();
      if (k === 2) h().onEnd();
      else h().onError('no-speech');
      expect(v.getState().failuresInRow).toBe(k);
    }
    v.start();
    h().onAudioStart!();
    h().onResult({ finalAlts: ['un'], interim: '' });
    h().onEnd();
    expect(v.getState()).toMatchObject({ phase: 'done', failuresInRow: 0 });
  });

  it('a network error is not an unrecognised attempt', () => {
    const { v, h } = setup();
    v.start();
    h().onError('network');
    expect(v.getState().failuresInRow).toBe(0);
  });

  it('troubled: retries or nothing recognised before the answer', () => {
    const ok = setup();
    ok.v.start();
    ok.h().onAudioStart!();
    ok.h().onResult({ finalAlts: ['oui'], interim: '' });
    ok.h().onEnd();
    expect(ok.v.outcome().troubled).toBe(false);

    const nomatch = setup();
    nomatch.v.start();
    nomatch.h().onNoMatch!();
    nomatch.h().onResult({ finalAlts: ['oui'], interim: '' });
    nomatch.h().onEnd();
    expect(nomatch.v.outcome().troubled).toBe(true);

    const retried = setup();
    retried.v.start();
    retried.v.start();
    retried.h().onResult({ finalAlts: ['oui'], interim: '' });
    retried.h().onEnd();
    expect(retried.v.outcome()).toMatchObject({ troubled: true, retries: 1 });
  });
});

describe('VoiceCapture: "say it 2–3 times" hint (R23)', () => {
  it('is due after the first attempt with nothing recognised and gone after an answer; the journal says it was shown', () => {
    const { v, h } = setup();
    v.start();
    expect(v.getState().failuresInRow).toBe(0);
    h().onError('no-speech');
    expect(v.getState().failuresInRow).toBe(1);
    v.start();
    h().onResult({ finalAlts: ['deux'], interim: '' });
    h().onEnd();
    expect(v.getState().failuresInRow).toBe(0);
    expect(v.outcome().repeatHint).toBe(true);
  });

  it('is not shown for other errors or a clean answer', () => {
    const net = setup();
    net.v.start();
    net.h().onError('network');
    expect(net.v.getState().failuresInRow).toBe(0);
    expect(net.v.outcome().repeatHint).toBe(false);

    const ok = setup();
    ok.v.start();
    ok.h().onResult({ finalAlts: ['oui'], interim: '' });
    ok.h().onEnd();
    expect(ok.v.outcome().repeatHint).toBe(false);
  });
});

describe('VoiceCapture: recognizer hints', () => {
  it('sends phrases and processLocally', () => {
    const { v, sessions } = setup({ options: { phrases: ['un', 'deux'], processLocally: true } });
    v.start();
    expect(sessions[0]!.options).toEqual({ phrases: ['un', 'deux'], processLocally: true });
  });

  it('phrases-not-supported: logged, reported once, repeated at once without phrases, not a retry', () => {
    const { v, h, sessions, unsupported } = setup({ options: { phrases: ['un'] } });
    v.start();
    h().onError('phrases-not-supported');
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.aborted).toBe(true);
    expect(sessions[1]!.options).toEqual({});
    expect(unsupported()).toBe(1);
    h().onAudioStart!();
    h().onResult({ finalAlts: ['un'], interim: '' });
    h().onEnd();
    const o = v.outcome();
    expect(o).toMatchObject({ retries: 0, troubled: false, phrasesCount: 0 });
    expect(o.errors.map((e) => e.code)).toEqual(['phrases-not-supported']);
    // Later attempts on this card go without phrases too.
    v.start();
    expect(sessions[2]!.options).toEqual({});
  });

  it('phrasesCount of the attempt that answered', () => {
    const { v, h } = setup({ options: { phrases: ['un', 'deux', 'trois'] } });
    v.start();
    h().onResult({ finalAlts: ['deux'], interim: '' });
    h().onEnd();
    expect(v.outcome()).toMatchObject({ phrasesCount: 3, processLocally: false });
  });
});

describe('VoiceCapture: listening activity (drives the ring; no second microphone stream)', () => {
  it('waiting → sound → speech → waiting; results counted; none at the end', () => {
    const { v, h } = setup();
    v.start();
    expect(v.getState()).toMatchObject({ phase: 'starting', activity: 'none' });
    h().onAudioStart!();
    expect(v.getState()).toMatchObject({ phase: 'listening', activity: 'waiting' });
    h().onSoundStart!();
    expect(v.getState().activity).toBe('sound');
    h().onSpeechStart();
    expect(v.getState().activity).toBe('speech');
    h().onSoundStart!();
    expect(v.getState().activity).toBe('speech');
    h().onResult({ finalAlts: null, interim: 'le', transcript: 'le' });
    h().onResult({ finalAlts: null, interim: 'le nom', transcript: 'le nom' });
    expect(v.getState().results).toBe(2);
    h().onSpeechEnd!();
    expect(v.getState().activity).toBe('waiting');
    h().onResult({ finalAlts: ['le nom'], interim: '' });
    h().onEnd();
    expect(v.getState()).toMatchObject({ phase: 'done', activity: 'none', results: 3 });
  });

  it('an error switches the ring off; a new attempt starts from zero', () => {
    const { v, h } = setup();
    v.start();
    h().onAudioStart!();
    h().onSoundStart!();
    h().onError('no-speech');
    expect(v.getState()).toMatchObject({ phase: 'failed', activity: 'none' });
    v.start();
    expect(v.getState()).toMatchObject({ activity: 'none', results: 0 });
  });
});
