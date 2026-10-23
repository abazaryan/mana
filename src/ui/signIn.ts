/**
 * The last step of both ways in (invitation, pairing code): refuse a device with answers (until
 * stage 6a.4 — its data is not touched), send the request, retry once with a new device id if the
 * server says the id is another account's, then remember the account on the device.
 */
import { defaultDeviceName } from '../core/auth';
import type { MetaRow } from '../core/model';
import type { ApiResult, DeviceRef, SignedIn } from '../platform/api';
import type { ManaDb } from '../platform/db';
import { hasLocalAnswers, markSignedIn, renewDeviceId } from '../platform/repo';
import type { StringKey } from './strings';

export type SignInFailure = 'hasAnswers' | 'invalid' | 'tooMany' | 'already' | 'outdated' | 'offline' | 'error';
export type SignInOutcome = { ok: true; meta: MetaRow } | { ok: false; reason: SignInFailure };

export const FAILURE_TEXT: Record<SignInFailure, StringKey> = {
  hasAnswers: 'signin.hasAnswers',
  invalid: 'signin.invalid',
  tooMany: 'signin.tooMany',
  already: 'signin.already',
  outdated: 'signin.outdated',
  offline: 'account.offline',
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
    default:
      return 'error';
  }
}

export async function signInWith(db: ManaDb, send: (device: DeviceRef) => Promise<ApiResult<SignedIn>>): Promise<SignInOutcome> {
  if (await hasLocalAnswers(db)) return { ok: false, reason: 'hasAnswers' };
  let meta = await db.meta.get('device');
  if (!meta) return { ok: false, reason: 'error' };
  const name = defaultDeviceName(navigator.userAgent);
  let result = await send({ id: meta.deviceId, name });
  if (!result.ok && result.error === 'device_taken') {
    meta = await renewDeviceId(db);
    result = await send({ id: meta.deviceId, name });
  }
  if (!result.ok) return { ok: false, reason: failureOf(result) };
  return { ok: true, meta: await markSignedIn(db, result.data.userId, result.data.device.name) };
}
