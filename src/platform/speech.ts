import { voiceAvailability, voicesOf, type VoiceAvailability } from '../core/voices';
import {
  RecognitionStartError,
  type RecognitionHandlers,
  type RecognitionOptions,
  type RecognitionSession,
  type Speaker,
  type SpeechRecognizer,
} from '../core/ports';

// Minimal typings for the Web Speech API (not in lib.dom for all TS versions).
interface SRAlternative {
  transcript: string;
  confidence?: number;
}
interface SRResult {
  readonly isFinal: boolean;
  readonly length: number;
  [i: number]: SRAlternative;
}
interface SREvent {
  resultIndex: number;
  results: { length: number; [i: number]: SRResult };
}
interface SRInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  processLocally?: boolean;
  phrases?: unknown[];
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onsoundstart: (() => void) | null;
  onsoundend: (() => void) | null;
  onnomatch: (() => void) | null;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type SRConstructor = new () => SRInstance;

function getSRConstructor(): SRConstructor | null {
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type PhraseConstructor = new (phrase: string, boost?: number) => unknown;

function getPhraseConstructor(): PhraseConstructor | null {
  const w = window as unknown as { SpeechRecognitionPhrase?: PhraseConstructor };
  return typeof window !== 'undefined' ? (w.SpeechRecognitionPhrase ?? null) : null;
}

export function isRecognitionSupported(): boolean {
  return getSRConstructor() !== null;
}

export function createBrowserRecognizer(): SpeechRecognizer {
  const SR = getSRConstructor();
  const Phrase = getPhraseConstructor();
  return {
    supported: SR !== null,
    phrasesSupported: SR !== null && Phrase !== null && 'phrases' in SR.prototype,
    id: 'web-speech',
    start(lang: string, h: RecognitionHandlers, options: RecognitionOptions = {}): RecognitionSession {
      if (!SR) throw new RecognitionStartError('create');
      let r: SRInstance;
      try {
        r = new SR();
      } catch {
        throw new RecognitionStartError('create');
      }
      r.lang = lang;
      r.interimResults = true;
      r.maxAlternatives = 3;
      r.continuous = false;
      if (options.processLocally) r.processLocally = true;
      if (options.phrases?.length && Phrase && 'phrases' in r) {
        // Boost 1.0 is the default of the spec (range 0–10).
        r.phrases = options.phrases.map((p) => new Phrase(p, 1));
      }
      r.onstart = () => h.onStart();
      r.onspeechstart = () => h.onSpeechStart();
      r.onaudiostart = () => h.onAudioStart?.();
      r.onsoundstart = () => h.onSoundStart?.();
      r.onsoundend = () => h.onSoundEnd?.();
      r.onspeechend = () => h.onSpeechEnd?.();
      r.onnomatch = () => h.onNoMatch?.();
      r.onresult = (e) => {
        let finalAlts: string[] | null = null;
        let finalConfidences: (number | null)[] | undefined;
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (!res) continue;
          if (res.isFinal) {
            const alts: string[] = [];
            const conf: (number | null)[] = [];
            for (let k = 0; k < res.length; k++) {
              const t = (res[k]?.transcript ?? '').trim();
              if (!t) continue;
              alts.push(t);
              const c = res[k]?.confidence;
              // Chrome reports 0 when it has no estimate.
              conf.push(typeof c === 'number' && c > 0 ? c : null);
            }
            if (alts.length) {
              finalAlts = alts;
              finalConfidences = conf;
            }
          } else {
            interim += res[0]?.transcript ?? '';
          }
        }
        let transcript = '';
        for (let i = 0; i < e.results.length; i++) transcript += ' ' + (e.results[i]?.[0]?.transcript ?? '');
        transcript = transcript.replace(/\s+/g, ' ').trim();
        h.onResult({ finalAlts, ...(finalConfidences ? { finalConfidences } : {}), interim, transcript });
      };
      r.onerror = (e) => h.onError(e.error ?? 'unknown');
      r.onend = () => h.onEnd();
      const detach = () => {
        r.onstart = r.onaudiostart = r.onspeechstart = r.onspeechend = r.onsoundstart = r.onsoundend = r.onnomatch = r.onresult = r.onerror = r.onend = null;
      };
      try {
        r.start();
      } catch {
        detach();
        throw new RecognitionStartError('start');
      }
      return {
        abort() {
          detach();
          try {
            r.abort();
          } catch {
            /* ignore */
          }
        },
      };
    },
  };
}

/** The voice that speaks `lang`: on-device first (R33 item 14, `src/core/voices.ts`). */
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  return voicesOf(speechSynthesis.getVoices() ?? [], lang)[0];
}

export function createBrowserSpeaker(): Speaker {
  const available = typeof window !== 'undefined' && 'speechSynthesis' in window;
  return {
    speak(text, lang, onEnd, onStart) {
      if (!available) return;
      const u = new SpeechSynthesisUtterance(text);
      if (onEnd) u.onend = () => onEnd();
      u.onerror = (e) => {
        if (e.error !== 'canceled' && e.error !== 'interrupted') onEnd?.();
      };
      u.lang = lang;
      u.rate = 0.95;
      const v = pickVoice(lang);
      if (v) u.voice = v;
      if (onStart) u.onstart = () => onStart(v?.name ?? null);
      speechSynthesis.speak(u);
    },
    cancel() {
      if (available) speechSynthesis.cancel();
    },
  };
}

/**
 * What the browser says about voices of a language: whether it can be said that there
 * is none (an empty list is only "unknown", see `voiceAvailability`), and the names of
 * the matching voices, the one that will speak first.
 */
export function voicesFor(lang: string): { availability: VoiceAvailability; names: string[] } {
  try {
    const all = speechSynthesis.getVoices() ?? [];
    return { availability: voiceAvailability(all, lang), names: voicesOf(all, lang).map((v) => v.name) };
  } catch {
    return { availability: 'unknown', names: [] };
  }
}

export function countFrenchVoices(): number {
  try {
    return (speechSynthesis.getVoices() ?? []).filter((v) => /^fr/i.test(v.lang)).length;
  } catch {
    return 0;
  }
}

/** Calls `fn` when the browser's voice list changes; returns an unsubscribe function. */
export function onVoicesChanged(fn: () => void): () => void {
  try {
    speechSynthesis.addEventListener('voiceschanged', fn);
    return () => speechSynthesis.removeEventListener('voiceschanged', fn);
  } catch {
    return () => {};
  }
}
