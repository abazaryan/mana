/**
 * The server's API (stage 6a.2): every request carries the build (X-Mana-Version, for 426) and the
 * profile (X-Mana-Profile, R36 item 3); the session is an HttpOnly cookie the page never sees.
 * A 401 from any request goes to one handler (the app shows the sign-in screen, data stays).
 */
import { EXPORT_PAGE, type ExportHead, type ExportJournalPage } from '../core/accountRows';
import type { Consent } from '../core/auth';
import { BUILD } from '../core/build';
import type { PullResponse, PushResponse } from '../core/syncProtocol';

/** One account per device for now (R33 item 11): the first profile. */
export const PROFILE = 1;

/** A failure carries the parsed body as it came (null if none), for the debug notes of #/lab/cards. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; body?: unknown };

let onUnauthorized: (() => void) | null = null;

/** Who hears about a 401: the session is gone (removed from another device, expired). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  /** The body as JSON text already (the sync push builds it to know its size). */
  raw?: string;
  /** fetch keepalive: the request may outlive the page (sent while it goes to the background). */
  keepalive?: boolean;
  /** A 401 is an answer here, not "the session ended" (the check of an unfinished transfer, R40). */
  quiet401?: boolean;
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { 'X-Mana-Version': String(BUILD), 'X-Mana-Profile': String(PROFILE) };
  const text = options.raw ?? (body === undefined ? undefined : JSON.stringify(body));
  if (text !== undefined) headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      headers,
      body: text,
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: options.keepalive === true,
    });
  } catch {
    return { ok: false, status: 0, error: 'offline' };
  }
  const data = (await response.json().catch(() => null)) as unknown;
  if (response.ok) return { ok: true, data: data as T };
  if (response.status === 401 && options.quiet401 !== true) onUnauthorized?.();
  const code = data !== null && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : 'http';
  return { ok: false, status: response.status, error: code, body: data };
}

export interface DeviceRef {
  id: string;
  name: string;
}

export interface SignedIn {
  userId: string;
  device: DeviceRef;
  /** The account's earlier ids (R40); absent from a server before 6a.4. */
  formerUserIds?: string[];
  /** /api/auth/me only (6a.5): under 16, and whether consent to the current notice is still needed. */
  minor?: boolean;
  needsConsent?: boolean;
}

/**
 * A device with answers names its local user (R40): the new account's id with an account
 * invitation, an earlier id of the account with a device invitation or a code.
 */
export type TransferIds = { localUserId: string } | { formerUserId: string } | null;

export interface DeviceInfo {
  id: string;
  name: string;
  lastSeenAt: number;
  current: boolean;
}

export const inviteInfo = (token: string) => request<{ kind: 'account' | 'device'; minor: boolean }>('POST', 'auth/invite', { token });
export const redeemInvite = (token: string, device: DeviceRef, consent: Consent | null, transfer: TransferIds = null) =>
  request<SignedIn>('POST', 'auth/redeem', { token, device, ...(consent ? { consent } : {}), ...transfer });
export const pairDevice = (code: string, device: DeviceRef, formerUserId: string | null = null) =>
  request<SignedIn>('POST', 'auth/pair', formerUserId ? { code, device, formerUserId } : { code, device });
export const issuePairingCode = () => request<{ code: string; expiresAt: number }>('POST', 'auth/pairing-code');
export const whoAmI = (quiet401 = false) => request<SignedIn>('GET', 'auth/me', undefined, { quiet401 });
/** A backup file of another installation joins the account (R40). */
export const addFormerUserId = (aliasId: string) => request<{ formerUserIds: string[] }>('POST', 'auth/alias', { aliasId });
export const listDevices = () => request<{ devices: DeviceInfo[] }>('GET', 'auth/devices');
export const renameDevice = (name: string) => request<{ ok: true; name: string }>('POST', 'auth/device', { name });
export const revokeDevice = (deviceId: string) => request<{ ok: true }>('POST', 'auth/devices/revoke', { deviceId });
export const signOut = () => request<{ ok: true }>('POST', 'auth/logout');

/** Consent again to the current notice (6a.5, R42 item 6). */
export const giveConsent = (consent: Consent) => request<{ ok: true }>('POST', 'auth/consent', { consent });
/** A copy of the account's data (R42 item 5): everything but the journal, then the journal in pages. */
export const exportHead = () => request<ExportHead>('GET', 'account/export');
export const exportJournalPage = (after: number) => request<ExportJournalPage>('GET', `account/export/journal?after=${after}&limit=${EXPORT_PAGE}`);
/** Deletes the account (R42 item 1). A 401 here is an answer (the erasure has begun), not "the session ended". */
export const deleteAccountRequest = () => request<{ finished: boolean }>('POST', 'account/delete', { confirm: 'delete' }, { quiet401: true });

/** The sync exchange (stage 6a.3): what the engine needs, so tests can give it a fake server. */
export interface SyncTransport {
  push(body: string, keepalive: boolean): Promise<ApiResult<PushResponse>>;
  pull(after: number, limit: number): Promise<ApiResult<PullResponse>>;
}

export const syncTransport: SyncTransport = {
  push: (body, keepalive) => request<PushResponse>('POST', 'sync/push', undefined, { raw: body, keepalive }),
  pull: (after, limit) => request<PullResponse>('GET', `sync/pull?after=${after}&limit=${limit}`),
};
