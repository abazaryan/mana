/**
 * Copies a text to the clipboard (texts for an AI, Р33 п. 15). Where the browser does
 * not allow it, the text is shown in a read-only field to select by hand.
 */
import { useState } from 'react';
import { useI18n } from './i18n';

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({ label, text, primary = false }: { label: string; text: () => string; primary?: boolean }) {
  const { t } = useI18n();
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="stack">
      <button
        className={primary ? 'primary' : 'secondary'}
        type="button"
        onClick={() => {
          const value = text();
          void copy(value).then((ok) => setState({ ok, text: value }));
        }}
      >
        {label}
      </button>
      {state?.ok && (
        <p className="hint" role="status">
          {t('common.copied')}
        </p>
      )}
      {state && !state.ok && (
        <>
          <p className="hint err" role="alert">
            {t('common.copyFailed')}
          </p>
          <textarea className="copy-text" readOnly value={state.text} rows={8} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
    </div>
  );
}
