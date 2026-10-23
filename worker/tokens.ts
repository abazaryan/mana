/**
 * Secrets of sign-in on Web Crypto only (R33 item 4, STAGE6_RESEARCH 3.4): tokens are 32 random
 * bytes in base64url, the database keeps their SHA-256; codes and IP addresses are keyed with
 * the pepper (HMAC-SHA-256, R37 item 4) — without the Worker secret the hashes in D1 say nothing.
 * Also run by the admin scripts under Node (tools/admin/), which has the same Web Crypto.
 */
import { codeFromBytes } from '../src/core/pairingCode.ts';

const encoder = new TextEncoder();

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 32 random bytes → 43 characters of base64url. */
export function newToken(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

/** Exactly what newToken makes; anything else is not a token. */
export function isToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function newPairingCode(): string {
  return codeFromBytes(crypto.getRandomValues(new Uint8Array(5)));
}

export async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

/** HMAC-SHA-256 of `message` with the pepper as the key; `message` carries its kind ("pair:", "ip:"). */
export async function pepperedHex(pepper: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

type TimingSafe = { timingSafeEqual?(a: ArrayBufferView, b: ArrayBufferView): boolean };

/**
 * Two hashes compared in constant time: crypto.subtle.timingSafeEqual in Workers (STAGE6_RESEARCH
 * 3.4); Node (tests, scripts) has no such method — there an XOR over all bytes.
 */
export function sameHash(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  if (x.byteLength !== y.byteLength) return false;
  const subtle = crypto.subtle as unknown as TimingSafe;
  if (subtle.timingSafeEqual) return subtle.timingSafeEqual(x, y);
  let diff = 0;
  for (let i = 0; i < x.byteLength; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

/** RFC 4122 form; ids from clients are checked against it before they reach the database. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * The part of an address the counters key on: IPv4 whole, IPv6 by its /64 (one subscriber
 * has 2^64 addresses there). Without the header (only in tests and wrangler dev) — one bucket.
 */
export function ipKey(ip: string | null): string {
  if (!ip) return 'unknown';
  if (!ip.includes(':')) return ip;
  const [head = '', tail] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = tail === undefined ? left : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':');
}
