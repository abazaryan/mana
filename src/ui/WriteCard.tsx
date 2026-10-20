/**
 * The skill `write` (Р3, Р21, Р24): the meaning, the form hints and `hint`; the field
 * is open at once with the cursor in it (the keyboard comes up by itself). Checked by
 * the written cascade with the article rule (Р24) and marked letter by letter. The
 * latency is the time to the first key (Р21); the time to "Check" is kept for analysis.
 * After the answer: the reference, its audio, the suggested rating, four buttons, "Next".
 * The reference is not in the page before the answer (Р17.13), no audio before it (Р17.12).
 */
import { useEffect, useRef, useState } from 'react';
import { formHints, pickLocalizedWithLang } from '../core/deckFormat';
import { checkWritten, type TypedCheck } from '../core/evaluate';
import type { TypedInputInfo } from '../core/keyboard';
import type { LanguagePack } from '../core/languages';
import type { AnswerMode, EntryRow, FinalRating, ReviewRecord } from '../core/model';
import { suggestWrite, type RatingChoice } from '../core/review';
import type { RatingSuggestion } from '../core/rating';
import { countSpokenWords, tokenizeSpoken } from '../core/spoken';
import type { ManaDb } from '../platform/db';
import { useI18n } from './i18n';
import { CharMarks } from './Marks';
import { articleForm } from './PracticeSteps';
import { RatingPanel } from './RatingPanel';
import { TypeField } from './TypeField';
import { LANG_NAMES } from './strings';
import { playEntry, stopEntryAudio, useVisibleClock } from './studyHooks';
import { CardKicker, type CardAnswer } from './VoiceCard';

interface Answered {
  mode: AnswerMode;
  check: TypedCheck | null;
  latencyMs: number | null;
  totalMs: number;
  suggestion: RatingSuggestion;
  /** Typed: which keyboard, anything pasted (Р31). */
  input: TypedInputInfo | null;
}

export function WriteCard({
  db,
  entry,
  pack,
  locale,
  previous,
  requeue,
  onDone,
}: {
  db: ManaDb;
  entry: EntryRow;
  pack: LanguagePack;
  locale: string;
  previous: ReviewRecord | null;
  requeue: number;
  onDone(a: CardAnswer): void;
}) {
  const { t, lang, meaningLang } = useI18n();
  const visibleMs = useVisibleClock();
  const [typed, setTyped] = useState('');
  const firstKey = useRef<number | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [choice, setChoice] = useState<RatingChoice | null>(null);
  const [audioError, setAudioError] = useState(false);
  const words = countSpokenWords(tokenizeSpoken(entry.text, pack.spoken));

  useEffect(() => stopEntryAudio, []);

  const finish = (mode: AnswerMode, check: TypedCheck | null, input: TypedInputInfo | null) => {
    const latency = mode === 'typed' && firstKey.current !== null ? Math.round(firstKey.current) : null;
    const suggestion = suggestWrite(check?.evaluation.verdict ?? null, latency, words, previous);
    setAnswered({ mode, check, latencyMs: latency, totalMs: Math.round(visibleMs()), suggestion, input });
    setChoice({ final: suggestion.rating as FinalRating, correction: null });
    setAudioError(false);
    playEntry(db, entry, locale).catch(() => setAudioError(true));
  };

  const next = () => {
    if (!answered || !choice) return;
    stopEntryAudio();
    const ev = answered.check?.evaluation;
    onDone({
      expected: entry.text,
      mode: answered.mode,
      answer: answered.mode === 'typed' ? typed : '',
      alternatives: [],
      verdict: ev?.verdict ?? 'incorrect',
      errorType: ev?.errorType ?? null,
      ...(ev?.punctuationNote ? { punctuationNote: true } : {}),
      ...(answered.input ? { keyboard: answered.input.keyboard, pasted: answered.input.pasted } : {}),
      latencyMs: answered.latencyMs,
      latencySource: answered.latencyMs === null ? null : 'key',
      totalMs: answered.totalMs,
      micDelayMs: null,
      retries: 0,
      recognitionLang: null,
      wordCount: words,
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
  const errorType = answered?.check?.evaluation.errorType;

  return (
    <article className="study-card">
      <CardKicker skill="write" requeue={requeue} />
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
      {answered?.mode !== 'skip' && (
        <TypeField
          lang={pack.code}
          value={typed}
          placeholder={t('write.placeholder')}
          ariaLabel={t('write.placeholder')}
          onChange={setTyped}
          onFirstKey={() => {
            firstKey.current ??= visibleMs();
          }}
          checked={answered !== null}
          frozen={answered !== null}
          onCheck={(input) => finish('typed', checkWritten(entry.text, typed, pack.writing, articleForm(entry)), input)}
          onNext={next}
        />
      )}
      {!answered && (
        <div className="row start mt">
          <button className="ghost" type="button" onClick={() => finish('skip', null, null)}>
            {t('speak.dontKnow')}
          </button>
        </div>
      )}
      {answered && (
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
          {answered.check && <CharMarks cells={answered.check.cells} lang={pack.code} />}
          {answered.mode === 'skip' && <p className="heard m">{t('speak.dontKnow')}</p>}
          {errorType === 'article' && <p className="hint">{t('write.article')}</p>}
          {errorType === 'elision' && <p className="hint">{t('write.elision')}</p>}
          <RatingPanel suggestion={answered.suggestion} mode={answered.mode} choice={choice} onChoice={setChoice} onNext={next} />
        </>
      )}
    </article>
  );
}
