import { describe, expect, it } from 'vitest';
import { codeFromBytes, formatCode, normalizeCode } from '../src/core/pairingCode.ts';
import { ipKey, isToken, isUuid, newPairingCode, newToken, pepperedHex, sameHash, sha256Hex } from './tokens.ts';

describe('tokens', () => {
  it('32 random bytes as 43 characters of base64url, never twice the same', () => {
    const tokens = new Set(Array.from({ length: 200 }, newToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(isToken(token)).toBe(true);
  });

  it('isToken refuses anything else', () => {
    for (const value of ['', 'a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}+`, 42, null]) {
      expect(isToken(value), String(value)).toBe(false);
    }
  });

  it('SHA-256 as hex (known value)', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('HMAC with the pepper: other pepper — other hash, same input — same hash', async () => {
    const a = await pepperedHex('one', 'pair:ABCD1234');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await pepperedHex('one', 'pair:ABCD1234')).toBe(a);
    expect(await pepperedHex('two', 'pair:ABCD1234')).not.toBe(a);
    // RFC 4231, test case 2
    expect(await pepperedHex('Jefe', 'what do ya want for nothing?')).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  it('sameHash compares whole values', () => {
    expect(sameHash('ab', 'ab')).toBe(true);
    expect(sameHash('ab', 'ac')).toBe(false);
    expect(sameHash('ab', 'abc')).toBe(false);
  });

  it('isUuid', () => {
    expect(isUuid(crypto.randomUUID())).toBe(true);
    expect(isUuid('402d25f9-3390-45f4-9177-57621f47066')).toBe(false);
    expect(isUuid("x' OR 1=1 --")).toBe(false);
  });
});

describe('pairing codes', () => {
  it('5 bytes → 8 Crockford characters', () => {
    expect(codeFromBytes(new Uint8Array([0, 0, 0, 0, 0]))).toBe('00000000');
    expect(codeFromBytes(new Uint8Array([255, 255, 255, 255, 255]))).toBe('ZZZZZZZZ');
    expect(codeFromBytes(new Uint8Array([0, 0, 0, 0, 31]))).toBe('0000000Z');
    expect(() => codeFromBytes(new Uint8Array(4))).toThrow();
  });

  it('new codes are 8 characters of the alphabet', () => {
    for (let i = 0; i < 100; i++) expect(newPairingCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('typing: spaces, hyphens, case; O → 0, I and L → 1; U and others refused', () => {
    expect(normalizeCode('abcd-efgh')).toBe('ABCDEFGH');
    expect(normalizeCode(' 7k3p 9x2m ')).toBe('7K3P9X2M');
    expect(normalizeCode('oOiL-1234')).toBe('00111234');
    expect(normalizeCode('ABCD–EFGH')).toBe('ABCDEFGH');
    expect(normalizeCode('ABCDEFGU')).toBeNull();
    expect(normalizeCode('ABCDEFG')).toBeNull();
    expect(normalizeCode('ABCDEFGHJ')).toBeNull();
    expect(normalizeCode('ABCD.EFGH')).toBeNull();
  });

  it('display XXXX-XXXX', () => {
    expect(formatCode('7K3P9X2M')).toBe('7K3P-9X2M');
  });
});

describe('ipKey', () => {
  it('IPv4 whole; IPv6 — its /64, however written', () => {
    expect(ipKey('198.51.100.7')).toBe('198.51.100.7');
    expect(ipKey('2001:db8:1:2::1')).toBe('2001:db8:1:2');
    expect(ipKey('2001:0DB8:0001:0002:ffff:0:0:9')).toBe('2001:db8:1:2');
    expect(ipKey('2001:db8::1')).toBe('2001:db8:0:0');
    expect(ipKey('::1')).toBe('0:0:0:0');
    expect(ipKey(null)).toBe('unknown');
  });
});
