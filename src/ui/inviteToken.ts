/**
 * The token of an opened invitation link, kept in memory only (STAGE6_RESEARCH 3.1, R37): it is
 * taken out of the address at once (history.replaceState), so it stays out of the history, the
 * screen and any copy of the address. A reload loses it — the link is not used up and can be
 * opened again.
 */
import { tokenFromHash } from '../core/auth';

let token: string | null = null;
/** How many times a link was opened or pasted: the invitation screens start afresh on each (after a "no" the same link is opened again, R40). */
let opened = 0;

/** `#/join/<token>` in the address → remember the token, leave `#/join`. */
export function captureInviteToken(): void {
  const found = tokenFromHash(location.hash);
  if (!found) return;
  token = found;
  opened++;
  history.replaceState(history.state, '', `${location.pathname}${location.search}#/join`);
}

/** A link pasted on the sign-in screen. */
export function setInviteToken(value: string): void {
  token = value;
  opened++;
}

export function inviteOpened(): number {
  return opened;
}

export function inviteToken(): string | null {
  return token;
}

export function forgetInviteToken(): void {
  token = null;
}
