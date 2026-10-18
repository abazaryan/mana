/**
 * The two practice steps with the reference on screen, never rated:
 *   "say it aloud" — recognised and marked word by word, live while listening;
 *   "copy it out"  — checked by the written check (Р24) and marked letter by letter.
 * Used in an introduction (Р22.5) and as the short practice after Again (Р17.11, Р25).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { checkWritten, type TypedCheck } from '../core/evaluate';
import type { LanguagePack } from '../core/languages';
import type { EntryRow, IntroCopy, IntroEcho } from '../core/model';
import { checkSpoken, liveHeard, tokenizeSpoken, type SpokenCheck } from '../core/spoken';
import type { ManaDb } from '../platform/db';
import { useI18n } from './i18n';
import { CharMarks, LiveWords, SpokenMarks } from './Marks';
import { MicPanel } from './MicPanel';
import { NextButton } from './NextButton';
import { TypeField } from './TypeField';
import { playEntry, recognitionSupported, stopEntryAudio, useVisibleClock, useVoice, type RecognitionSetup } from './studyHooks';

/** What `write` checks about the article of this entry (Р24). */
export function articleForm(entry: EntryRow) {
  return { determiner: entry.form?.determiner !== undefined, gender: entry.form?.gender ?? entry.gender };
}

/** The reference with its play button, at the top of a practice step. */
function EntryHead({
  kicker,
  entry,
  pack,
  onPlay,
  audioError,
  live,
}: {
  kicker: string;
  entry: EntryRow;
  pack: LanguagePack;
  onPlay(): void;
  audioError: boolean;
  /** Words lit as they are recognised; null shows the plain text. */
  live?: { words: { text: string; join: string }[]; heard: boolean[] } | null;
}) {
  const { t } = useI18n();
  return (
    <>
      <p className="kicker">{kicker}</p>
      <div className="intro-head">
        {live ? (
          <LiveWords words={live.words} heard={live.heard} lang={pack.code} />
        ) : (
          <div className="intro-text" lang={pack.code}>
            {entry.text}
          </div>
        )}
        <button className="play" type="button" aria-label={`${t('deck.play')}: ${entry.text}`} onClick={onPlay}>
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
}

/** A skipped "say it aloud" (no recognition in this browser, or skipped before any attempt). */
export const SKIPPED_ECHO: IntroEcho = {
  answer: '',
  alternatives: [],
  verdict: null,
  skipped: true,
  mode: 'voice',
  recognitionErrors: [],
  repeatHintShown: false,
  retries: 0,
  repeats: 0,
};

export function EchoStep({
  db,
  entry,
  pack,
  locale,
  recognition,
  kicker,
  start,
  onDone,
}: {
  db: ManaDb;
  entry: EntryRow;
  pack: LanguagePack;
  locale: string;
  recognition: RecognitionSetup;
  kicker: string;
  /** `now`: the microphone starts with the step (the tap on "Next" is the gesture); `afterAudio`: the audio plays first. */
  start: 'now' | 'afterAudio';
  onDone(echo: IntroEcho): void;
}) {
  const { t } = useI18n();
  const visibleMs = useVisibleClock();
  const voice = useVoice(locale, visibleMs, recognition);
  const [echo, setEcho] = useState<{ check: SpokenCheck; alternatives: string[]; mode: 'voice' | 'typed' } | null>(null);
  const [typed, setTyped] = useState('');
  const [audioError, setAudioError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const startedOnce = useRef(false);
  /** Three unrecognised attempts in a row: the microphone gives way to a large, highlighted field (as in `speak`). */
  const gaveUp = voice.state.failuresInRow >= 3 || !recognitionSupported;

  /** Starts by itself (with the card, after the audio): only the very first start counts as an attempt. */
  const autoListen = () => {
    voice.start(!startedOnce.current);
    startedOnce.current = true;
  };
  /** Started by the user (the circle, "Speak"): a retry like any other. */
  const listen = () => {
    voice.start();
    startedOnce.current = true;
  };
  /** Plays the reference with the microphone off; it listens again when the sound ends. */
  const play = (thenListen: boolean) => {
    voice.abort();
    setAudioError(false);
    setPlaying(true);
    playEntry(db, entry, locale, () => {
      setPlaying(false);
      if (thenListen && recognitionSupported && !gaveUp) autoListen();
    }).catch(() => {
      setPlaying(false);
      setAudioError(true);
    });
  };

  useEffect(() => {
    if (start === 'now') {
      if (recognitionSupported) autoListen();
    } else {
      play(true);
    }
    return stopEntryAudio;
    // Once per step.
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
  const heard = useMemo(() => liveHeard(entry.text, transcript, pack.spoken), [entry.text, transcript, pack.spoken]);
  const listening = phase === 'starting' || phase === 'listening';

  const finish = (skipped: boolean) => {
    voice.abort();
    stopEntryAudio();
    const o = voice.outcome();
    onDone({
      answer: skipped ? '' : (echo?.check.answer ?? ''),
      alternatives: skipped ? [] : (echo?.alternatives ?? []),
      verdict: skipped ? null : (echo?.check.verdict ?? null),
      skipped: skipped || echo === null,
      mode: echo?.mode ?? 'voice',
      recognitionErrors: o.errors,
      repeatHintShown: o.repeatHint,
      retries: o.retries,
      repeats: skipped ? 0 : (echo?.check.repeats ?? 0),
    });
  };

  return (
    <article className="study-card">
      <EntryHead
        kicker={kicker}
        entry={entry}
        pack={pack}
        onPlay={() => play(listening || start === 'afterAudio')}
        audioError={audioError}
        live={listening ? { words, heard } : null}
      />
      {echo && !listening && <SpokenMarks check={echo.check} lang={pack.code} source={echo.mode} />}
      {gaveUp ? (
        <TypeField
          loud={recognitionSupported}
          lang={pack.code}
          value={typed}
          placeholder={t('write.placeholder')}
          ariaLabel={t('write.placeholder')}
          onChange={(v) => {
            setTyped(v);
            setEcho(null);
          }}
          checked={echo !== null && echo.mode === 'typed'}
          onCheck={() => setEcho({ check: checkSpoken(entry.text, [typed], pack.spoken), alternatives: [], mode: 'typed' })}
          onNext={() => finish(false)}
        />
      ) : (
        <MicPanel state={voice.state} onStart={listen} startLabel={echo ? 'intro.again' : 'mic.start'} prompt={t('intro.echo')} playing={playing} />
      )}
      <div className="row start">
        {!echo && (
          <button className="ghost" type="button" onClick={() => finish(true)}>
            {t('intro.skip')}
          </button>
        )}
      </div>
      <NextButton disabled={!echo} onNext={() => finish(false)} />
    </article>
  );
}

export function CopyStep({
  db,
  entry,
  pack,
  locale,
  kicker,
  skippable = false,
  onDone,
}: {
  db: ManaDb;
  entry: EntryRow;
  pack: LanguagePack;
  locale: string;
  kicker: string;
  /** The short practice after Again may be skipped; the introduction's copy-out may not. */
  skippable?: boolean;
  /** null: skipped. */
  onDone(copy: IntroCopy | null): void;
}) {
  const { t } = useI18n();
  const [typed, setTyped] = useState('');
  const [copy, setCopy] = useState<TypedCheck | null>(null);
  const [audioError, setAudioError] = useState(false);
  useEffect(() => stopEntryAudio, []);

  const done = () => {
    if (!copy) return;
    stopEntryAudio();
    onDone({
      typed,
      verdict: copy.evaluation.verdict,
      errorType: copy.evaluation.errorType ?? null,
      ...(copy.evaluation.punctuationNote ? { punctuationNote: true } : {}),
    });
  };

  return (
    <article className="study-card">
      <EntryHead
        kicker={kicker}
        entry={entry}
        pack={pack}
        onPlay={() => {
          setAudioError(false);
          playEntry(db, entry, locale).catch(() => setAudioError(true));
        }}
        audioError={audioError}
      />
      <TypeField
        lang={pack.code}
        value={typed}
        placeholder={t('write.placeholder')}
        ariaLabel={t('write.placeholder')}
        onChange={(v) => {
          setTyped(v);
          setCopy(null);
        }}
        checked={copy !== null}
        onCheck={() => setCopy(checkWritten(entry.text, typed, pack.writing, articleForm(entry)))}
        onNext={done}
      />
      {copy && (
        <>
          <CharMarks cells={copy.cells} lang={pack.code} />
          <p className="reason">{t(`reason.${copy.evaluation.verdict}`)}</p>
        </>
      )}
      {skippable && !copy && (
        <div className="row start">
          <button
            className="ghost"
            type="button"
            onClick={() => {
              stopEntryAudio();
              onDone(null);
            }}
          >
            {t('intro.skip')}
          </button>
        </div>
      )}
      <NextButton disabled={!copy} onNext={done} />
    </article>
  );
}
