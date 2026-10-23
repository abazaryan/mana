/**
 * One card's microphone: recognition attempts, retries, errors and the timings for
 * the journal (R22.3). Core logic behind the SpeechRecognizer port; tests drive it
 * with a fake recognizer and fake clocks.
 *
 * Timing. `visibleMs()` is the visible-time clock of the card (it stops while the
 * tab is hidden, src/core/latency.ts); the latency is
 *   start of speech − max(card shown, microphone ready),
 * both on that clock. "Microphone ready" is `audiostart` (the microphone really
 * captures), or `start` if the browser sends no `audiostart`. "Start of speech" is
 * `speechstart`, or the first result if the browser sends no `speechstart` — the
 * journal says which (`latencySource`). `soundstart` is not used: any noise fires it.
 * The microphone delay is real time from `start()` to ready.
 */
import { believableLatency } from './latency';
import type { LatencySource, RecognitionErrorEntry } from './model';
import {
  RecognitionStartError,
  type Clock,
  type RecognitionOptions,
  type RecognitionSession,
  type RecognitionUpdate,
  type SpeechRecognizer,
} from './ports';

/** If the microphone has not started within this time, give up (code `watchdog`). */
export const MIC_WATCHDOG_MS = 5000;

/** Errors after which voice makes no sense on this device; typing is offered. */
export const FATAL_RECOGNITION_ERRORS: readonly string[] = [
  'not-allowed',
  'service-not-allowed',
  'audio-capture',
  'language-not-supported',
  'create',
  'start',
];

/** Failed attempts that count as "not recognised" (R22 amendments: three in a row → typing). */
export const UNRECOGNISED_CODES: readonly string[] = ['no-speech', 'no-result'];

/** Error codes that mean the answer was hard to get: Easy is not offered after them. */
export const TROUBLE_CODES: readonly string[] = ['no-speech', 'no-result', 'nomatch'];

/** The recognizer rejected the hints; the attempt is repeated without them at once. */
export const PHRASES_NOT_SUPPORTED = 'phrases-not-supported';

export type VoicePhase = 'idle' | 'starting' | 'listening' | 'done' | 'failed';

/**
 * What the recognizer hears while listening, from its own events (no second
 * microphone stream: on Chrome Android it would compete with recognition):
 * none → waiting (microphone open, silence) → sound → speech, back to waiting at
 * the end of speech or sound.
 */
export type VoiceActivity = 'none' | 'waiting' | 'sound' | 'speech';

export interface VoiceState {
  phase: VoicePhase;
  /** Everything recognised so far (live highlight). */
  transcript: string;
  /** Last error code of a failed attempt. */
  error: string | null;
  fatal: boolean;
  /** Attempts in a row that ended with nothing recognised. */
  failuresInRow: number;
  activity: VoiceActivity;
  /** Results (interim or final) in this attempt: each one may flash the listening ring. */
  results: number;
}

export interface VoiceOutcome {
  alternatives: string[];
  confidences: (number | null)[];
  latencyMs: number | null;
  latencySource: LatencySource | null;
  micDelayMs: number | null;
  /** Visible time from the card shown to the end of the answer. */
  totalMs: number | null;
  errors: RecognitionErrorEntry[];
  retries: number;
  /** Visible ms from the card shown to the microphone ready in the last attempt. */
  readyMs: number | null;
  /** Hints sent with the attempt that gave the answer (0 = none). */
  phrasesCount: number;
  processLocally: boolean;
  /** The "say the word 2–3 times" hint was shown: an attempt ended with nothing recognised (R23, 16.10.2026). */
  repeatHint: boolean;
  /** Before the answer there were retries or attempts with nothing recognised (no Easy). */
  troubled: boolean;
}

export interface VoiceDeps {
  recognizer: SpeechRecognizer;
  /** Real time, for the microphone delay and the watchdog. */
  clock: Clock;
  /** Visible milliseconds since the card was shown. */
  visibleMs(): number;
  lang: string;
  onChange(state: VoiceState): void;
  /** Hints for each attempt; read at every start. */
  options?(): RecognitionOptions;
  /** The recognizer answered `phrases-not-supported` (the caller remembers it on the device). */
  onPhrasesUnsupported?(): void;
}

