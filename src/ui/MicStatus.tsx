/** Why the microphone stopped, under the "Speak" button (listening itself is shown by MicPanel). */
import type { VoiceState } from '../core/voice';
import { useI18n } from './i18n';
import { STRINGS, type StringKey } from './strings';

export function MicStatus({ state }: { state: VoiceState }) {
  const { t } = useI18n();
  if (state.phase !== 'failed' || !state.error) return null;
  const key = `mic.err.${state.error}`;
  const text = key in STRINGS ? t(key as StringKey) : t('mic.err.other', { code: state.error });
  return (
    <p className="status err" role="alert">
      {text}
    </p>
  );
}
