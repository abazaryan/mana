import { useRef, useState } from 'react';
import { accountExportFileName, serializeAccountExport } from '../core/accountExport';
import type { MetaRow } from '../core/model';
import { collectCopy, emptyCopy, recordsIn } from '../platform/accountCopy';
import { exportHead, exportJournalPage } from '../platform/api';
import type { ManaDb } from '../platform/db';
import { downloadText } from '../platform/files';
import { useI18n } from './i18n';
import { sendQueue } from './leaving';
import type { StringKey } from './strings';

interface Props {
  db: ManaDb;
  meta: MetaRow;
  /**
   * Send this device's queue first and say how many records stay out of the copy (Settings →
   * Account, R45). The deletion screen sends the queue itself when it opens. Without consent to the
   * current notice the queue does not go (403), the copy still does: only what the server holds.
   */
  sendFirst?: boolean;
  disabled?: boolean;
  /** The copy is being collected: the deletion screen holds "Next" meanwhile. */
  onBusy?(busy: boolean): void;
}

/**
 * "Save a copy of the account data" (stage 6a.5b, R42 items 1 and 5; R45): the first screen of
 * the account's deletion and Settings → Account. Pages already collected stay between tries; the
 * file is built when everything is here (src/platform/accountCopy.ts).
 */
export function AccountCopy({ db, meta, sendFirst = false, disabled = false, onBusy }: Props) {
  const { t } = useI18n();
  const [copying, setCopying] = useState<number | null>(null);
  const [note, setNote] = useState<{ key: StringKey; err: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [unsent, setUnsent] = useState(0);
  const copy = useRef(emptyCopy());

  const save = async () => {
    setNote(null);
    setFailed(false);
    setCopying(recordsIn(copy.current));
    onBusy?.(true);
    try {
      if (sendFirst) setUnsent((await sendQueue(db)).unsent);
      const step = await collectCopy({ head: exportHead, page: exportJournalPage }, copy.current, meta.deviceId, () => new Date(), setCopying);
      setCopying(null);
      if (!step.ok) {
        if (step.status !== 401) {
          setNote({ key: 'account.exportFailed', err: true });
          setFailed(true);
        }
        return;
      }
      downloadText(serializeAccountExport(step.file), accountExportFileName(new Date()));
      copy.current = emptyCopy();
      setNote({ key: 'account.exportDone', err: false });
    } finally {
      setCopying(null);
      onBusy?.(false);
    }
  };

  return (
    <>
      <button className="secondary mt" type="button" disabled={disabled || copying !== null} onClick={() => void save()}>
        {t('account.exportAll')}
      </button>
      {copying !== null && <p className="hint" role="status">{t('account.exportProgress', { n: copying })}</p>}
      {unsent > 0 && (
        <p className="hint err" role="alert">
          {t('account.deleteUnsent', { n: unsent })}
        </p>
      )}
      {note && <p className={'hint' + (note.err ? ' err' : '')} role="status">{t(note.key)}</p>}
      {failed && copying === null && (
        <button className="secondary mt" type="button" onClick={() => void save()}>
          {t('common.retry')}
        </button>
      )}
    </>
  );
}
