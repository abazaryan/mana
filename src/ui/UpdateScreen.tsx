import { useEffect, useState } from 'react';
import { RELOAD_GUARD_MS } from '../core/sync';
import { useI18n } from './i18n';

const MARK = 'mana.updateReloadAt';

function lastReload(): number | null {
  try {
    const v = Number(sessionStorage.getItem(MARK));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function markReload(now: number): void {
  try {
    sessionStorage.setItem(MARK, String(now));
  } catch {
    // No sessionStorage: the button still reloads.
  }
}

/**
 * "A newer version of the app is needed" (stage 6a.3, R39): the server answered 426, records came
 * with newer scheduling rules, or another window upgraded the database. Everything is saved
 * already. The page reloads by itself once (no service worker: a reload brings the new build);
 * if it was reloaded within RELOAD_GUARD_MS — the new build is not out yet — only the button.
 */
export function UpdateScreen({ reason }: { reason: 'data' | 'otherTab' }) {
  const { t } = useI18n();
  const [recent] = useState(() => {
    const last = lastReload();
    return last !== null && Date.now() - last < RELOAD_GUARD_MS;
  });

  useEffect(() => {
    if (recent) return;
    markReload(Date.now());
    location.reload();
  }, [recent]);

  return (
    <section>
      <h1>{t('update.title')}</h1>
      <p>{t(reason === 'otherTab' ? 'update.otherTab' : 'update.text')}</p>
      {recent && <p className="hint">{t('update.wait')}</p>}
      <button
        className="primary mt"
        type="button"
        onClick={() => {
          markReload(Date.now());
          location.reload();
        }}
      >
        {t('update.reload')}
      </button>
    </section>
  );
}
