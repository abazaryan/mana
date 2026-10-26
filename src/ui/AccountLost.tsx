import { useState } from 'react';
import type { MetaRow } from '../core/model';
import type { ManaDb } from '../platform/db';
import { useI18n } from './i18n';
import { WipeSheet } from './WipeSheet';

/**
 * A device that was in an account and is no longer (`meta.accountLost`, R33 item 13): why, and the
 * way to clear its data — or to stay without an account (nothing to press). On the sign-in screen
 * and in the Account section, after a reload too; gone with a new sign-in or the clearing.
 */
export function AccountLost({ db, meta }: { db: ManaDb; meta: MetaRow }) {
  const { t } = useI18n();
  const [wiping, setWiping] = useState(false);
  if (!meta.accountLost || meta.account) return null;
  return (
    <div className="mt">
      {meta.accountLost.reason === 'deleted' ? (
        <>
          <p role="status">
            <b>{t('account.deletedTitle')}</b>
          </p>
          <p>{t('account.deletedText')}</p>
        </>
      ) : (
        <p role="status">{t('account.signedOutBy')}</p>
      )}
      <button className="secondary danger mt" type="button" onClick={() => setWiping(true)}>
        {t('device.wipe')}
      </button>
      {wiping && <WipeSheet db={db} signedIn={false} onClose={() => setWiping(false)} />}
    </div>
  );
}