export class VoiceCapture {
  private readonly deps: VoiceDeps;
  private state: VoiceState = { phase: 'idle', transcript: '', error: null, fatal: false, failuresInRow: 0, activity: 'none', results: 0 };
  private session: RecognitionSession | null = null;
  private watchdog: unknown = null;
  private attempt = 0;
  private attempts = 0;

  private requestedAt = 0;
  private startAt: { real: number; vis: number } | null = null;
  private audioAt: { real: number; vis: number } | null = null;
  private speechVis: number | null = null;
  private firstResultVis: number | null = null;
  private endVis: number | null = null;
  private alts: string[] | null = null;
  private confidences: (number | null)[] = [];
  private lastInterim = '';
  private readonly errors: RecognitionErrorEntry[] = [];
  private phrasesBlocked = false;
  private sent: { phrases: number; local: boolean } = { phrases: 0, local: false };

  constructor(deps: VoiceDeps) {
    this.deps = deps;
  }

  getState(): VoiceState {
    return this.state;
  }

  private set(patch: Partial<VoiceState>): void {
    this.state = { ...this.state, ...patch };
    this.deps.onChange(this.state);
  }

  private fail(code: string): void {
    this.errors.push({ code, atMs: Math.round(this.deps.visibleMs()) });
    this.stopSession();
    const unrecognised = UNRECOGNISED_CODES.includes(code);
    this.set({
      phase: 'failed',
      activity: 'none',
      error: code,
      fatal: FATAL_RECOGNITION_ERRORS.includes(code),
      failuresInRow: unrecognised ? this.state.failuresInRow + 1 : this.state.failuresInRow,
    });
  }

  private stopSession(): void {
    if (this.watchdog !== null) this.deps.clock.clearTimeout(this.watchdog);
    this.watchdog = null;
    const s = this.session;
    this.session = null;
    s?.abort();
  }

  /**
   * Starts listening; a second call is a retry (counted). Call from a user gesture when possible.
   * `counted` false: a restart the user did not ask for as a retry (after replaying the audio in `listen`).
   */
  start(counted = true): void {
    this.begin(counted);
  }

  /** `counted`: false for the automatic repeat without hints after `phrases-not-supported`. */
  private begin(counted: boolean): void {
    this.stopSession();
    if (counted) this.attempts++;
    const my = ++this.attempt;
    const live = () => my === this.attempt;
    this.startAt = null;
    this.audioAt = null;
    this.speechVis = null;
    this.firstResultVis = null;
    this.endVis = null;
    this.alts = null;
    this.confidences = [];
    this.lastInterim = '';
    this.set({ phase: 'starting', transcript: '', error: null, fatal: false, activity: 'none', results: 0 });

    const { clock, visibleMs } = this.deps;
    const wanted = this.deps.options?.() ?? {};
    const options: RecognitionOptions = {
      ...(wanted.processLocally ? { processLocally: true } : {}),
      ...(wanted.phrases?.length && !this.phrasesBlocked ? { phrases: wanted.phrases } : {}),
    };
    this.sent = { phrases: options.phrases?.length ?? 0, local: options.processLocally === true };
    this.requestedAt = clock.now();
    const now = () => ({ real: clock.now(), vis: visibleMs() });
    try {
      this.session = this.deps.recognizer.start(this.deps.lang, {
        onStart: () => {
          if (!live()) return;
          this.startAt ??= now();
          this.ready();
        },
        onAudioStart: () => {
          if (!live()) return;
          this.audioAt ??= now();
          this.ready();
        },
        onSpeechStart: () => {
          if (!live()) return;
          this.speechVis ??= visibleMs();
          this.set({ activity: 'speech' });
        },
        onSoundStart: () => {
          if (live() && this.state.activity !== 'speech') this.set({ activity: 'sound' });
        },
        onSoundEnd: () => {
          if (live() && this.state.phase === 'listening') this.set({ activity: 'waiting' });
        },
        onSpeechEnd: () => {
          if (live() && this.state.phase === 'listening') this.set({ activity: 'waiting' });
        },
        onResult: (u: RecognitionUpdate) => {
          if (!live()) return;
          this.firstResultVis ??= visibleMs();
          if (u.interim) this.lastInterim = u.interim;
          if (u.finalAlts) {
            this.alts = u.finalAlts;
            this.confidences = u.finalConfidences ?? u.finalAlts.map(() => null);
            this.endVis = visibleMs();
          }
          this.set({
            transcript: u.transcript ?? u.finalAlts?.[0] ?? u.interim,
            results: this.state.results + 1,
            activity: this.state.activity === 'waiting' || this.state.activity === 'none' ? 'speech' : this.state.activity,
          });
        },
        onNoMatch: () => {
          if (live()) this.errors.push({ code: 'nomatch', atMs: Math.round(visibleMs()) });
        },
        onError: (code) => {
          if (!live() || code === 'aborted') return;
          if (code === PHRASES_NOT_SUPPORTED && options.phrases) {
            // Remember it and repeat the same attempt without hints; not a retry of the user.
            this.errors.push({ code, atMs: Math.round(visibleMs()) });
            this.phrasesBlocked = true;
            this.deps.onPhrasesUnsupported?.();
            this.begin(false);
            return;
          }
          this.fail(code);
        },
        onEnd: () => {
          if (!live() || this.state.phase === 'failed') return;
          this.finish();
        },
      }, options);
    } catch (e) {
      this.fail(e instanceof RecognitionStartError ? e.stage : 'start');
      return;
    }
    this.watchdog = clock.setTimeout(() => {
      if (live() && this.startAt === null && this.audioAt === null) this.fail('watchdog');
    }, MIC_WATCHDOG_MS);
  }

