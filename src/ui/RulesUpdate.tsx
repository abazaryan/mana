/**
 * New scheduling rules (Р29.7): before any study the journal is saved to a file and
 * the cards are rebuilt from it. One tap does both: a download started by a tap is
 * what browsers allow. Closed without the tap, nothing changes and the screen comes
 * back next time. The journal itself is never touched.
 */
import { useState } from 'react';
import { backupFileName } from '../core/backup';
import type { MetaRow } from '../core/model';
import { createScheduler } from '../core/scheduler';
import type { ManaDb } from '../platform/db';
import { downloadText } from '../platform/files';
import { applyRulesUpdate, exportJournal } from '../platform/repo';
import { useI18n } from './i18n';

export function RulesUpdate({ db, meta, onDone }: { db: ManaDb; meta: MetaRow; onDone(): void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const { json } = await exportJournal(db, meta);
      downloadText(json, backupFileName(new Date()));
      await applyRulesUpdate(db, createScheduler(), meta.userId);
      onDone();
    } catch (e) {
      setError(t('backup.error.failed', { error: e instanceof Error ? e.message : String(e) }));
      setBusy(false);
    }
  };

  return (
    <section>
      <h1>{t('migrate.title')}</h1>
      <p className="lead">{t('migrate.text')}</p>
      {error && (
        <p className="hint err" role="alert">
          {error}
        </p>
      )}
      <div className="stack mt">
        <button className="primary big" type="button" disabled={busy} onClick={() => void go()}>
          {t('migrate.go')}
        </button>
      </div>
    </section>
  );
}
