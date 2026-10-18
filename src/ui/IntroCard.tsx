/**
 * Introduction of an entry (Р3, Р22.5), step by step — each step replaces the one
 * before it (amendments of 15.10.2026):
 *   1. the card: text, IPA, meaning, gender, form, hint, note; the audio plays;
 *   2. "say it aloud": recognised and marked, never rated, may be skipped;
 *   3. "copy it out" (entries with the skill `write` only): checked by the written
 *      check (Р24), never rated.
 * Nothing goes to FSRS; the journal gets one introduction record at the end.
 */
import { useEffect, useState } from 'react';
import { introHints, pickLocalizedWithLang } from '../core/deckFormat';
import type { LanguagePack } from '../core/languages';
import type { EntryRow, IntroCopy, IntroEcho } from '../core/model';
import type { ManaDb } from '../platform/db';
import { useI18n } from './i18n';
import { CopyStep, EchoStep, SKIPPED_ECHO } from './PracticeSteps';
import { LANG_NAMES } from './strings';
import { playEntry, recognitionSupported, stopEntryAudio, type RecognitionSetup } from './studyHooks';

export interface IntroResult {
  echo: IntroEcho;
  copy: IntroCopy | null;
}

type Step = 'card' | 'echo' | 'copy';

export function IntroCard({
  db,
  entry,
  pack,
  locale,
  recognition,
  onDone,
}: {
  db: ManaDb;
  entry: EntryRow;
  pack: LanguagePack;
  locale: string;
  recognition: RecognitionSetup;
  onDone(r: IntroResult): void;
}) {
  const { t, lang, meaningLang } = useI18n();
  const [step, setStep] = useState<Step>('card');
  const [audioError, setAudioError] = useState(false);
  const [echo, setEcho] = useState<IntroEcho>(SKIPPED_ECHO);
  const needsCopy = entry.skills.includes('write');

  const play = () => {
    setAudioError(false);
    playEntry(db, entry, locale).catch(() => setAudioError(true));
  };
  useEffect(() => {
    play();
    return stopEntryAudio;
    // Once per card.
  }, []);

  /** Leaves "say it aloud": on to copying, or done. */
  const afterEcho = (e: IntroEcho) => {
    setEcho(e);
    if (needsCopy) setStep('copy');
    else onDone({ echo: e, copy: null });
  };

  if (step === 'echo') {
    return (
      <EchoStep
        db={db}
        entry={entry}
        pack={pack}
        locale={locale}
        recognition={recognition}
        kicker={t('intro.label')}
        start="now"
        onDone={afterEcho}
      />
    );
  }
  if (step === 'copy') {
    return (
      <CopyStep
        db={db}
        entry={entry}
        pack={pack}
        locale={locale}
        kicker={t('intro.label')}
        onDone={(copy) => onDone({ echo, copy })}
      />
    );
  }

  const meaning = pickLocalizedWithLang(entry.meaning, meaningLang);
  const hint = pickLocalizedWithLang(entry.hint, meaningLang);
  const note = pickLocalizedWithLang(entry.note, meaningLang);
  const hints = introHints(entry.gender, entry.form, lang);
  return (
    <article className="study-card">
      <p className="kicker">{t('intro.label')}</p>
      <div className="intro-head">
        <div className="intro-text" lang={pack.code}>
          {entry.text}
        </div>
        <button className="play" type="button" aria-label={`${t('deck.play')}: ${entry.text}`} onClick={play}>
          ▶
        </button>
      </div>
      {audioError && (
        <p className="hint err" role="alert">
          {t('deck.audioError')}
        </p>
      )}
      {entry.ipa && <p className="m ipa">[{entry.ipa}]</p>}
      {meaning && (
        <p className="meaning" lang={meaning.lang}>
          {meaning.text}
          {meaning.lang !== meaningLang && (
            <span className="chip lang-mark" title={LANG_NAMES[meaning.lang]}>
              {meaning.lang}
            </span>
          )}
        </p>
      )}
      {hints.length > 0 && <p className="m">{hints.join(' · ')}</p>}
      {hint && (
        <p className="m" lang={hint.lang}>
          {hint.text}
        </p>
      )}
      {note && (
        <p className="m note-text" lang={note.lang}>
          {note.text}
        </p>
      )}
      <button
        className="primary big mt"
        type="button"
        onClick={() => {
          stopEntryAudio();
          // The microphone starts with the next step, right after this tap (as on a `speak` card).
          if (recognitionSupported) setStep('echo');
          else afterEcho(SKIPPED_ECHO);
        }}
      >
        {t('common.next')}
      </button>
    </article>
  );
}
