/**
 * Introduction of an entry (Р3, Р22.5): everything about it with the audio, then
 * "say it aloud" (recognised and marked, never rated, may be skipped), then "copy it
 * out" for entries with the skill `write` (checked by the written cascade, never
 * rated). Nothing goes to FSRS; the journal gets one introduction record.
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
import { MicStatus } from './MicStatus';
import { LANG_NAMES } from './strings';
import { playEntry, recognitionSupported, stopEntryAudio, useVisibleClock, useVoice } from './studyHooks';

export interface IntroResult {
  echo: IntroEcho;
  copy: IntroCopy | null;
}

export function IntroCard({
  db,
  entry,
  pack,
  locale,
  onDone,
}: {
  db: ManaDb;
  entry: EntryRow;
  pack: LanguagePack;
  locale: string;
  onDone(r: IntroResult): void;
}) {
  const { t, lang, meaningLang } = useI18n();
  const visibleMs = useVisibleClock();
  const voice = useVoice(locale, visibleMs);
  const [audioError, setAudioError] = useState(false);
  const [echo, setEcho] = useState<{ check: SpokenCheck; alternatives: string[] } | null>(null);
  const [skipped, setSkipped] = useState(false);
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
    setEcho({ check: checkSpoken(entry.text, alternatives, pack.spoken), alternatives });
    // On each finished attempt.
  }, [phase]);

  const words = useMemo(() => {
    const tokens = tokenizeSpoken(entry.text, pack.spoken);
    return tokens.map((tk, k) => {
      const next = tokens[k + 1];
      const join = !next || tk.text.endsWith("'") ? '' : next.word === tk.word ? '-' : ' ';
      return { text: tk.text, join };
    });
  }, [entry.text, pack.spoken]);
  const live = useMemo(() => liveHeard(entry.text, transcript, pack.spoken), [entry.text, transcript, pack.spoken]);

  const meaning = pickLocalizedWithLang(entry.meaning, meaningLang);
  const hint = pickLocalizedWithLang(entry.hint, meaningLang);
  const note = pickLocalizedWithLang(entry.note, meaningLang);
  const hints = [...(entry.gender ? [FORM_LABELS.gender[entry.gender][lang]] : []), ...formHints(entry.form, lang)];
  const echoFinished = echo !== null || skipped || !recognitionSupported;
  const listening = phase === 'starting' || phase === 'listening';
  const canFinish = echoFinished && (!needsCopy || copy !== null);

  const startEcho = () => {
    setEcho(null);
    setSkipped(false);
    voice.start();
  };
  const skipEcho = () => {
    voice.abort();
    setSkipped(true);
  };

  const finish = () => {
    voice.abort();
    stopEntryAudio();
    onDone({
      echo: {
        answer: echo?.check.answer ?? '',
        alternatives: echo?.alternatives ?? [],
        verdict: echo?.check.verdict ?? null,
        skipped: echo === null,
      },
      copy: copy
        ? { typed, verdict: copy.evaluation.verdict, errorType: copy.evaluation.errorType ?? null }
        : null,
    });
  };

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
      {audioError && (
        <p className="hint err" role="alert">
          {t('deck.audioError')}
        </p>
      )}

      <section className="step">
        <h2 className="h3">{t('intro.echo')}</h2>
        {!recognitionSupported ? (
          <p className="hint">{t('mic.unsupported')}</p>
        ) : (
          <>
            {listening && <LiveWords words={words} heard={live} lang={pack.code} />}
            {echo && <SpokenMarks check={echo.check} lang={pack.code} typed={false} />}
            <MicStatus state={voice.state} />
            <div className="row start">
              {!listening && (
                <button className={echo || skipped ? 'secondary' : 'primary'} type="button" onClick={startEcho}>
                  🎤 {echo || voice.state.phase === 'failed' ? t('intro.again') : t('mic.start')}
                </button>
              )}
              {!echoFinished && (
                <button className="ghost" type="button" onClick={skipEcho}>
                  {t('intro.skip')}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {needsCopy && echoFinished && (
        <section className="step">
          <h2 className="h3">{t('intro.copy')}</h2>
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
        </section>
      )}

      <button className="primary big mt" type="button" disabled={!canFinish} onClick={finish}>
        {t('common.next')}
      </button>
    </article>
  );
}
