/**
 * The suggested rating, the four buttons, "I was misrecognised" and "Next" (R4) —
 * the same under every skill. Lowering is free; Again is raised only by
 * "I was misrecognised", and only after a voice answer.
 */
import type { AnswerMode, FinalRating } from '../core/model';
import type { RatingSuggestion } from '../core/rating';
import { canChoose, canClaimMisrecognized, chooseRating, claimMisrecognized, type RatingChoice } from '../core/review';
import { useI18n } from './i18n';
import { NextButton } from './NextButton';

const GRADES: FinalRating[] = [1, 2, 3, 4];

export function RatingPanel({
  suggestion,
  mode,
  choice,
  onChoice,
  onNext,
}: {
  suggestion: RatingSuggestion;
  mode: AnswerMode;
  choice: RatingChoice | null;
  onChoice(c: RatingChoice): void;
  onNext(): void;
}) {
  const { t } = useI18n();
  const suggested = suggestion.rating as FinalRating;
  const misrecognizedOk = canClaimMisrecognized(suggested, mode);
  const locked = suggested === 1 && mode !== 'skip';
  return (
    <>
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
              if (c) onChoice(c);
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
          onClick={() => {
            const c = claimMisrecognized(suggested, mode);
            if (c) onChoice(c);
          }}
        >
          {t('rating.misrecognized')}
        </button>
      )}
      {locked && <p className="hint">{t(mode === 'voice' ? 'rating.lockedVoice' : 'rating.lockedTyped')}</p>}
      <NextButton onNext={onNext} />
    </>
  );
}
