/**
 * The last step of both ways in (invitation, pairing code), and the transfer of answers (stage
 * 6a.4, R40). A device with answers is asked first (the screens): "no" sends nothing. "Yes": the
 * device remembers the transfer, sends its local userId with the request, and after the server's
 * yes moves its records to the account in one transaction. Retry once with a new device id if the
 * server says the id is another account's.
 */
import type { FSRS } from 'ts-fsrs';
import { defaultDeviceName } from '../core/auth';
import type { MetaRow } from '../core/model';
import { whoAmI, type ApiResult, type DeviceRef, type SignedIn } from '../platform/api';
import type { ManaDb } from '../platform/db';
import { adoptAccount, beginTransfer, forgetTransfer, markSignedIn, renewDeviceId, setFormerUserIds, settleLeftovers } from '../platform/repo';
import type { StringKey } from './strings';

export type SignInFailure = 'invalid' | 'tooMany' | 'already' | 'outdated' | 'offline' | 'userTaken' | 'error';
export type SignInOutcome = { ok: true; meta: MetaRow; queued: number } | { ok: false; reason: SignInFailure };

export const FAILURE_TEXT: Record<SignInFailure, StringKey> = {
  invalid: 'signin.invalid',
  tooMany: 'signin.tooMany',
  already: 'signin.already',
  outdated: 'signin.outdated',
  offline: 'account.offline',
  userTaken: 'transfer.userTaken',
  error: 'signin.error',
};

/** An API failure → what the user is told. */
export function failureOf(result: { status: number; error: string }): SignInFailure {
  if (result.status === 0) return 'offline';
  switch (result.error) {
    case 'invalid':
      return 'invalid';
    case 'too_many_requests':
      return 'tooMany';
    case 'already_signed_in':
      return 'already';
    case 'upgrade_required':
      return 'outdated';
    case 'user_taken':
      return 'userTaken';
    default:
      return 'error';
  }
}

/**
 * `send` gets the device and, on a transfer, the local userId (null otherwise); the caller puts
 * it into the request as the invitation's kind wants it. `transfer` — the user said "yes" to
 * adding this device's answers (without answers the question is not asked: false).
 */
export async function signInWith(
  db: ManaDb,
  scheduler: FSRS,
  transfer: boolean,
  send: (device: DeviceRef, localUserId: string | null) => Promise<ApiResult<SignedIn>>,
): Promise<SignInOutcome> {
  let meta = transfer ? await beginTransfer(db) : await db.meta.get('device');
  if (!meta) return { ok: false, reason: 'error' };
  const local = transfer ? meta.userId : null;
  const name = defaultDeviceName(navigator.userAgent);
  let result = await send({ id: meta.deviceId, name }, local);
  if (!result.ok && result.error === 'device_taken') {
    meta = await renewDeviceId(db, undefined, transfer);
    result = await send({ id: meta.deviceId, name }, local);
  }
  if (!result.ok) {
    // No answer at all: the server may have taken it — the start of the app asks (/api/auth/me).
    if (transfer && result.status !== 0) await forgetTransfer(db);
    return { ok: false, reason: failureOf(result) };
  }
  const { userId, device, formerUserIds = [] } = result.data;
  if (!transfer) return { ok: true, meta: await markSignedIn(db, userId, device.name, new Date(), formerUserIds), queued: 0 };
  const adopted = await adoptAccount(db, scheduler, userId, device.name, formerUserIds);
  return { ok: true, meta: adopted.meta, queued: adopted.queued };
}

/**
 * At start: a transfer whose tab closed between the server's yes and the device's transaction
 * (R40). The server's view decides: signed in as the account that took this device's id —
 * finish it; no session — forget it; no network — ask again next start. True — finished.
 */
export async function finishTransfer(db: ManaDb, scheduler: FSRS): Promise<boolean> {
  const meta = await db.meta.get('device');
  const pending = meta?.pendingTransfer;
  if (!meta || !pending) return false;
  const res = await whoAmI(true);
  if (!res.ok) {
    if (res.status === 401) await forgetTransfer(db);
    return false;
  }
  const { userId, device, formerUserIds = [] } = res.data;
  if (userId !== pending.localUserId && !formerUserIds.includes(pending.localUserId)) {
    await forgetTransfer(db);
    return false;
  }
  await adoptAccount(db, scheduler, userId, device.name, formerUserIds);
  return true;
}

/**
 * At start on a signed-in device: the account's earlier ids as the server lists them now, then
 * records still under one of them move to the account (another window, an older build). True —
 * records moved.
 */
export async function refreshAccount(db: ManaDb, scheduler: FSRS): Promise<boolean> {
  const res = await whoAmI();
  if (res.ok && res.data.formerUserIds) await setFormerUserIds(db, res.data.formerUserIds);
  return settleLeftovers(db, scheduler);
}
