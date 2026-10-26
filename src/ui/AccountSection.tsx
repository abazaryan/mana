import { useCallback, useEffect, useState } from 'react';
import { cleanTypedName, CODE_LIFETIME, countdown, DEVICE_NAME_MAX } from '../core/auth';
import type { MetaRow } from '../core/model';
import { formatCode } from '../core/pairingCode';
import { issuePairingCode, listDevices, renameDevice, revokeDevice, signOut, type DeviceInfo } from '../platform/api';
import type { ManaDb } from '../platform/db';
import { forgetDeleteNotDone, markSignedOut, setAccountDeviceName } from '../platform/repo';
import { onQueued, onSyncChanged } from '../platform/syncEvents';
import { queueCounts } from '../platform/syncStore';
import { AccountLost } from './AccountLost';
import { useI18n } from './i18n';
import { Sheet } from './Sheet';
import { FAILURE_TEXT, failureOf } from './signIn';
import type { StringKey } from './strings';
import { WipeSheet } from './WipeSheet';

interface Props {
  db: ManaDb;
  meta: MetaRow;
  onMetaChange(meta: MetaRow): void;
}

const two = (n: number) => String(n).padStart(2, '0');

/** dd.mm.yyyy in the device's time zone. */
function day(ms: number): string {
  const d = new Date(ms);
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** dd.mm.yyyy hh:mm in the device's time zone. */
const dayTime = (ms: number) => `${day(ms)} ${two(new Date(ms).getHours())}:${two(new Date(ms).getMinutes())}`;

/**
 * Where sync stands (stage 6a.3): records waiting to be sent, records the server did not accept
 * (they stay here and in the file), the last exchange that went through.
 */
function SyncStatus({ db }: { db: ManaDb }) {
  const { t } = useI18n();
  const [state, setState] = useState<{ pending: number; notAccepted: number; last: Date | null; needsConsent: boolean } | null>(null);
  const refresh = useCallback(async () => {
    const [counts, meta] = await Promise.all([queueCounts(db), db.meta.get('device')]);
    setState({ ...counts, last: meta?.sync?.lastOkAt ?? null, needsConsent: meta?.sync?.needsConsent !== undefined });
  }, [db]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    const offQueued = onQueued(() => void refresh());
    const offChanged = onSyncChanged(() => void refresh());
    return () => {
      clearInterval(timer);
      offQueued();
      offChanged();
    };
  }, [refresh]);
  if (!state) return null;
  return (
    <div className="mt" role="status">
      {state.needsConsent && (
        <>
          <p className="hint err">{t('consent.needed')}</p>
          <a className="secondary center mt" href="#/consent">
            {t('consent.read')}
          </a>
        </>
      )}
      <p className="hint">{state.last ? t('sync.last', { date: dayTime(state.last.getTime()) }) : t('sync.never')}</p>
      {state.pending > 0 && <p className="hint">{t('sync.pending', { n: state.pending })}</p>}
      {state.notAccepted > 0 && (
        <>
          <p className="hint err">{t('sync.rejected', { n: state.notAccepted })}</p>
          <p className="hint">{t('sync.rejectedHint')}</p>
        </>
      )}
    </div>
  );
}

/**
 * Settings → Account (stage 6a.2, STAGE6_RESEARCH 3.2–3.3): signed out — the way to the sign-in
 * screen; signed in — this device's name, the account's devices (remove another one), a pairing
 * code for a new device, sign-out with a choice to clear the device, deleting the account
 * (6a.5b, R42). A deletion that did not reach the server, or whose answer is unknown, is said here.
 */
export function AccountSection({ db, meta, onMetaChange }: Props) {
  const { t } = useI18n();
  return (
    <>
      <h2 className="h2">{t('account.title')}</h2>
      {meta.deleteNotDone && (
        <div className="mt">
          <p className="hint err" role="alert">
            {t('account.deleteNotDone')}
          </p>
          <button className="ghost" type="button" onClick={() => void forgetDeleteNotDone(db).then(onMetaChange)}>
            {t('common.close')}
          </button>
        </div>
      )}
      {meta.pendingDeletion ? (
        <>
          <p className="hint err">{t('account.deleteFailed')}</p>
          <a className="secondary danger center mt" href="#/account/delete">
            {t('common.retry')}
          </a>
        </>
      ) : meta.account ? (
        <SignedIn db={db} meta={meta} onMetaChange={onMetaChange} />
      ) : (
        <>
          {meta.accountLost ? <AccountLost db={db} meta={meta} /> : <p className="hint">{t('account.signedOut')}</p>}
          <a className="secondary center mt" href="#/signin">
            {t('account.haveCode')}
          </a>
        </>
      )}
      <p className="note">
        <a href="#/privacy">{t('account.privacy')}</a>
      </p>
    </>
  );
}

