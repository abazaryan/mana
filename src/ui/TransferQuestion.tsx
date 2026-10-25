import { useState } from 'react';
import { backupFileName } from '../core/backup';
import type { MetaRow } from '../core/model';
import type { ManaDb } from '../platform/db';
import { downloadText } from '../platform/files';
import { exportJournal } from '../platform/repo';
import { useI18n } from './i18n';

interface Props {
  db: ManaDb;
  meta: MetaRow;
  onYes(): void;
  onNo(): void;
}

/**
 * "Add this device's progress to your account?" (STAGE6_RESEARCH 5.9, R40) — asked before any
 * request, so "no" spends neither the invitation nor the code. The journal can be saved to a
 * file first (R33 item 6).
 */
export function TransferQuestion({ db, meta, onYes, onNo }: Props) {
  const { t } = useI18n();
  const [saved, setSaved] = useState<string | null>(null);

  const save = async () => {
    try {
      const { json, count } = await exportJournal(db, meta);
      downloadText(json, backupFileName(new Date()));
      setSaved(t('backup.saved', { n: count }));
    } catch (e) {
      setSaved(t('backup.error.failed', { error: e instanceof Error ? e.message : String(e) }));
    }
  };

  return (
    <>
      <p className="prompt">{t('transfer.question')}</p>
      <p className="hint">{t('transfer.hint')}</p>
      <div className="two mt">
        <button className="primary" type="button" onClick={onYes}>
          {t('voice.yes')}
        </button>
        <button className="secondary" type="button" onClick={onNo}>
          {t('voice.no')}
        </button>
      </div>
      <button className="secondary mt" type="button" onClick={() => void save()}>
        {t('backup.save')}
      </button>
      {saved && (
        <p className="hint" role="status">
          {saved}
        </p>
      )}
    </>
  );
}

/** After a transfer: done, and how many records are on their way. */
export function TransferDone({ queued }: { queued: number }) {
  const { t } = useI18n();
  return (
    <>
      <p role="status">{t('transfer.done')}</p>
      {queued > 0 && <p className="hint">{t('sync.pending', { n: queued })}</p>}
    </>
  );
}
