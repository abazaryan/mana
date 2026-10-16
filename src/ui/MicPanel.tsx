/**
 * The microphone block (amendment of 16.10.2026): the same size and place as the
 * large typing field. While the recognizer listens — a large 🎤 with a ring and
 * "Say the answer"; the ring follows the recognizer's own events (silence → sound
 * → speech, a flash on each result). No second microphone stream: on Chrome Android
 * it would compete with recognition. When listening stops — the ring is gone and
 * the block is the "Speak" button; an error, if any, below it.
 */
import type { VoiceState } from '../core/voice';
import { useI18n } from './i18n';
import { MicStatus } from './MicStatus';
import type { StringKey } from './strings';

export function MicPanel({ state, onStart, startLabel }: { state: VoiceState; onStart(): void; startLabel: StringKey }) {
  const { t } = useI18n();
  const listening = state.phase === 'starting' || state.phase === 'listening';
  if (listening) {
    return (
      <div className={`micpanel on act-${state.activity}`} role="status" aria-live="polite">
        <span className="micring" aria-hidden="true">
          <span className="ring" />
          {state.results > 0 && <span className="flash" key={state.results} />}
          <span className="icon">🎤</span>
        </span>
        <span className="lbl">{state.phase === 'starting' ? t('mic.starting') : t('speak.prompt')}</span>
      </div>
    );
  }
  return (
    <>
      <button className="micpanel off" type="button" onClick={onStart}>
        <span className="micring" aria-hidden="true">
          <span className="icon">🎤</span>
        </span>
        <span className="lbl">{t(startLabel)}</span>
      </button>
      <MicStatus state={state} />
    </>
  );
}
