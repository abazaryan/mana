/**
 * A text field for answering by typing (copy-out step, typed answer in `speak`, the
 * field after three unrecognised attempts). Enter is the form's submit — Gboard's
 * `keydown` Enter is unreliable — and means "Check" the first time and "Next" the
 * second, not sooner than ENTER_NEXT_DELAY_MS after the result (src/core/enterFlow.ts).
 * After the check "Next" takes the focus (src/ui/NextButton.tsx, Р26): on a phone the
 * keyboard goes down and the marks are in view. On the next card with a field the
 * field takes the focus itself (`autoFocus`).
 */
import { useEffect, useRef } from 'react';
import { enterAction } from '../core/enterFlow';
import { useI18n } from './i18n';

export function TypeField({
  value,
  onChange,
  onFirstKey,
  lang,
  placeholder,
  ariaLabel,
  loud = false,
  checked,
  onCheck,
  onNext,
  frozen = false,
}: {
  value: string;
  onChange(v: string): void;
  onFirstKey?(): void;
  lang: string;
  placeholder?: string;
  ariaLabel: string;
  /** The large highlighted field shown after three unrecognised attempts. */
  loud?: boolean;
  /** A result is on screen. */
  checked: boolean;
  onCheck(): void;
  onNext(): void;
  /** The answer is final: typing changes nothing, but the field stays focused. */
  frozen?: boolean;
}) {
  const { t } = useI18n();
  const shownAt = useRef<number | null>(null);
  useEffect(() => {
    shownAt.current = checked ? performance.now() : null;
  }, [checked]);

  return (
    <form
      className={loud ? 'typebox loud' : 'typebox'}
      onSubmit={(e) => {
        e.preventDefault();
        const act = enterAction({
          hasText: value.trim().length > 0,
          checked,
          sinceCheckedMs: shownAt.current === null ? null : performance.now() - shownAt.current,
        });
        if (act === 'check') {
          onCheck();
        } else if (act === 'next') {
          onNext();
        }
      }}
    >
      <input
        lang={lang}
        value={value}
        placeholder={placeholder}
        onKeyDown={() => {
          if (!frozen) onFirstKey?.();
        }}
        onChange={(e) => {
          if (!frozen) onChange(e.target.value);
        }}
        autoFocus
        enterKeyHint="go"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={ariaLabel}
      />
      {/* Stays in the form after the check (hidden) so implicit submission keeps working. */}
      <button className={loud ? 'primary' : 'secondary'} type="submit" hidden={checked} aria-disabled={!value.trim()}>
        {t('speak.check')}
      </button>
    </form>
  );
}
