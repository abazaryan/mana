/**
 * The voice skills (Р22.6, Р25):
 *   `speak`  — the meaning and the form hints; say the answer;
 *   `listen` — only the audio (it plays by itself; "Replay" plays it again); say what
 *              was heard. The microphone starts when the sound ends, so the latency
 *              counts from there, not from the card shown.
 * Answer by voice, typed (same sound-based check) or "I don't know"; then the
 * reference with the word marks, the suggested rating, four buttons and "Next".
 * The reference text is not in the page before the answer (Р17.13); in `speak` no
 * audio plays before it (Р17.12).
 */
import { useEffect, useRef, useState } from 'react';
import { formHints, pickLocalizedWithLang } from '../core/deckFormat';
import type { TypedInputInfo } from '../core/keyboard';
import type { LanguagePack } from '../core/languages';
import type { AnswerMode, EntryRow, FinalRating, ReviewRecord } from '../core/model';
import { suggestSpeak, type RatingChoice } from '../core/review';
import type { RatingSuggestion } from '../core/rating';
import { checkSpoken, checkSpokenEntry, countSpokenWords, tokenizeSpoken, type SpokenCheck } from '../core/spoken';
import type { VoiceOutcome } from '../core/voice';
import type { ManaDb } from '../platform/db';
import type { ReviewInput } from '../platform/repo';
import { useI18n } from './i18n';
import { SpokenMarks } from './Marks';
import { MicPanel } from './MicPanel';
import { RatingPanel } from './RatingPanel';
import { TypeField } from './TypeField';
import { LANG_NAMES } from './strings';
import { playEntry, recognitionSupported, recognizerId, stopEntryAudio, useVisibleClock, useVoice, type RecognitionSetup } from './studyHooks';

/** The answer part of a review record; the study screen adds session, deck and portion fields. */
export type CardAnswer = Omit<
  ReviewInput,
  'at' | 'deckId' | 'entryId' | 'deckRevision' | 'sessionId' | 'skill' | 'requeue' | 'sincePairSec' | 'sinceEntryCards' | 'sinceEntrySec'
>;

interface Answered {
  mode: AnswerMode;
  check: SpokenCheck | null;
  typed: string;
  voice: VoiceOutcome;
  latencyMs: number | null;
  latencySource: ReviewRecord['latencySource'];
  totalMs: number | null;
  suggestion: RatingSuggestion;
  /** Typed: which keyboard, anything pasted (Р31). */
  input?: TypedInputInfo;
}

/** The kicker of a study card: the skill, and ↻ when the card came back after Again. */
export function CardKicker({ skill, requeue }: { skill: 'speak' | 'listen' | 'write'; requeue: number }) {
  const { t } = useI18n();
  return (
    <p className="kicker">
      {t(`skill.${skill}`)}
      {requeue > 0 && (
        <span className="returned" role="img" aria-label={t('study.returned')} title={t('study.returned')}>
          {' '}
          ↻
        </span>
      )}
    </p>
  );
}

