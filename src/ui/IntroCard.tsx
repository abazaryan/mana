/**
 * Introduction of an entry (Р3, Р22.5), step by step — each step replaces the one
 * before it (amendments of 15.10.2026):
 *   1. the card: text, IPA, meaning, gender, form, hint, note; the audio plays;
 *   2. "say it aloud": recognised and marked, never rated, may be skipped;
 *   3. "copy it out" (entries with the skill `write` only): checked by the written
 *      cascade, never rated.
 * Nothing goes to FSRS; the journal gets one introduction record at the end.
 */
import { useEffect, useMemo, useState } from 'react';
import { checkTyped, type TypedCheck } from '../core/evaluate';
import { FORM_LABELS, formHints, pickLocalizedWithLang } from '../core/deckFormat';
import type { LanguagePack } from '../core/languages';
import type { EntryRow, IntroCopy, IntroEcho } from '../core/model';
import { checkSpoken, liveHeard, tokenizeSpoken, type SpokenCheck } from '../core/spoken';
import type { ManaDb } from '../platform/db';
import { useI18n } from './i18n';
import { CharMarks, LiveWords, SpokenMarks } from './Marks';
import { MicPanel } from './MicPanel';
import { LANG_NAMES } from './strings';
import { playEntry, recognitionSupported, stopEntryAudio, useVisibleClock, useVoice, type RecognitionSetup } from './studyHooks';

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
  const visibleMs = useVisibleClock();
  const voice = useVoice(locale, visibleMs, recognition);
  const [step, setStep] = useState<Step>('card');
  const [audioError, setAudioError] = useState(false);
  const [echo, setEcho] = useState<{ check: SpokenCheck; alternatives: string[]; mode: 'voice' | 'typed' } | null>(null);
  /** Three unrecognised attempts in a row: the microphone gives way to a large, highlighted field (as in `speak`). */
  const gaveUp = voice.state.failuresInRow >= 3;
  const [echoTyped, setEchoTyped] = useState('');
  const [typed, setTyped] = useState('');
  const [copy, setCopy] = useState<TypedCheck | null>(null);
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

  const { phase, transcript } = voice.state;
  useEffect(() => {
    if (phase !== 'done') return;
    const alternatives = voice.outcome().alternatives;
    setEcho({ check: checkSpoken(entry.text, alternatives, pack.spoken), alternatives, mode: 'voice' });
    // On each finished attempt.
  }, [phase]);

  const words = useMemo(() => {
    const tokens = tokenizeSpoken(entry.text, pack.spoken);
    return tokens.map((tk, k) => {
      const next = tokens[k + 1];
      const join = tk.glue || (!next || tk.text.endsWith("'") || next.word === tk.word ? '' : ' ');
      return { text: tk.text, join };
    });
  }, [entry.text, pack.spoken]);
  const live = useMemo(() => liveHeard(entry.text, transcript, pack.spoken), [entry.text, transcript, pack.spoken]);
  const listening = phase === 'starting' || phase === 'listening';

  const finish = (echoSkipped: boolean, copyResult: TypedCheck | null) => {
    voice.abort();
    stopEntryAudio();
    const o = voice.outcome();
    onDone({
      echo: {
        answer: echoSkipped ? '' : (echo?.check.answer ?? ''),
        alternatives: echoSkipped ? [] : (echo?.alternatives ?? []),
        verdict: echoSkipped ? null : (echo?.check.verdict ?? null),
        skipped: echoSkipped || echo === null,
        mode: echo?.mode ?? 'voice',
        recognitionErrors: o.errors,
        retries: o.retries,
        repeats: echoSkipped ? 0 : (echo?.check.repeats ?? 0),
      },
      copy: copyResult ? { typed, verdict: copyResult.evaluation.verdict, errorType: copyResult.evaluation.errorType ?? null } : null,
    });
  };

  /** Leaves "say it aloud": on to copying, or done. */
  const afterEcho = (skipped: boolean) => {
    voice.abort();
    stopEntryAudio();
    if (skipped) setEcho(null);
    if (needsCopy) setStep('copy');
    else finish(skipped, null);
  };

  const head = (
    <>
      <p className="kicker">{t('intro.label')}</p>
      <div className="intro-head">
        {step === 'echo' && listening ? (
          <LiveWords words={words} heard={live} lang={pack.code} />
        ) : (
          <div className="intro-text" lang={pack.code}>
            {entry.text}
          </div>
        )}
        <button className="play" type="button" aria-label={`${t('deck.play')}: ${entry.text}`} onClick={play}>
          ▶
        </button>
      </div>
      {audioError && (
        <p className="hint err" role="alert">
          {t('deck.audioError')}
        </p>
      )}
    </>
  );

  if (step === 'card') {
    const meaning = pickLocalizedWithLang(entry.meaning, meaningLang);
    const hint = pickLocalizedWithLang(entry.hint, meaningLang);
    const note = pickLocalizedWithLang(entry.note, meaningLang);
    const hints = [...(entry.gender ? [FORM_LABELS.gender[entry.gender][lang]] : []), ...formHints(entry.form, lang)];
    return (
      <article className="study-card">
        {head}
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
            if (recognitionSupported) {
              setStep('echo');
              // The microphone starts in this tap, as on a `speak` card.
              voice.start();
            } else {
              afterEcho(true);
            }
          }}
        >
          {t('common.next')}
        </button>
      </article>
    );
  }

  if (step === 'echo') {
    return (
      <article className="study-card">
        {head}
        <h2 className="h3 step-title">{t('intro.echo')}</h2>
        {echo && !listening && <SpokenMarks check={echo.check} lang={pack.code} source={echo.mode} />}
        {gaveUp ? (
          <form
            className="typebox loud"
            onSubmit={(e) => {
              e.preventDefault();
              if (echoTyped.trim()) setEcho({ check: checkSpoken(entry.text, [echoTyped], pack.spoken), alternatives: [], mode: 'typed' });
            }}
          >
            <input
              lang={pack.code}
              value={echoTyped}
              placeholder={t('speak.typePlaceholder')}
              onChange={(e) => {
                setEchoTyped(e.target.value);
                setEcho(null);
              }}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={t('speak.typePlaceholder')}
            />
            <button className="primary" type="submit" disabled={!echoTyped.trim()}>
              {t('speak.check')}
            </button>
          </form>
        ) : (
          <MicPanel state={voice.state} onStart={() => voice.start()} startLabel={echo ? 'intro.again' : 'mic.start'} />
        )}
        <div className="row start">
          {!echo && (
            <button className="ghost" type="button" onClick={() => afterEcho(true)}>
              {t('intro.skip')}
            </button>
          )}
        </div>
        <button className="primary big mt" type="button" disabled={!echo} onClick={() => afterEcho(false)}>
          {t('common.next')}
        </button>
      </article>
    );
  }

  return (
    <article className="study-card">
      {head}
      <h2 className="h3 step-title">{t('intro.copy')}</h2>
      <form
        className="typebox"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) setCopy(checkTyped(entry.text, typed, pack.writing));
        }}
      >
        <input
          lang={pack.code}
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setCopy(null);
          }}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label={t('intro.copy')}
        />
        <button className="secondary" type="submit" disabled={!typed.trim()}>
          {t('speak.check')}
        </button>
      </form>
      {copy && (
        <>
          <CharMarks cells={copy.cells} lang={pack.code} />
          <p className="reason">{t(`reason.${copy.evaluation.verdict}`)}</p>
        </>
      )}
      <button className="primary big mt" type="button" disabled={!copy} onClick={() => finish(echo === null, copy)}>
        {t('common.next')}
      </button>
    </article>
  );
}
