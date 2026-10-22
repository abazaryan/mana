/**
 * Profiles (STAGE6_RESEARCH 5.11, Р33 п. 11): each account on a device has its own IndexedDB and
 * its own session cookie; the client names its profile in X-Mana-Profile on every request.
 * Laid down in 6a so a second account later needs no migration. Sessions come in 6a.2.
 */
export const PROFILE_HEADER = 'X-Mana-Profile';
export const MAX_PROFILE = 99;

/** The profile a request is for: 1 without the header; null if the header is malformed (400). */
export function profileFrom(headers: Headers): number | null {
  const value = headers.get(PROFILE_HEADER);
  if (value === null) return 1;
  return /^[1-9][0-9]?$/.test(value) ? Number(value) : null;
}

/** Session cookie of a profile: 1 → __Host-mana_s, N → __Host-mana_s<N>. */
export function sessionCookieName(profile: number): string {
  if (!Number.isInteger(profile) || profile < 1 || profile > MAX_PROFILE) throw new RangeError(`profile ${profile}`);
  return profile === 1 ? '__Host-mana_s' : `__Host-mana_s${profile}`;
}
