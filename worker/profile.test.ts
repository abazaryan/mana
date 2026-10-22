import { describe, expect, it } from 'vitest';
import { PROFILE_HEADER, profileFrom, sessionCookieName } from './profile.ts';

const headers = (value?: string) => new Headers(value === undefined ? {} : { [PROFILE_HEADER]: value });

describe('X-Mana-Profile', () => {
  it('1 without the header', () => {
    expect(profileFrom(headers())).toBe(1);
  });

  it('1–99', () => {
    expect(profileFrom(headers('1'))).toBe(1);
    expect(profileFrom(headers('2'))).toBe(2);
    expect(profileFrom(headers('99'))).toBe(99);
  });

  it('null for anything else (Headers already trims spaces around a value)', () => {
    for (const value of ['', '0', '01', '100', '-1', '1.5', 'a', '1 2']) expect(profileFrom(headers(value)), JSON.stringify(value)).toBeNull();
  });
});

describe('profile → session cookie', () => {
  it('1 → __Host-mana_s, N → __Host-mana_s<N>', () => {
    expect(sessionCookieName(1)).toBe('__Host-mana_s');
    expect(sessionCookieName(2)).toBe('__Host-mana_s2');
    expect(sessionCookieName(99)).toBe('__Host-mana_s99');
  });

  it('header → cookie: no header is the first profile', () => {
    expect(sessionCookieName(profileFrom(headers()) ?? 0)).toBe('__Host-mana_s');
    expect(sessionCookieName(profileFrom(headers('3')) ?? 0)).toBe('__Host-mana_s3');
  });

  it('throws outside 1–99', () => {
    for (const profile of [0, 100, 1.5, -1, NaN]) expect(() => sessionCookieName(profile)).toThrow(RangeError);
  });
});
