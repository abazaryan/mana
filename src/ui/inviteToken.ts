/**
 * The token of an opened invitation link, kept in memory only (STAGE6_RESEARCH 3.1, R37): it is
 * taken out of the address at once (history.replaceState), so it stays out of the history, the
 * screen and any copy of the address. A reload loses it — the link is not used up and can be
 * opened again.
 */
import { tokenFromHash } from '../core/auth';

let token: string | null = null;

/** `#/join/<token>` in the address → remember the token, leave `#/join`. */
export function captureInviteToken(): void {
  const found = tokenFromHash(location.hash);
  if (!found) return;
  token = found;
  history.replaceState(history.state, '', `${location.pathname}${location.search}#/join`);
}

/** A link pasted on the sign-in screen. */
export function setInviteToken(value: string): void {
  token = value;
}

export function inviteToken(): string | null {
  return token;
}

export function forgetInviteToken(): void {
  token = null;
}
