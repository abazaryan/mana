import { useState } from 'react';
import { signOutAllowsWipe } from '../core/wipe';
import { signOut } from '../platform/api';
import type { ManaDb } from '../platform/db';
import { markSignedOut } from '../platform/repo';
import { wipeDevice } from '../platform/wipe';
import { useI18n } from './i18n';
import { saveJournalFile, sendQueue } from './leaving';
import { Sheet } from './Sheet';

type Phase = { name: 'confirm' } | { name: 'busy' } | { name: 'unsent'; n: number } | { name: 'needsNetwork' } | { name: 'wiping' } | { name: 'blocked' };

interface Props {
  db: ManaDb;
  /** Signed in: the queue goes first, then the sign-out (no network — refused). */
  signedIn: boolean;
  onClose(): void;
}

/**
 * "Clear data on this device" (stage 6a.5b, R42 item 7; order — src/core/wipe.ts). Settings, the
 * sign-out choice, "Account deleted" and the screen after a 401 open it. The page opens afresh at
 * the end: the first run of a new installation.
 */
export function WipeSheet({ db, signedIn, onClose }: Props) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>({ name: 'confirm' });
  const [saved, setSaved] = useState<string | null>(null);

  const wipe = async () => {
    setPhase({ name: 'wiping' });
    await wipeDevice({ close: () => db.close(), onBlocked: () => setPhase({ name: 'blocked' }) });
    location.hash = '#/';
    location.reload();
  };

  const signOutThenWipe = async () => {
    setPhase({ name: 'busy' });
    const answer = await signOut();
    if (!signOutAllowsWipe(answer)) {
      setPhase({ name: 'needsNetwork' });
      return;
    }
    await markSignedOut(db);
    await wipe();
  };

  const start = async () => {
    if (!signedIn) return wipe();
    setPhase({ name: 'busy' });
    const { unsent } = await sendQueue(db);
    if (unsent > 0) setPhase({ name: 'unsent', n: unsent });
    else await signOutThenWipe();
  };

  const save = async () => {
    try {
      setSaved(t('backup.saved', { n: await saveJournalFile(db) }));
    } catch (e) {
      setSaved(t('backup.error.failed', { error: e instanceof Error ? e.message : String(e) }));
    }
  };

  // Once the databases are being deleted there is no way back: no closing.
  const closable = phase.name !== 'wiping' && phase.name !== 'blocked' && phase.name !== 'busy';
  return (
    <Sheet title={t('device.wipe')} onClose={() => closable && onClose()} closeLabel={t('common.close')}>
      {phase.name === 'confirm' && (
        <>
          <p>{t(signedIn ? 'device.wipeConfirmSignedIn' : 'device.wipeConfirm')}</p>
          <div className="two mt">
            <button className="secondary" type="button" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button className="secondary danger" type="button" onClick={() => void start()}>
              {t('device.wipe')}
            </button>
          </div>
        </>
      )}
      {phase.name === 'busy' && <p role="status">{t('common.loading')}</p>}
      {phase.name === 'unsent' && (
        <>
          <p role="alert">{t('device.wipeUnsent', { n: phase.n })}</p>
          <div className="stack mt">
            <button className="secondary" type="button" onClick={() => void save()}>
              {t('backup.save')}
            </button>
            {saved && <p className="hint">{saved}</p>}
            <button className="secondary danger" type="button" onClick={() => void signOutThenWipe()}>
              {t('device.wipeAnyway')}
            </button>
            <button className="secondary" type="button" onClick={onClose}>
              {t('common.cancel')}
            </button>
          </div>
        </>
      )}
      {phase.name === 'needsNetwork' && (
        <>
          <p className="hint err" role="alert">
            {t('device.wipeNeedsNetwork')}
          </p>
          <button className="secondary mt" type="button" onClick={onClose}>
            {t('common.close')}
          </button>
        </>
      )}
      {phase.name === 'wiping' && <p role="status">{t('device.wiping')}</p>}
      {phase.name === 'blocked' && (
        <p role="status">
          {t('device.wiping')} {t('device.wipeBlocked')}
        </p>
      )}
    </Sheet>
  );
}
