import { useEffect, useRef, useState } from 'react';
import { deleteOutcome } from '../core/accountDelete';
import { accountExportFileName, serializeAccountExport } from '../core/accountExport';
import type { MetaRow } from '../core/model';
import { collectCopy, emptyCopy, recordsIn } from '../platform/accountCopy';
import { deleteAccountRequest, exportHead, exportJournalPage } from '../platform/api';
import type { ManaDb } from '../platform/db';
import { downloadText } from '../platform/files';
import { clearPendingDeletion, finishAccountDeletion, markPendingDeletion } from '../platform/repo';
import { useI18n } from './i18n';
import { saveJournalFile, sendQueue } from './leaving';
import type { StringKey } from './strings';
import { WipeSheet } from './WipeSheet';

type Phase = 'intro' | 'confirm' | 'deleting' | 'failed' | 'deleted';

interface Props {
  db: ManaDb;
  meta: MetaRow;
  /** The account was found deleted at start (an answer lost before, R42 item 8): show the end at once. */
  deleted: boolean;
  onMetaChange(meta: MetaRow): void;
  /** The server answered 426: this build is too old. */
  onNeedsUpdate(): void;
}

/**
 * Deleting the account (stage 6a.5b, R42 items 1, 8): screen 1 — what goes, the queue sent first,
 * a copy of the account's data; screen 2 — "for good?"; then the request (with the mark
 * `pendingDeletion` before it, sync stopped) and "Account deleted" — on this device only, with
 * the journal file and clearing the device.
 */
export function DeleteAccountScreen({ db, meta, deleted, onMetaChange, onNeedsUpdate }: Props) {
  const { t } = useI18n();
  // Deleted here before (a reload, `accountLost`): the end again. A deletion sent before whose answer
  // is still unknown (no network at start): straight to the retry.
  const [phase, setPhase] = useState<Phase>(deleted || meta.accountLost?.reason === 'deleted' ? 'deleted' : meta.pendingDeletion ? 'failed' : 'intro');
  const [unsent, setUnsent] = useState<number | null>(null);
  const [note, setNote] = useState<{ text: string; err: boolean } | null>(null);
  const [copying, setCopying] = useState<number | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [wiping, setWiping] = useState(false);
  const copy = useRef(emptyCopy());

  // Screen 1: the queue goes first, so the copy has this device's answers too.
  useEffect(() => {
    if (phase !== 'intro' || !meta.account || unsent !== null) return;
    void sendQueue(db).then((r) => setUnsent(r.unsent));
  }, [db, meta.account, phase, unsent]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  const say = (key: StringKey, err: boolean, vars?: Record<string, string | number>) => setNote({ text: t(key, vars), err });

  const saveCopy = async () => {
    setNote(null);
    setCopyFailed(false);
    setCopying(recordsIn(copy.current));
    const step = await collectCopy({ head: exportHead, page: exportJournalPage }, copy.current, meta.deviceId, () => new Date(), setCopying);
    setCopying(null);
    if (!step.ok) {
      if (step.status !== 401) {
        say('account.exportFailed', true);
        setCopyFailed(true);
      }
      return;
    }
    downloadText(serializeAccountExport(step.file), accountExportFileName(new Date()));
    copy.current = emptyCopy();
    say('account.exportDone', false);
  };

  const saveJournal = async () => {
    try {
      say('backup.saved', false, { n: await saveJournalFile(db) });
    } catch (e) {
      say('backup.error.failed', true, { error: e instanceof Error ? e.message : String(e) });
    }
  };

  const remove = async () => {
    setPhase('deleting');
    setNote(null);
    onMetaChange(await markPendingDeletion(db));
    const outcome = deleteOutcome(await deleteAccountRequest());
    if (outcome === 'deleted') {
      onMetaChange(await finishAccountDeletion(db));
      setPhase('deleted');
    } else if (outcome === 'update') {
      // Refused before anything happened: no deletion to remember.
      onMetaChange(await clearPendingDeletion(db, false));
      onNeedsUpdate();
    } else {
      // Unknown whether it reached the server: the mark stays; a retry or the next start tells.
      setPhase('failed');
    }
  };

  if (phase === 'deleted') {
    return (
      <section>
        <h1>{t('account.deletedTitle')}</h1>
        <p>{t('account.deletedText')}</p>
        <div className="stack mt">
          <button className="secondary" type="button" onClick={() => void saveJournal()}>
            {t('backup.save')}
          </button>
          <button className="secondary danger" type="button" onClick={() => setWiping(true)}>
            {t('device.wipe')}
          </button>
          <a className="primary center" href="#/">
            {t('nav.decks')}
          </a>
        </div>
        {note && <p className={'hint' + (note.err ? ' err' : '')}>{note.text}</p>}
        {wiping && <WipeSheet db={db} signedIn={false} onClose={() => setWiping(false)} />}
      </section>
    );
  }

  if (!meta.account && !meta.pendingDeletion) {
    return (
      <section>
        <p className="hint">{t('account.signedOut')}</p>
        <a className="secondary center mt" href="#/settings">
          {t('nav.settings')}
        </a>
      </section>
    );
  }

  if (phase === 'deleting') {
    return (
      <section aria-busy="true">
        <h1>{t('account.deleteTitle')}</h1>
        <p role="status">{t('account.deleting')}</p>
      </section>
    );
  }

  if (phase === 'confirm' || phase === 'failed') {
    return (
      <section>
        <h1>{t('account.deleteTitle')}</h1>
        <p className="prompt">{t('account.deleteConfirm')}</p>
        {phase === 'failed' && (
          <p className="hint err" role="alert">
            {t('account.deleteFailed')}
          </p>
        )}
        <div className="two mt">
          <a className="secondary center" href="#/settings">
            {t('common.cancel')}
          </a>
          <button className="secondary danger" type="button" onClick={() => void remove()}>
            {t(phase === 'failed' ? 'common.retry' : 'account.deleteYes')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1>{t('account.deleteTitle')}</h1>
      <p>{t('account.deleteText')}</p>
      {unsent === null && <p className="hint">{t('common.loading')}</p>}
      {unsent !== null && unsent > 0 && (
        <>
          <p className="hint err" role="alert">
            {t('account.deleteUnsent', { n: unsent })}
          </p>
          <button className="secondary mt" type="button" onClick={() => void saveJournal()}>
            {t('backup.save')}
          </button>
        </>
      )}
      <button className="secondary mt" type="button" disabled={copying !== null || unsent === null} onClick={() => void saveCopy()}>
        {t('account.exportAll')}
      </button>
      {copying !== null && <p className="hint" role="status">{t('account.exportProgress', { n: copying })}</p>}
      {note && <p className={'hint' + (note.err ? ' err' : '')} role="status">{note.text}</p>}
      {copyFailed && copying === null && (
        <button className="secondary mt" type="button" onClick={() => void saveCopy()}>
          {t('common.retry')}
        </button>
      )}
      <div className="two mt">
        <a className="secondary center" href="#/settings">
          {t('common.cancel')}
        </a>
        <button className="secondary danger" type="button" disabled={unsent === null || copying !== null} onClick={() => setPhase('confirm')}>
          {t('common.next')}
        </button>
      </div>
    </section>
  );
}
