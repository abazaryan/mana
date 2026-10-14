/** One line under the microphone: starting, listening, or why it failed. */
import type { VoiceState } from '../core/voice';
import { useI18n } from './i18n';
import { STRINGS, type StringKey } from './strings';

export function MicStatus({ state }: { state: VoiceState }) {
  const { t } = useI18n();
  if (state.phase === 'starting') return <p className="status">{t('mic.starting')}</p>;
  if (state.phase === 'listening') {
    return (
      <p className="status listening">
        <span className="pulse" aria-hidden="true" /> {t('mic.listening')}
      </p>
    );
  }
  if (state.phase === 'failed' && state.error) {
    const key = `mic.err.${state.error}`;
    const text = key in STRINGS ? t(key as StringKey) : t('mic.err.other', { code: state.error });
    return (
      <p className="status err" role="alert">
        {text}
      </p>
    );
  }
  return null;
}
