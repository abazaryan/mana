/**
 * Pairing codes (STAGE6_RESEARCH 3.2, R37): 8 characters of Crockford Base32 — 40 random bits,
 * no I, L, O, U. Shared by the app (input, display) and the Worker (issue, check).
 * No imports: the Worker's type check reaches this file.
 */
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 8;

/** 5 random bytes → 8 characters, 5 bits each: every code equally likely. */
export function codeFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== 5) throw new RangeError('5 bytes');
  let bits = 0n;
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte);
  let code = '';
  for (let i = CODE_LENGTH - 1; i >= 0; i--) code += CODE_ALPHABET[Number((bits >> BigInt(i * 5)) & 31n)];
  return code;
}

/**
 * What was typed or pasted → the code, or null. Spaces and hyphens are dropped, letters
 * upper-cased; O reads as 0, I and L as 1 (Crockford). Anything else — null.
 */
export function normalizeCode(input: string): string | null {
  const code = input
    .replace(/[\s\-‐-―]/g, '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** For the eye: XXXX-XXXX. */
export function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
