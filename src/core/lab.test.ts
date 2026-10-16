import { describe, expect, it } from 'vitest';
import { encodeWav16, isLabSet, labInstruction } from './lab';

describe('encodeWav16', () => {
  it('writes a 16-bit mono PCM header and clamps samples', () => {
    const wav = encodeWav16(new Float32Array([0, 1, -1, 2]), 16000);
    const v = new DataView(wav);
    const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    expect(wav.byteLength).toBe(44 + 8);
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(8);
    expect([v.getInt16(44, true), v.getInt16(46, true), v.getInt16(48, true), v.getInt16(50, true)]).toEqual([0, 32767, -32768, 32767]);
  });
});

describe('isLabSet', () => {
  const item = { id: 'i01', category: 'short', reference: 'un', said: 'un', determiner: false, expected: 'correct' };
  it('accepts a valid set', () => {
    expect(isLabSet({ format: 'mana-lab-set', version: 1, language: 'fr-FR', items: [item] })).toBe(true);
  });
  it('rejects other files', () => {
    expect(isLabSet({ format: 'mana-deck' })).toBe(false);
    expect(isLabSet(null)).toBe(false);
    expect(isLabSet({ format: 'mana-lab-set', version: 1, language: 'fr-FR', items: [{ ...item, category: 'nope' }] })).toBe(false);
  });
});

describe('labInstruction', () => {
  it('tells an intended error from an ordinary item', () => {
    expect(labInstruction({ category: 'err-word', said: 'x' })).toMatch(/нарочно/);
    expect(labInstruction({ category: 'normal', said: 'x' })).not.toMatch(/нарочно/);
  });
});
