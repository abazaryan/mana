/**
 * A text field for answering by typing (`write`, the copy-out step of an introduction
 * and of the short practice, typed answer in `speak` / `listen`, the field after three
 * unrecognised attempts). Enter is the form's submit — Gboard's `keydown` Enter is
 * unreliable — and means "Check" the first time and "Next" the second, not sooner than
 * ENTER_NEXT_DELAY_MS after the result (src/core/enterFlow.ts).
 * After the check "Next" takes the focus (src/ui/NextButton.tsx, Р26): on a phone the
 * keyboard goes down and the marks are in view. On the next card with a field the
 * field takes the focus itself (`autoFocus`).
 *
 * On a touch device the on-screen keyboard types (Р31): the system one is hidden
 * (inputmode="none"), ours is up while the field has the focus, its Enter submits the
 * form, Android Back folds it. Settings → System keyboard, a laptop, or a language
 * without a layout — the browser's own input as before.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { enterAction } from '../core/enterFlow';
import { typedKeyboard, type FirstInput, type TypedInputInfo } from '../core/keyboard';
import { findLanguagePack } from '../core/languages';
import { caretAfterInsert, deleteBackward, insertText, type TextState } from '../core/textEdit';
import { watchClose } from '../platform/keyboardEnv';
import { useI18n } from './i18n';
import { useKeyboardMode } from './keyboardMode';
import { OnScreenKeyboard } from './OnScreenKeyboard';

function submitForm(form: HTMLFormElement | null) {
  if (!form) return;
  if (typeof form.requestSubmit === 'function') form.requestSubmit();
  else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

const selection = (el: HTMLInputElement): TextState => ({
  text: el.value,
  start: el.selectionStart ?? el.value.length,
  end: el.selectionEnd ?? el.value.length,
});

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
  /** The keyboard of the first character and whether anything was pasted, for the journal (Р31). */
  onCheck(info: TypedInputInfo): void;
  onNext(): void;
  /** The answer is final: typing changes nothing, but the field stays focused. */
  frozen?: boolean;
}) {
  const { t, lang: uiLang } = useI18n();
  const pack = findLanguagePack(lang);
  const wanted = useKeyboardMode();
  // A language without a layout falls back to the system keyboard.
  const mode = wanted === 'onscreen' && !pack ? 'system' : wanted;
  const onscreen = mode === 'onscreen' && pack !== undefined;

  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [focused, setFocused] = useState(false);
  const shownAt = useRef<number | null>(null);
  const first = useRef<FirstInput>(null);
  const pasted = useRef(false);
  const pasteFrom = useRef<TextState | null>(null);
  const caret = useRef<number | null>(null);

  useEffect(() => {
    shownAt.current = checked ? performance.now() : null;
  }, [checked]);

  // `autoFocus` while the window is in the background focuses without a focus event.
  useLayoutEffect(() => {
    if (document.activeElement === input.current) setFocused(true);
  }, []);

  // After an on-screen key or a paste: the caret where the edit left it. Chrome may move
  // it after the input event (seen after a paste, stage 5 lab), so once more a frame later.
  useLayoutEffect(() => {
    const el = input.current;
    const at = caret.current;
    caret.current = null;
    if (!el || at === null || document.activeElement !== el) return;
    el.setSelectionRange(at, at);
    const id = requestAnimationFrame(() => {
      if (document.activeElement === el) el.setSelectionRange(at, at);
    });
    return () => cancelAnimationFrame(id);
  }, [value]);

  const keyboardUp = onscreen && focused;

  // Android Back folds the keyboard instead of leaving the page (Р31).
  useEffect(() => {
    if (!keyboardUp) return;
    return watchClose(() => input.current?.blur());
  }, [keyboardUp]);

  // The field stays in view above the keyboard (scroll-padding in styles.css), also after
  // the screen turns.
  useEffect(() => {
    if (!keyboardUp) return;
    const reveal = () => input.current?.scrollIntoView({ block: 'nearest' });
    const id = window.setTimeout(reveal, 30);
    window.addEventListener('resize', reveal);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', reveal);
    };
  }, [keyboardUp]);

  const edit = (fn: (s: TextState) => TextState) => {
    const el = input.current;
    if (frozen || !el) return;
    const next = fn(selection(el));
    caret.current = next.start;
    if (next.text !== el.value) onChange(next.text);
  };

  return (
    <form
      ref={form}
      className={loud ? 'typebox loud' : 'typebox'}
      onSubmit={(e) => {
        e.preventDefault();
        const act = enterAction({
          hasText: value.trim().length > 0,
          checked,
          sinceCheckedMs: shownAt.current === null ? null : performance.now() - shownAt.current,
        });
        if (act === 'check') {
          onCheck({ keyboard: typedKeyboard(mode, first.current), pasted: pasted.current });
        } else if (act === 'next') {
          onNext();
        }
      }}
    >
      <input
        ref={input}
        lang={lang}
        value={value}
        placeholder={placeholder}
        onKeyDown={() => {
          if (!frozen) onFirstKey?.();
        }}
        onPaste={(e) => {
          if (frozen) return;
          pasted.current = true;
          pasteFrom.current = selection(e.currentTarget);
        }}
        onChange={(e) => {
          if (frozen) return;
          const from = pasteFrom.current;
          pasteFrom.current = null;
          if (from) caret.current = caretAfterInsert(from, e.target.value.length);
          else first.current ??= 'native';
          onChange(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
        inputMode={onscreen ? 'none' : undefined}
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
      {keyboardUp && (
        <OnScreenKeyboard
          layout={pack.keyboard}
          spaceLabel={pack.name[uiLang]}
          enterLabel={checked ? t('common.next') : t('speak.check')}
          onTouch={() => {
            if (!frozen) onFirstKey?.();
          }}
          onChar={(ch) => {
            if (frozen) return;
            first.current ??= 'onscreen';
            edit((s) => insertText(s, ch));
          }}
          onBackspace={() => edit(deleteBackward)}
          onEnter={() => submitForm(form.current)}
        />
      )}
    </form>
  );
}
