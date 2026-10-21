/**
 * "Voice check" (Р33 п. 14): the browser voice says a phrase in the learning language,
 * the user answers whether they heard it. Yes — entries of that language without deck
 * audio may get `listen` on this device; No — how to install a voice, then "Once more".
 * The answer is kept on the device only, per language.
 */
import { useEffect, useState } from 'react';
import { findLanguagePack, speechLocale } from '../core/languages';
import type { MetaRow, VoiceCheck as VoiceAnswer } from '../core/model';
import type { ManaDb } from '../platform/db';
import { onVoicesChanged, voicesFor } from '../platform/speech';
import { setVoiceCheck } from '../platform/repo';
import { useI18n } from './i18n';
import { Sheet } from './Sheet';
import { speakSample, stopEntryAudio } from './studyHooks';

/** Install instructions for this kind of device. */
function howKey(): 'voice.howAndroid' | 'voice.howWindows' | 'voice.howOther' {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Android/i.test(ua)) return 'voice.howAndroid';
  if (/Windows/i.test(ua)) return 'voice.howWindows';
  return 'voice.howOther';
}

interface Props {
  db: ManaDb;
  /** Learning language of the deck (BCP-47). */
  language: string;
  onDone(meta: MetaRow, answer: VoiceAnswer): void;
  onClose(): void;
}

export function VoiceCheckSheet({ db, language, onDone, onClose }: Props) {
  const { t, lang } = useI18n();
  const pack = findLanguagePack(language);
  const locale = speechLocale(language) ?? language;
  const [voices, setVoices] = useState(() => voicesFor(locale));
  const [step, setStep] = useState<'ask' | 'no' | 'yes'>('ask');

  useEffect(() => onVoicesChanged(() => setVoices(voicesFor(locale))), [locale]);
  useEffect(() => stopEntryAudio, []);

  const answer = async (a: VoiceAnswer) => {
    stopEntryAudio();
    const meta = await setVoiceCheck(db, language, a);
    setStep(a);
    onDone(meta, a);
  };
  // Only a list without this language means "no voice"; an empty list (Chrome on Android) leaves it to the ear.
  const none = voices.availability === 'missing';
  const question = pack?.voiceCheck?.question[lang] ?? t('voice.heard');

  return (
    <Sheet title={t('voice.title')} onClose={onClose} closeLabel={t('common.close')}>
      {step === 'yes' ? (
        <p>{t('voice.ok')}</p>
      ) : (
        <>
          {none && <p className="hint err">{t('voice.none')}</p>}
          {step === 'ask' && !none && (
            <>
              <p>{t('voice.intro')}</p>
              <button className="secondary big" type="button" onClick={() => speakSample(pack?.voiceCheck?.sample ?? 'Bonjour', locale)}>
                ▶ {t('deck.play')}
              </button>
              <p className="mt">
                <strong>{question}</strong>
              </p>
              <div className="row">
                <button className="secondary" type="button" onClick={() => void answer('no')}>
                  {t('voice.no')}
                </button>
                <button className="primary" type="button" onClick={() => void answer('yes')}>
                  {t('voice.yes')}
                </button>
              </div>
            </>
          )}
          {(step === 'no' || none) && (
            <>
              <p className="mt">{t(howKey())}</p>
              <p className="hint">{t('voice.rule')}</p>
              <button
                className="primary"
                type="button"
                onClick={() => {
                  setVoices(voicesFor(locale));
                  setStep('ask');
                }}
              >
                {t('intro.again')}
              </button>
            </>
          )}
        </>
      )}
      {voices.names[0] && <p className="hint mt">{voices.names[0]}</p>}
    </Sheet>
  );
}
