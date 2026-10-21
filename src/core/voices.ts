/**
 * Browser voices of a learning language (speechSynthesis, Р33 п. 14), as pure logic:
 * which voice speaks first, and whether "this device has no voice for the language"
 * can be said at all.
 */

/** What the browser tells about one voice (the fields of SpeechSynthesisVoice used here). */
export interface VoiceInfo {
  name: string;
  lang: string;
  localService: boolean;
}

const tagOf = (v: VoiceInfo) => v.lang.replace('_', '-').toLowerCase();

/** Voices of `lang`: the exact tag first, then the same primary language; on-device ones first. */
export function voicesOf<V extends VoiceInfo>(all: readonly V[], lang: string): V[] {
  const want = lang.toLowerCase();
  const prefix = want.split('-')[0]!;
  const rank = (v: V) => (tagOf(v) === want ? 0 : 2) + (v.localService ? 0 : 1);
  return all.filter((v) => tagOf(v) === want || tagOf(v).split('-')[0] === prefix).sort((a, b) => rank(a) - rank(b));
}

/**
 * `missing` — the browser lists voices and none is of this language: say so plainly.
 * `unknown` — the list is empty: Chrome on Android may list nothing even when a voice
 * exists, so only listening tells; the "Yes" answer stays open. `present` — there is one.
 */
export type VoiceAvailability = 'present' | 'missing' | 'unknown';

export function voiceAvailability(all: readonly VoiceInfo[], lang: string): VoiceAvailability {
  if (all.length === 0) return 'unknown';
  return voicesOf(all, lang).length > 0 ? 'present' : 'missing';
}
