import { describe, expect, it } from 'vitest';
import { cleanTypedName, countdown, defaultDeviceName, firstJoinStep, readSignInInput, stepAfterNotice, tokenFromHash } from './auth';

const TOKEN = 'Ab3_-xY9'.repeat(5) + 'abc';

describe('invitation links', () => {
  it('the token of #/join/<token>; anything else is none', () => {
    expect(TOKEN).toHaveLength(43);
    expect(tokenFromHash(`#/join/${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromHash(`#/join/${TOKEN}/`)).toBe(TOKEN);
    expect(tokenFromHash('#/join')).toBeNull();
    expect(tokenFromHash(`#/join/${TOKEN}x`)).toBeNull();
    expect(tokenFromHash(`#/deck/${TOKEN}`)).toBeNull();
  });
});

describe('the sign-in field: link, bare token or code', () => {
  it('a whole link, also with a messenger’s text around it', () => {
    expect(readSignInInput(`https://mana.amisipehr.workers.dev/#/join/${TOKEN}`)).toEqual({ kind: 'invite', token: TOKEN });
    expect(readSignInInput(`Here: https://mana.amisipehr.workers.dev/#/join/${TOKEN} — open it`)).toEqual({ kind: 'invite', token: TOKEN });
    expect(readSignInInput(` ${TOKEN} `)).toEqual({ kind: 'invite', token: TOKEN });
  });

  it('a code typed any way', () => {
    expect(readSignInInput('7k3p-9x2m')).toEqual({ kind: 'code', code: '7K3P9X2M' });
    expect(readSignInInput(' 7K3P 9X2M ')).toEqual({ kind: 'code', code: '7K3P9X2M' });
  });

  it('anything else', () => {
    for (const text of ['', 'hello', '7K3P-9X2', `#/join/${TOKEN.slice(1)}`]) expect(readSignInInput(text), text).toEqual({ kind: 'bad' });
  });
});

describe('the order of the invitation screens', () => {
  it('a new account: the notice first; a device invitation: none of the consent screens', () => {
    expect(firstJoinStep('account')).toBe('notice');
    expect(firstJoinStep('device')).toBe('device');
  });

  it('after the notice: the age question, or straight to the parent when the invitation says under 16', () => {
    expect(stepAfterNotice(false)).toBe('age');
    expect(stepAfterNotice(true)).toBe('parent');
  });
});

describe('names and the countdown', () => {
  it('a typed name: spaces collapsed, limits, no control characters', () => {
    expect(cleanTypedName('  Mama   phone ', 40)).toBe('Mama phone');
    expect(cleanTypedName('   ', 40)).toBeNull();
    expect(cleanTypedName('x'.repeat(41), 40)).toBeNull();
    expect(cleanTypedName('a\u0007b', 40)).toBeNull();
  });

  it('device names from the browser', () => {
    const android = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0';
    const opera = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 OPR/90.0.0.0';
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    expect(defaultDeviceName(android)).toBe('Android · Chrome');
    expect(defaultDeviceName(edge)).toBe('Windows · Edge');
    expect(defaultDeviceName(opera)).toBe('Android · Opera');
    expect(defaultDeviceName(iphone)).toBe('iPhone · Safari');
    expect(defaultDeviceName('')).toBe('Device');
  });

  it('m:ss, never below zero', () => {
    expect(countdown(600_000)).toBe('10:00');
    expect(countdown(61_001)).toBe('1:02');
    expect(countdown(999)).toBe('0:01');
    expect(countdown(-5)).toBe('0:00');
  });
});
