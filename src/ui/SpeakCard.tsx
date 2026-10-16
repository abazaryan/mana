/**
 * The skill `speak` (Р22.6): the meaning and the form hints, the answer by voice,
 * typed (same sound-based check) or "I don't know"; then the reference with the
 * word marks, its audio, the suggested rating, four buttons and "Next".
 * The reference text is not in the page before the answer (Р17.13), and no audio
 * plays before it (Р17.12).
 */
import { useEffect, useRef, useState } from 'react';
import { formHints, pickLocalizedWithLang } from '../core/deckFormat';
import type { LanguagePack } from '../core/languages';
import type { AnswerMode, EntryRow, FinalRating, ReviewRecord } from '../core/model';
import { canChoose, canClaimMisrecognized, chooseRating, claimMisrecognized, suggestSpeak, type RatingChoice } from '../core/review';
import type { RatingSuggestion } from '../core/rating';
import { checkSpoken, countSpokenWords, tokenizeSpoken, type SpokenCheck } from '../core/spoken';
import type { VoiceOutcome } from '../core/voice';
import type { ManaDb } from '../platform/db';
import type { ReviewInput } from '../platform/repo';
import { useI18n } from './i18n';
import { SpokenMarks } from './Marks';
import { MicStatus } from './MicStatus';
import { LANG_NAMES } from './strings';
import { playEntry, recognitionSupported, recognizerId, stopEntryAudio, useVisibleClock, useVoice, type RecognitionSetup } from './studyHooks';

/** The answer part of a review record; the study screen adds session and deck fields. */
export type SpeakAnswer = Omit<ReviewInput, 'at' | 'deckId' | 'entryId' | 'deckRevision' | 'sessionId' | 'skill'>;

interface Answered {
  mode: AnswerMode;
  check: SpokenCheck | null;
  typed: string;
  voice: VoiceOutcome;
  latencyMs: number | null;
  latencySource: ReviewRecord['latencySource'];
  totalMs: number | null;
  suggestion: RatingSuggestion;
}

const GRADES: FinalRating[] = [1, 2, 3, 4];

