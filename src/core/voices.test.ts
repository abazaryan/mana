import { describe, expect, it } from 'vitest';
import { voiceAvailability, voicesOf, type VoiceInfo } from './voices';

const v = (name: string, lang: string, localService = true): VoiceInfo => ({ name, lang, localService });

describe('browser voices of a language (R33 item 14)', () => {
  it('an empty list is "unknown", not "missing": Chrome on Android may list no voices at all', () => {
    expect(voiceAvailability([], 'fr-FR')).toBe('unknown');
  });

  it('a list without the language is "missing"', () => {
    expect(voiceAvailability([v('English', 'en-US'), v('Deutsch', 'de-DE')], 'fr-FR')).toBe('missing');
  });

  it('a voice of the language, any region, is "present"', () => {
    expect(voiceAvailability([v('English', 'en-US'), v('Amélie', 'fr-CA')], 'fr-FR')).toBe('present');
    expect(voiceAvailability([v('Thomas', 'fr_FR')], 'fr-FR')).toBe('present');
  });

  it('the exact tag first, then on-device voices before network ones', () => {
    const all = [v('Google français', 'fr-FR', false), v('Amélie', 'fr-CA'), v('Hortense', 'fr-FR'), v('English', 'en-GB')];
    expect(voicesOf(all, 'fr-FR').map((x) => x.name)).toEqual(['Hortense', 'Google français', 'Amélie']);
  });
});