  private ready(): void {
    if (this.watchdog !== null) this.deps.clock.clearTimeout(this.watchdog);
    this.watchdog = null;
    if (this.state.phase === 'starting') this.set({ phase: 'listening', activity: 'waiting' });
  }

  private finish(): void {
    this.stopSession();
    const interim = this.lastInterim.trim();
    if (!this.alts && interim) {
      // Ended without a final result: keep what was heard.
      this.alts = [interim];
      this.confidences = [null];
      this.endVis = this.deps.visibleMs();
    }
    if (!this.alts) {
      this.fail('no-result');
      return;
    }
    this.set({ phase: 'done', transcript: this.alts[0]!, failuresInRow: 0, activity: 'none' });
  }

  /** Stops without a result (leaving the card, switching to typing). */
  abort(): void {
    this.attempt++;
    this.stopSession();
    if (this.state.phase === 'starting' || this.state.phase === 'listening') this.set({ phase: 'idle', activity: 'none' });
  }

  /** Timings and alternatives of the last attempt, plus every error of the card. */
  outcome(): VoiceOutcome {
    const ready = this.audioAt ?? this.startAt;
    let speech: number | null = this.speechVis;
    let latencySource: LatencySource | null = speech !== null ? 'speechstart' : null;
    if (speech === null && this.firstResultVis !== null) {
      speech = this.firstResultVis;
      latencySource = 'result';
    }
    const latency = speech === null ? null : believableLatency(speech - Math.max(0, ready?.vis ?? 0));
    return {
      alternatives: this.alts ?? [],
      confidences: this.alts ? this.confidences : [],
      latencyMs: latency === null ? null : Math.round(latency),
      latencySource: latency === null ? null : latencySource,
      micDelayMs: ready ? Math.round(ready.real - this.requestedAt) : null,
      readyMs: ready ? Math.round(ready.vis) : null,
      totalMs: this.endVis === null ? null : Math.round(this.endVis),
      errors: [...this.errors],
      retries: Math.max(0, this.attempts - 1),
      phrasesCount: this.sent.phrases,
      processLocally: this.sent.local,
      repeatHint: this.errors.some((e) => UNRECOGNISED_CODES.includes(e.code)),
      troubled: this.attempts > 1 || this.errors.some((e) => TROUBLE_CODES.includes(e.code)),
    };
  }
}