export function SpeakCard({
  db,
  entry,
  pack,
  locale,
  previous,
  recognition,
  onDone,
}: {
  db: ManaDb;
  entry: EntryRow;
  pack: LanguagePack;
  locale: string;
  /** The last answer on this card, for the Easy rule. */
  previous: ReviewRecord | null;
  recognition: RecognitionSetup;
  onDone(a: SpeakAnswer): void;
}) {
  const { t, lang, meaningLang } = useI18n();
  const visibleMs = useVisibleClock();
  const voice = useVoice(locale, visibleMs, recognition);
  const [typing, setTyping] = useState(!recognitionSupported);
  /** Three unrecognised attempts in a row: the microphone gives way to a large, highlighted field. */
  const [gaveUp, setGaveUp] = useState(false);
  const [typed, setTyped] = useState('');
  const firstKey = useRef<number | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [choice, setChoice] = useState<RatingChoice | null>(null);
  const [audioError, setAudioError] = useState(false);
  const determiner = entry.form?.determiner !== undefined;

  // The microphone starts with the card: the tap on the previous "Next" is the user gesture.
  useEffect(() => {
    if (recognitionSupported) voice.start();
    return stopEntryAudio;
    // Once per card.
  }, []);

  useEffect(() => {
    if (voice.state.failuresInRow >= 3 && !typing) {
      setGaveUp(true);
      setTyping(true);
    }
  }, [voice.state.failuresInRow, typing]);

  const finish = (a: Omit<Answered, 'suggestion'>) => {
    const suggestion = suggestSpeak(a.check, a.latencyMs, previous, a.voice.troubled);
    setAnswered({ ...a, suggestion });
    setChoice({ final: suggestion.rating as FinalRating, correction: null });
    setAudioError(false);
    playEntry(db, entry, locale).catch(() => setAudioError(true));
  };

  const { phase } = voice.state;
  useEffect(() => {
    if (phase !== 'done' || answered) return;
    const o = voice.outcome();
    finish({
      mode: 'voice',
      check: checkSpoken(entry.text, o.alternatives, pack.spoken, { determiner }),
      typed: '',
      voice: o,
      latencyMs: o.latencyMs,
      latencySource: o.latencySource,
      totalMs: o.totalMs,
    });
    // On each finished attempt.
  }, [phase]);

  const submitTyped = () => {
    if (!typed.trim()) return;
    voice.abort();
    const latency = firstKey.current;
    finish({
      mode: 'typed',
      check: checkSpoken(entry.text, [typed], pack.spoken, { determiner }),
      typed,
      voice: voice.outcome(),
      latencyMs: latency === null ? null : Math.round(latency),
      latencySource: latency === null ? null : 'key',
      totalMs: Math.round(visibleMs()),
    });
  };

  const dontKnow = () => {
    voice.abort();
    finish({ mode: 'skip', check: null, typed: '', voice: voice.outcome(), latencyMs: null, latencySource: null, totalMs: Math.round(visibleMs()) });
  };

  const next = () => {
    if (!answered || !choice) return;
    stopEntryAudio();
    const { check, voice: v, mode } = answered;
    const words = check?.words ?? countSpokenWords(tokenizeSpoken(entry.text, pack.spoken));
    onDone({
      expected: entry.text,
      mode,
      answer: mode === 'typed' ? answered.typed : (check?.answer ?? ''),
      alternatives: mode === 'voice' ? v.alternatives : [],
      confidences: mode === 'voice' ? v.confidences : [],
      altIndex: mode === 'voice' ? (check?.altIndex ?? null) : null,
      verdict: check?.verdict ?? 'incorrect',
      errorType: check?.errorType ?? null,
      latencyMs: answered.latencyMs,
      latencySource: answered.latencySource,
      totalMs: answered.totalMs,
      micDelayMs: v.micDelayMs,
      retries: v.retries,
      recognitionErrors: v.errors,
      recognitionLang: mode === 'voice' ? locale : null,
      wordCount: words,
      unsaid: check?.unsaid ?? null,
      repeats: check?.repeats ?? null,
      extraWords: check?.extra ?? null,
      soundRules: check?.rules ?? [],
      recognizer: recognizerId,
      biasing:
        recognition.biasing === 'on' && v.errors.some((e) => e.code === 'phrases-not-supported') ? 'unavailable' : recognition.biasing,
      phrasesCount: v.phrasesCount,
      processLocally: v.processLocally,
      speechPack: recognition.speechPack,
      suggested: answered.suggestion.rating as FinalRating,
      reason: answered.suggestion.reason,
      final: choice.final,
      correction: choice.correction,
    });
  };

  const meaning = pickLocalizedWithLang(entry.meaning, meaningLang);
  const hint = pickLocalizedWithLang(entry.hint, meaningLang);
  const hints = formHints(entry.form, lang);
  const listening = phase === 'starting' || phase === 'listening';

  const prompt = (
    <>
      <p className="kicker">{t('skill.speak')}</p>
      {meaning && (
        <p className="prompt" lang={meaning.lang}>
          {meaning.text}
          {meaning.lang !== meaningLang && (
            <span className="chip lang-mark" title={LANG_NAMES[meaning.lang]}>
              {meaning.lang}
            </span>
          )}
        </p>
      )}
      {hints.length > 0 && <p className="form-hints">{hints.join(' · ')}</p>}
      {hint && (
        <p className="m" lang={hint.lang}>
          {hint.text}
        </p>
      )}
    </>
  );

  if (!answered) {
    return (
      <article className="study-card">
        {prompt}
        <p className="m">{t('speak.prompt')}</p>
        {!typing && (
          <>
            <MicStatus state={voice.state} />
            {listening && voice.state.transcript && (
              <p className="live" lang={pack.code}>
                {voice.state.transcript}
              </p>
            )}
          </>
        )}
        {!recognitionSupported && <p className="hint">{t('mic.unsupported')}</p>}
        {typing && (
          <form
            className={gaveUp ? 'typebox loud' : 'typebox'}
            onSubmit={(e) => {
              e.preventDefault();
              submitTyped();
            }}
          >
            <input
              lang={pack.code}
              value={typed}
              placeholder={t('speak.typePlaceholder')}
              onKeyDown={() => {
                firstKey.current ??= visibleMs();
              }}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={t('speak.typePlaceholder')}
            />
            <button className="primary" type="submit" disabled={!typed.trim()}>
              {t('speak.check')}
            </button>
          </form>
        )}
        <div className="row start mt">
          {!typing && !listening && (
            <button className="primary" type="button" onClick={() => voice.start()}>
              🎤 {t('mic.retry')}
            </button>
          )}
          {!typing && (
            <button
              className="secondary"
              type="button"
              onClick={() => {
                voice.abort();
                setTyping(true);
              }}
            >
              ⌨ {t('speak.type')}
            </button>
          )}
          {typing && recognitionSupported && (
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setTyping(false);
                voice.start();
              }}
            >
              🎤 {t('mic.start')}
            </button>
          )}
          <button className="ghost" type="button" onClick={dontKnow}>
            {t('speak.dontKnow')}
          </button>
        </div>
      </article>
    );
  }

  const { suggestion, mode, check } = answered;
  const suggested = suggestion.rating as FinalRating;
  const note = pickLocalizedWithLang(entry.note, meaningLang);
  const misrecognizedOk = canClaimMisrecognized(suggested, mode);
  const locked = suggested === 1 && mode !== 'skip';

  return (
    <article className="study-card">
      {prompt}
      <div className="intro-head">
        <div className="answer" lang={pack.code}>
          {entry.text}
        </div>
        <button className="play" type="button" aria-label={`${t('deck.play')}: ${entry.text}`} onClick={() => void playEntry(db, entry, locale).catch(() => setAudioError(true))}>
          ▶
        </button>
      </div>
      {entry.ipa && <p className="m ipa">[{entry.ipa}]</p>}
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

      {check && <SpokenMarks check={check} lang={pack.code} source={mode === 'typed' ? 'typed' : 'voice'} />}
      {mode === 'skip' && <p className="heard m">{t('speak.dontKnow')}</p>}

      <p className="reason">
        {t('rating.suggested', { rating: t(`rating.${suggested}`) })} — {t(`reason.${suggestion.reason}`)}
      </p>
      <div className="grades" role="group" aria-label={t('rating.suggested', { rating: t(`rating.${suggested}`) })}>
        {GRADES.map((g) => (
          <button
            key={g}
            className="grade"
            data-g={g}
            type="button"
            aria-pressed={choice?.final === g}
            disabled={!canChoose(suggested, g) && !(choice?.correction === 'misrecognized' && g === 3)}
            onClick={() => {
              const c = chooseRating(suggested, g);
              if (c) setChoice(c);
            }}
          >
            {t(`rating.${g}`)}
            {g === suggested && <span className="sug" aria-hidden="true"> •</span>}
          </button>
        ))}
      </div>
      {misrecognizedOk && (
        <button
          className={choice?.correction === 'misrecognized' ? 'secondary on' : 'secondary'}
          type="button"
          aria-pressed={choice?.correction === 'misrecognized'}
          onClick={() => setChoice(claimMisrecognized(suggested, mode))}
        >
          {t('rating.misrecognized')}
        </button>
      )}
      {locked && <p className="hint">{t(mode === 'voice' ? 'rating.lockedVoice' : 'rating.lockedTyped')}</p>}
      <button className="primary big mt" type="button" onClick={next}>
        {t('common.next')}
      </button>
    </article>
  );
}