function SignedIn({ db, meta, onMetaChange }: Props) {
  const { t } = useI18n();
  const account = meta.account!;
  const [name, setName] = useState(account.deviceName);
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [message, setMessage] = useState<StringKey | null>(null);
  const [removing, setRemoving] = useState<DeviceInfo | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [wiping, setWiping] = useState(false);

  const refresh = useCallback(async () => {
    const result = await listDevices();
    if (result.ok) setDevices(result.data.devices);
    else if (result.status !== 401) setMessage(FAILURE_TEXT[failureOf(result)]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveName = async () => {
    const clean = cleanTypedName(name, DEVICE_NAME_MAX);
    if (!clean) return;
    const result = await renameDevice(clean);
    if (!result.ok) {
      if (result.status !== 401) setMessage(FAILURE_TEXT[failureOf(result)]);
      return;
    }
    setName(result.data.name);
    onMetaChange(await setAccountDeviceName(db, result.data.name));
    void refresh();
  };

  const leave = async () => {
    const result = await signOut();
    if (!result.ok && result.status === 0) {
      setLeaving(false);
      setMessage('account.offline');
      return;
    }
    onMetaChange(await markSignedOut(db));
  };

  const remove = async (device: DeviceInfo) => {
    const result = await revokeDevice(device.id);
    setRemoving(null);
    if (!result.ok && result.status !== 401) setMessage(FAILURE_TEXT[failureOf(result)]);
    void refresh();
  };

  return (
    <>
      <p className="hint">{t('account.signedIn')}</p>
      <SyncStatus db={db} />
      <label className="field">
        <span>{t('account.deviceName')}</span>
        <div className="typebox">
          <input type="text" value={name} maxLength={DEVICE_NAME_MAX} onChange={(e) => setName(e.target.value)} />
          <button
            className="secondary"
            type="button"
            disabled={cleanTypedName(name, DEVICE_NAME_MAX) === null || cleanTypedName(name, DEVICE_NAME_MAX) === account.deviceName}
            onClick={() => void saveName()}
          >
            {t('account.save')}
          </button>
        </div>
      </label>

      <h3 className="h3 mt">{t('account.devices')}</h3>
      {devices && (
        <ul className="devices">
          {devices.map((d) => (
            <li key={d.id}>
              <div>
                <b>{d.name}</b> {d.current && <span className="m">{t('account.thisDevice')}</span>}
                <div className="m">{t('account.lastSeen', { date: day(d.lastSeenAt) })}</div>
              </div>
              {!d.current && (
                <button className="ghost" type="button" onClick={() => setRemoving(d)}>
                  {t('account.remove')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <PairingCode onError={setMessage} />

      {message && (
        <p className="hint err" role="alert">
          {t(message)}
        </p>
      )}

      <button className="secondary danger mt" type="button" onClick={() => setLeaving(true)}>
        {t('account.signOut')}
      </button>
      <a className="secondary danger center mt" href="#/account/delete">
        {t('account.delete')}
      </a>

      {removing && (
        <Sheet title={t('account.remove')} onClose={() => setRemoving(null)} closeLabel={t('common.close')}>
          <p>{t('account.removeConfirm', { name: removing.name })}</p>
          <div className="two mt">
            <button className="secondary" type="button" onClick={() => setRemoving(null)}>
              {t('common.cancel')}
            </button>
            <button className="secondary danger" type="button" onClick={() => void remove(removing)}>
              {t('account.remove')}
            </button>
          </div>
        </Sheet>
      )}
      {leaving && (
        <Sheet title={t('account.signOut')} onClose={() => setLeaving(false)} closeLabel={t('common.close')}>
          <p>{t('account.signOutAsk')}</p>
          <div className="stack mt">
            <button className="secondary" type="button" onClick={() => void leave()}>
              {t('account.signOutKeep')}
            </button>
            <button
              className="secondary danger"
              type="button"
              onClick={() => {
                setLeaving(false);
                setWiping(true);
              }}
            >
              {t('account.signOutWipe')}
            </button>
            <button className="secondary" type="button" onClick={() => setLeaving(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </Sheet>
      )}
      {wiping && <WipeSheet db={db} signedIn onClose={() => setWiping(false)} />}
    </>
  );
}

/** "Add a device": a code for 10 minutes with a countdown; a new one replaces it on the server. */
function PairingCode({ onError }: { onError(key: StringKey): void }) {
  const { t } = useI18n();
  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [code]);

  const issue = async () => {
    setBusy(true);
    const result = await issuePairingCode();
    setBusy(false);
    if (result.ok) {
      // Counted on this device's clock (it may differ from the server's): 10 minutes from the answer.
      setNow(Date.now());
      setCode({ code: result.data.code, expiresAt: Date.now() + CODE_LIFETIME });
    } else if (result.status !== 401) {
      onError(FAILURE_TEXT[failureOf(result)]);
    }
  };

  const left = code ? code.expiresAt - now : 0;
  return (
    <div className="mt">
      {code && left > 0 && (
        <div className="pairing">
          <p className="code-big">{formatCode(code.code)}</p>
          <p className="hint">{t('account.codeHint', { time: countdown(left) })}</p>
        </div>
      )}
      {code && left <= 0 && <p className="hint">{t('account.codeExpired')}</p>}
      {(!code || left <= 0) && (
        <button className="secondary" type="button" disabled={busy} onClick={() => void issue()}>
          {code ? t('account.newCode') : t('account.addDevice')}
        </button>
      )}
    </div>
  );
}
