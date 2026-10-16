/**
 * The microphone (amendments of 16.10.2026): a large round button in the middle of
 * the card that is also the indicator. While the recognizer listens, two or three
 * translucent rings spread from it; they grow wider and brighter while it hears a
 * voice and pulse calmly in silence. They follow the recognizer's own events — no
 * second microphone stream (on Chrome Android it would compete with recognition).
 * When listening stops the rings go, the circle dims, and a tap starts again.
 */
import type { VoiceState } from '../core/voice';
import { useI18n } from './i18n';
import { MicStatus } from './MicStatus';
import type { StringKey } from './strings';

export function MicPanel({ state, onStart, startLabel }: { state: VoiceState; onStart(): void; startLabel: StringKey }) {
  const { t } = useI18n();
  const listening = state.phase === 'starting' || state.phase === 'listening';
  // Under the circle always the same short line; "Speak" / "Once more" names the button for screen readers.
  const caption = state.phase === 'starting' ? t('mic.starting') : t('speak.prompt');
  return (
    <div className={`mic2 ${listening ? `on act-${state.activity}` : 'off'}`}>
      <div className="mic2-stage">
      <button
        className="mic2-btn"
        type="button"
        onClick={listening ? undefined : onStart}
        aria-disabled={listening}
        aria-label={listening ? caption : t(startLabel)}
      >
        {listening && (
          <span className="mic2-rings" aria-hidden="true">
            <i />
            <i />
            <i />
            {state.results > 0 && <b key={state.results} />}
          </span>
        )}
        <svg className="mic2-icon" viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
          <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      </div>
      <span className="mic2-cap" aria-live="polite">
        {caption}
      </span>
      <MicStatus state={state} />
    </div>
  );
}
