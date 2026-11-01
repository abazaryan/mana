import { useEffect, useRef } from 'react';
import { useI18n } from './i18n';

/** What a key does on the question (R45): Escape answers "no"; no key answers "yes". */
export function confirmOtherKey(key: string): 'no' | null {
  return key === 'Escape' ? 'no' : null;
}

/** Escape on `target` answers "no" while the question is open; the answer to stop listening. */
export function listenConfirmKeys(target: EventTarget, onNo: () => void): () => void {
  const onKey = (e: Event) => {
    if (confirmOtherKey((e as KeyboardEvent).key) !== 'no') return;
    e.preventDefault();
    onNo();
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}

/**
 * "Add another installation's study log to the account?" (R40 item 11, R45). "Yes" cannot be
 * undone — the earlier id joins the account for good — so "No" is the main button, on the left
 * and focused, so Enter answers "no"; "Yes" has the style of the other irreversible actions
 * (secondary danger, on the right, as on the deletion screens). Escape answers "no"; leaving the
 * screen drops the question unanswered.
 */
export function ConfirmOther({ onYes, onNo }: { onYes(): void; onNo(): void }) {
  const { t } = useI18n();
  const no = useRef(onNo);
  no.current = onNo;
  useEffect(() => listenConfirmKeys(document, () => no.current()), []);
  return (
    <div className="mt">
      <p className="prompt">{t('restore.confirmOther')}</p>
      <p className="hint">{t('restore.confirmOtherHint')}</p>
      <div className="two mt">
        <button className="primary" type="button" autoFocus onClick={onNo}>
          {t('common.no')}
        </button>
        <button className="secondary danger" type="button" onClick={onYes}>
          {t('common.yes')}
        </button>
      </div>
    </div>
  );
}
