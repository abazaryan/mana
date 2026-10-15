/**
 * Thin interfaces to browser capabilities. Core logic depends only on these;
 * real implementations live in src/platform, fakes in tests.
 */

export interface RecognitionUpdate {
  /** Alternatives of a final result in this event, if any. */
  finalAlts: string[] | null;
  /** Recognizer confidence of each final alternative (null where the browser gives none). */
  finalConfidences?: (number | null)[];
  /** Concatenated interim transcript in this event. */
  interim: string;
  /** Everything recognised so far in this session, final and interim (live highlight). */
  transcript?: string;
}

export interface RecognitionHandlers {
  onStart(): void;
  /** The microphone really captures sound (`audiostart`). */
  onAudioStart?(): void;
  onSpeechStart(): void;
  onResult(update: RecognitionUpdate): void;
  /** Speech was heard but nothing recognised (`nomatch`). */
  onNoMatch?(): void;
  onError(code: string): void;
  onEnd(): void;
}

export interface RecognitionSession {
  /** Stops immediately; no further handler calls. */
  abort(): void;
}

export class RecognitionStartError extends Error {
  readonly stage: 'create' | 'start';
  constructor(stage: 'create' | 'start') {
    super(`recognition ${stage} failed`);
    this.stage = stage;
  }
}

/**
 * Optional hints for one recognition session. Each adapter maps them to its own
 * service (Web Speech: `phrases` + `processLocally`; a cloud service: its prompt or
 * keywords) or ignores what it cannot use.
 */
export interface RecognitionOptions {
  /** Words or phrases the recognizer should expect (contextual biasing). */
  phrases?: readonly string[];
  /** Recognise on the device, not in the browser's cloud service. */
  processLocally?: boolean;
}

/**
 * The speech recognizer as the core sees it. The core never touches a browser API:
 * Chrome / Edge Web Speech is one adapter (src/platform/speech.ts); a cloud service
 * (Whisper, Deepgram through a server proxy, Google) would be another one.
 *
 * Error codes are a shared vocabulary taken from Web Speech: `no-speech`, `aborted`,
 * `audio-capture`, `network`, `not-allowed`, `service-not-allowed`,
 * `language-not-supported`, `phrases-not-supported`; an adapter maps its own
 * errors onto these and passes unknown ones through as they are.
 */
export interface SpeechRecognizer {
  readonly supported: boolean;
  /** The adapter can take `phrases` (it may still answer `phrases-not-supported`). */
  readonly phrasesSupported?: boolean;
  /** Short id written to the journal, e.g. `web-speech`. */
  readonly id?: string;
  /** Throws RecognitionStartError if the recognizer cannot be created or started. */
  start(lang: string, handlers: RecognitionHandlers, options?: RecognitionOptions): RecognitionSession;
}

export interface Speaker {
  speak(text: string, lang: string): void;
  cancel(): void;
}

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
