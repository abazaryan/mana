/**
 * Sign-in on the device (stage 6a.2, R37): what the user pasted, the order of the invitation
 * screens, names and the code's countdown. Pure logic; requests — src/platform/api.ts,
 * screens — src/ui/JoinFlow.tsx, SignInScreen.tsx, AccountSection.tsx.
 */
import { normalizeCode } from './pairingCode';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** The token of an invitation link `…#/join/<token>`, or null. */
export function tokenFromHash(hash: string): string | null {
  const match = /^#\/join\/([A-Za-z0-9_-]{43})\/?$/.exec(hash);
  return match ? match[1]! : null;
}

export type SignInInput = { kind: 'invite'; token: string } | { kind: 'code'; code: string } | { kind: 'bad' };

/**
 * The one field of the sign-in screen: a whole invitation link (with any text around it, as a
 * messenger pastes it), a bare token, or a pairing code typed any way.
 */
export function readSignInInput(text: string): SignInInput {
  const link = /#\/join\/([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec(text);
  if (link) return { kind: 'invite', token: link[1]! };
  const trimmed = text.trim();
  if (TOKEN.test(trimmed)) return { kind: 'invite', token: trimmed };
  const code = normalizeCode(trimmed);
  return code ? { kind: 'code', code } : { kind: 'bad' };
}

/**
 * The invitation screens (STAGE6_RESEARCH 3.1, 8.2): the notice and "I agree" → "Are you 16?"
 * (skipped when the invitation is marked under 16) → the parent's screen for a "no" or a mark.
 * An invitation for one more device of an account needs none of them.
 */
export type JoinStep = 'notice' | 'age' | 'parent' | 'device';

export function firstJoinStep(kind: 'account' | 'device'): JoinStep {
  return kind === 'device' ? 'device' : 'notice';
}

export function stepAfterNotice(minorByInvite: boolean): JoinStep {
  return minorByInvite ? 'parent' : 'age';
}

/** The consent sent with the invitation; null for a device invitation. */
export type Consent = { version: number; by: 'self' } | { version: number; by: 'parent'; parentName: string; parentAgreed: true };

/** A typed name (device, parent): spaces collapsed; the server applies the same rule. */
export function cleanTypedName(value: string, max: number): string | null {
  const name = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name === '' || [...name].length > max) return null;
  if (/[\p{Cc}‪-‮⁦-⁩]/u.test(name)) return null;
  return name;
}

export const DEVICE_NAME_MAX = 40;
export const PARENT_NAME_MAX = 100;

/** A device's first name, from the browser: "Android · Chrome", "Windows · Edge". The user may rename it. */
export function defaultDeviceName(userAgent: string): string {
  const os = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone/.test(userAgent)
      ? 'iPhone'
      : /iPad/.test(userAgent)
        ? 'iPad'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(userAgent)
            ? 'Mac'
            : /Linux|CrOS/.test(userAgent)
              ? 'Linux'
              : 'Device';
  const browser = /Edg(e|A|iOS)?\//.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera/.test(userAgent)
      ? 'Opera'
      : /SamsungBrowser\//.test(userAgent)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS\//.test(userAgent)
          ? 'Firefox'
          : /Chrome\/|CriOS\//.test(userAgent)
            ? 'Chrome'
            : /Safari\//.test(userAgent)
              ? 'Safari'
              : '';
  return browser ? `${os} · ${browser}` : os;
}

/** A pairing code lives 10 minutes (CODE_TTL in worker/config.ts). */
export const CODE_LIFETIME = 10 * 60_000;

/** Time left of a code as m:ss; 0:00 when it is over. */
export function countdown(msLeft: number): string {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