export function VoiceCard({
  db,
  entry,
  pack,
  locale,
  skill,
  previous,
  recognition,
  requeue,
  onDone,
}: {
  db: ManaDb;
  entry: EntryRow;
  pack: LanguagePack;
  locale: string;
  skill: 'speak' | 'listen';
  /** The last answer on this card, for the Easy rule. */
  previous: ReviewRecord | null;
  recognition: RecognitionSetup;
  requeue: number;
  onDone(a: CardAnswer): void;
}) {
  const { t, lang, meaningLang } = useI18n();
  const visibleMs = useVisibleClock();
  const voice = useVoice(locale, visibleMs, recognition);
  const listenSkill = skill === 'listen';
  const [typing, setTyping] = useState(!recognitionSupported);
  /** Three unrecognised attempts in a row: the microphone gives way to a large, highlighted field. */
  const [gaveUp, setGaveUp] = useState(false);
  const [typed, setTyped] = useState('');
  const firstKey = useRef<number | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [choice, setChoice] = useState<RatingChoice | null>(null);
  const [audioError, setAudioError] = useState(false);
  /** `listen`: the audio is playing; plays so far; when the last one ended. */
  const [playing, setPlaying] = useState(false);
  const plays = useRef(0);
  const audioEnd = useRef<number | null>(null);
  const startedOnce = useRef(false);
  const determiner = entry.form?.determiner !== undefined;
  const typingRef = useRef(typing);
  typingRef.current = typing;
  const answeredRef = useRef(false);

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

  /**
   * `listen`: plays the question with the microphone off; listening starts when it ends.
   * Plays = the automatic one + each "Replay" press (counted on the press, not on the
   * start of playback, which React's development mode runs twice).
   */
  const playQuestion = (replay: boolean) => {
    voice.abort();
    setAudioError(false);
    setPlaying(true);
    plays.current = replay ? plays.current + 1 : Math.max(plays.current, 1);
    playEntry(db, entry, locale, () => {
      setPlaying(false);
      audioEnd.current = visibleMs();
      if (recognitionSupported && !typingRef.current && !answeredRef.current) autoListen();
    }).catch(() => {
      setPlaying(false);
      setAudioError(true);
    });
  };

  // `speak`: the microphone starts with the card (the tap on the previous "Next" is the
  // user gesture). `listen`: the audio plays first, the microphone when it ends.
  useEffect(() => {
    if (listenSkill) playQuestion(false);
    else if (recognitionSupported) autoListen();
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
    answeredRef.current = true;
    const troubled = a.voice.troubled || plays.current > 1;
    const suggestion = suggestSpeak(a.check, a.latencyMs, previous, troubled, skill);
    setAnswered({ ...a, suggestion });
    setChoice({ final: suggestion.rating as FinalRating, correction: null });
    setAudioError(false);
    setPlaying(false);
    if (listenSkill) stopEntryAudio();
    else playEntry(db, entry, locale).catch(() => setAudioError(true));
  };

  const { phase } = voice.state;
  useEffect(() => {
    if (phase !== 'done' || answered) return;
    const o = voice.outcome();
    finish({
      mode: 'voice',
      check: checkSpokenEntry(entry, o.alternatives, pack.spoken, { determiner }),
      typed: '',
      voice: o,
      latencyMs: o.latencyMs,
      latencySource: o.latencySource,
      totalMs: o.totalMs,
    });
    // On each finished attempt.
  }, [phase]);

  const submitTyped = (input: TypedInputInfo) => {
    if (!typed.trim()) return;
    voice.abort();
    // `listen`: from the end of the audio, as for a voice answer.
    const from = listenSkill ? (audioEnd.current ?? 0) : 0;
    const latency = firstKey.current === null ? null : Math.max(0, firstKey.current - from);
    finish({
      mode: 'typed',
      check: checkSpoken(entry.text, [typed], pack.spoken, { determiner }),
      typed,
      voice: voice.outcome(),
      latencyMs: latency === null ? null : Math.round(latency),
      latencySource: latency === null ? null : 'key',
      totalMs: Math.round(visibleMs()),
      input,
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
      repeatHintShown: v.repeatHint,
      recognitionLang: mode === 'voice' ? locale : null,
      wordCount: words,
      unsaid: check?.unsaid ?? null,
      repeats: check?.repeats ?? null,
      extraWords: check?.extra ?? null,
      soundRules: check?.rules ?? [],
      ...(mode === 'typed' && answered.input ? { keyboard: answered.input.keyboard, pasted: answered.input.pasted } : {}),
      ...(listenSkill
        ? { plays: plays.current, audioEndMs: audioEnd.current === null ? null : Math.round(audioEnd.current), micReadyMs: v.readyMs }
        : {}),
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
  const note = pickLocalizedWithLang(entry.note, meaningLang);
  const hints = formHints(entry.form, lang);
  const listening = phase === 'starting' || phase === 'listening';
  // Р27: `speak` names the language of the answer ("Say it in French"); `listen` and a
  // language without the ready-made form say just "Say it" / "Type…".
  const inLang = listenSkill ? undefined : pack.inLanguage?.[lang];
  const capital = (s: string) => s.charAt(0).toLocaleUpperCase(lang) + s.slice(1);
  const sayText = inLang ? capital(t('speak.sayIn', { inLang })) : t('listen.say');
  const typeText = inLang ? capital(t('speak.typeIn', { inLang })) : t('write.placeholder');

  const meaningLine = meaning && (
    <p className={listenSkill ? 'meaning' : 'prompt'} lang={meaning.lang}>
      {meaning.text}
      {meaning.lang !== meaningLang && (
        <span className="chip lang-mark" title={LANG_NAMES[meaning.lang]}>
          {meaning.lang}
        </span>
      )}
    </p>
  );

  // `listen` shows nothing of the answer before it: no text, no meaning, no hints (Р17.13, Р25).
  const prompt = listenSkill ? (
    <>
      <CardKicker skill={skill} requeue={requeue} />
      {!answered && (
        <>
          <div className="row start">
            <button className="secondary" type="button" onClick={() => playQuestion(true)}>
              ▶ {t('listen.replay')}
            </button>
          </div>
          {audioError && (
            <p className="hint err" role="alert">
              {t('deck.audioError')}
            </p>
          )}
        </>
      )}
    </>
  ) : (
    <>
      <CardKicker skill={skill} requeue={requeue} />
      {meaningLine}
      {hints.length > 0 && <p className="form-hints">{hints.join(' · ')}</p>}
      {hint && (
        <p className="m" lang={hint.lang}>
          {hint.text}
        </p>
      )}
    </>
  );

  const typedMode = answered ? answered.mode === 'typed' : typing;
  // One slot for the field in both states, so the same input (and the keyboard) survives the check.
  const field = typedMode ? (
    <TypeField
      loud={gaveUp}
      lang={pack.code}
      value={typed}
      placeholder={typeText}
      ariaLabel={typeText}
      onChange={setTyped}
      onFirstKey={() => {
        firstKey.current ??= visibleMs();
      }}
      checked={answered !== null}
      frozen={answered !== null}
      onCheck={submitTyped}
      onNext={next}
    />
  ) : null;

  const pendingBody = (
    <>
      {!typing && recognitionSupported && (
        <>
          <MicPanel state={voice.state} onStart={listen} startLabel="mic.start" prompt={sayText} playing={playing} />
          {listening && voice.state.transcript && (
            <p className="live" lang={pack.code}>
              {voice.state.transcript}
            </p>
          )}
        </>
      )}
      {!recognitionSupported && <p className="hint">{t('mic.unsupported')}</p>}
      <div className="row start mt">
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
              listen();
            }}
          >
            🎤 {t('mic.start')}
          </button>
        )}
        <button className="ghost" type="button" onClick={dontKnow}>
          {t('speak.dontKnow')}
        </button>
      </div>
    </>
  );

  const renderAnswered = (a: Answered) => (
    <>
      <div className="intro-head">
        <div className="answer" lang={pack.code}>
          {entry.text}
        </div>
        <button className="play" type="button" aria-label={`${t('deck.play')}: ${entry.text}`} onClick={() => void playEntry(db, entry, locale).catch(() => setAudioError(true))}>
          ▶
        </button>
      </div>
      {entry.ipa && <p className="m ipa">[{entry.ipa}]</p>}
      {listenSkill && meaningLine}
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
      {a.check && <SpokenMarks check={a.check} lang={pack.code} source={a.mode === 'typed' ? 'typed' : 'voice'} />}
      {a.mode === 'skip' && <p className="heard m">{t('speak.dontKnow')}</p>}
      <RatingPanel suggestion={a.suggestion} mode={a.mode} choice={choice} onChoice={setChoice} onNext={next} />
    </>
  );

  return (
    <article className="study-card">
      {prompt}
      {field}
      {answered ? renderAnswered(answered) : pendingBody}
    </article>
  );
}
