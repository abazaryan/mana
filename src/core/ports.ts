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

export interface SpeechRecognizer {
  readonly supported: boolean;
  /** Throws RecognitionStartError if the recognizer cannot be created or started. */
  start(lang: string, handlers: RecognitionHandlers): RecognitionSession;
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
