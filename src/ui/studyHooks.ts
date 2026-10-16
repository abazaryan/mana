/** Browser wiring of a study card: visible-time clock, microphone, entry audio. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyElapsed, elapsedMs, startElapsed, type ElapsedState } from '../core/latency';
import type { BiasingState, EntryRow, SpeechPackState } from '../core/model';
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

/**
 * Deck audio of the entry; the browser voice only when the entry has none. Rejects if
 * it cannot play. `onEnded`: the sound played to the end (not called when stopped).
 */
export async function playEntry(db: ManaDb, entry: EntryRow, locale: string, onEnded?: () => void): Promise<void> {
  speaker.cancel();
  if (!entry.audio) {
    stopAudio();
    speaker.speak(entry.text, locale, onEnded);
    return;
  }
  const media = await getMedia(db, entry.deckId, entry.audio);
  if (!media) throw new Error('no media');
  await playAudio(media.data, media.type, onEnded);
}

export function stopEntryAudio(): void {
  stopAudio();
  speaker.cancel();
}
