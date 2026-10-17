/**
 * "Next" after a result (Р26, replaces Р22 п. 5): it takes the focus as soon as it is
 * enabled — the text field loses it, so on a phone the keyboard goes down and the
 * marks are in view; on a laptop the next Enter presses this button, but not sooner
 * than ENTER_NEXT_DELAY_MS (a double Enter cannot skip the marks). A tap or a mouse
 * click works at once.
 */
import { useEffect, useRef } from 'react';
import { nextPress } from '../core/enterFlow';
import { useI18n } from './i18n';

export function NextButton({ onNext, disabled = false }: { onNext(): void; disabled?: boolean }) {
  const { t } = useI18n();
  const ref = useRef<HTMLButtonElement>(null);
  const shownAt = useRef(0);
  useEffect(() => {
    if (disabled) return;
    shownAt.current = performance.now();
    // Without scrolling: the marks above stay where they are.
    ref.current?.focus({ preventScroll: true });
  }, [disabled]);
  return (
    <button
      ref={ref}
      className="primary big mt"
      type="button"
      disabled={disabled}
      onClick={(e) => {
        // A click from the keyboard (Enter, Space) has detail 0; a tap or a mouse click has 1+.
        if (nextPress({ byKeyboard: e.detail === 0, sinceShownMs: performance.now() - shownAt.current }) === 'next') onNext();
      }}
    >
      {t('common.next')}
    </button>
  );
}
