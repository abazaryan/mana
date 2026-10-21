/** Browser wiring of a study card: visible-time clock, microphone, entry audio. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceText } from '../core/deckFormat';
import { applyElapsed, elapsedMs, startElapsed, type ElapsedState } from '../core/latency';
import type { AudioSource, BiasingState, EntryRow, SpeechPackState } from '../core/model';
import type { RecognitionOptions } from '../core/ports';
import { VoiceCapture, type VoiceOutcome, type VoiceState } from '../core/voice';
import { playAudio, stopAudio } from '../platform/audio';
import type { ManaDb } from '../platform/db';
import { browserClock } from '../platform/device';
import { getMedia } from '../platform/repo';
import { createBrowserRecognizer, createBrowserSpeaker } from '../platform/speech';

const recognizer = createBrowserRecognizer();
const speaker = createBrowserSpeaker();

export const recognitionSupported = recognizer.supported;
/** The browser has the hints API at all (it may still reject them with `phrases-not-supported`). */
export const phrasesApiPresent = recognizer.phrasesSupported === true;
export const recognizerId = recognizer.id ?? null;

/** Recognizer hints for the cards of one session (decided by the study screen). */
export interface RecognitionSetup {
  options: RecognitionOptions;
  biasing: BiasingState;
  speechPack: SpeechPackState | null;
  /** Called once when the browser rejects the hints. */
  onPhrasesUnsupported(): void;
}

export const NO_HINTS: RecognitionSetup = { options: {}, biasing: 'off', speechPack: null, onPhrasesUnsupported: () => {} };

/** Visible milliseconds since the component mounted (stops while the tab is hidden, latency.ts). */
export function useVisibleClock(): () => number {
  const ref = useRef<ElapsedState | null>(null);
  if (ref.current === null) ref.current = startElapsed(performance.now(), document.visibilityState === 'visible');
  useEffect(() => {
    const on = () => {
      ref.current = applyElapsed(ref.current!, {
        type: document.visibilityState === 'visible' ? 'show' : 'hide',
        at: performance.now(),
      });
    };
    document.addEventListener('visibilitychange', on);
    window.addEventListener('pagehide', on);
    return () => {
      document.removeEventListener('visibilitychange', on);
      window.removeEventListener('pagehide', on);
    };
  }, []);
  return useCallback(() => elapsedMs(ref.current!, performance.now()), []);
}

export interface Voice {
  state: VoiceState;
  /** `counted` false: not a retry of the user (restart after replaying the audio). */
  start(counted?: boolean): void;
  abort(): void;
  outcome(): VoiceOutcome;
}

/** One VoiceCapture per mounted card; aborted on unmount. */
export function useVoice(lang: string, visibleMs: () => number, setup: RecognitionSetup = NO_HINTS): Voice {
  const [state, setState] = useState<VoiceState>({ phase: 'idle', transcript: '', error: null, fatal: false, failuresInRow: 0, activity: 'none', results: 0 });
  const setupRef = useRef(setup);
  setupRef.current = setup;
  const ref = useRef<VoiceCapture | null>(null);
  if (ref.current === null) {
    ref.current = new VoiceCapture({
      recognizer,
      clock: browserClock,
      visibleMs,
      lang,
      onChange: setState,
      options: () => setupRef.current.options,
      onPhrasesUnsupported: () => setupRef.current.onPhrasesUnsupported(),
    });
  }
  useEffect(() => {
    const v = ref.current!;
    return () => v.abort();
  }, []);
  return {
    state,
    start: (counted = true) => {
      stopAudio();
      speaker.cancel();
      ref.current!.start(counted);
    },
    abort: () => ref.current!.abort(),
    outcome: () => ref.current!.outcome(),
  };
}

/** How the entry sounded on the card on screen (Р33 п. 14); reset when a card is shown. */
let sounded: { audioSource: AudioSource; voice: string | null } = { audioSource: 'none', voice: null };

/** Forget how the previous card sounded: call when a card (or its short practice) is shown. */
export function resetSoundStamp(): void {
  sounded = { audioSource: 'none', voice: null };
}

/** For the journal record of the card on screen: `audioSource` and `voice`. */
export function soundStamp(): { audioSource: AudioSource; voice: string | null } {
  return { ...sounded };
}

/**
 * Deck audio of the entry; the browser voice only when the entry has none (Р33 п. 14).
 * Rejects if the file cannot play. `onEnded`: the sound played to the end (not called
 * when stopped; for the browser voice also after a failure, so `listen` goes on).
 */
export async function playEntry(db: ManaDb, entry: EntryRow, locale: string, onEnded?: () => void): Promise<void> {
  speaker.cancel();
  if (!entry.audio) {
    stopAudio();
    speaker.speak(voiceText(entry), locale, onEnded, (voice) => {
      sounded = { audioSource: 'browser', voice };
    });
    return;
  }
  const media = await getMedia(db, entry.deckId, entry.audio);
  if (!media) throw new Error('no media');
  await playAudio(media.data, media.type, onEnded);
  sounded = { audioSource: 'file', voice: null };
}

/** A sample phrase in the browser voice of `locale` ("Voice check", Р33 п. 14). */
export function speakSample(text: string, locale: string, onEnded?: () => void): void {
  stopAudio();
  speaker.cancel();
  speaker.speak(text, locale, onEnded);
}

export function stopEntryAudio(): void {
  stopAudio();
  speaker.cancel();
}
