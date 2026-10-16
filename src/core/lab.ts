/**
 * Recognizer experiment ("lab", docs/RECOGNITION_EXPERIMENT.md): data shapes shared by the
 * hidden recording page (#/lab/record), the set generator and the comparison script
 * (tools/lab/). Not part of the learning cycle.
 */
import type { Verdict } from './evaluate';

export type LabCategory =
  | 'normal'
  | 'short'
  | 'err-article'
  | 'err-word'
  | 'err-missing'
  | 'err-extra'
  | 'similar'
  | 'accent'
  | 'repeat';

export const LAB_CATEGORIES: readonly LabCategory[] = [
  'normal',
  'short',
  'err-article',
  'err-word',
  'err-missing',
  'err-extra',
  'similar',
  'accent',
  'repeat',
];

/** Names shown on the recording page and in the report (Russian: a working page for the owner). */
export const LAB_CATEGORY_LABELS: Record<LabCategory, string> = {
  normal: 'верное, обычное',
  short: 'короткое слово',
  'err-article': 'ошибка: другой артикль',
  'err-word': 'ошибка: другое слово',
  'err-missing': 'ошибка: пропущено слово',
  'err-extra': 'ошибка: лишнее слово',
  similar: 'похожее слово (другое слово!)',
  accent: 'верное, небрежно',
  repeat: 'повтор эталона',
};

/** One item of the recording set. */
export interface LabItem {
  id: string;
  category: LabCategory;
  /** Reference text of the card. */
  reference: string;
  /** What must be said, exactly as written (for an error: the wrong text on purpose). */
  said: string;
  /** The card shows a `determiner` hint, so a wrong article is "incorrect" (Р16, Р22). */
  determiner: boolean;
  /** Expected verdict: checkSpoken(reference, [said]) by the app's own rules. */
  expected: Verdict;
}

export interface LabSet {
  format: 'mana-lab-set';
  version: 1;
  language: string;
  items: LabItem[];
}

/** Text of the instruction under the item (what to say and how). */
export function labInstruction(item: Pick<LabItem, 'category' | 'said'>): string {
  switch (item.category) {
    case 'normal':
    case 'short':
      return 'Скажите как обычно.';
    case 'accent':
      return 'Скажите небрежно и быстро, как получится, со своим обычным произношением.';
    case 'repeat':
      return 'Скажите ровно так, с повтором.';
    case 'similar':
      return 'Это другое слово — скажите именно его, как написано.';
    default:
      return 'Здесь ошибка нарочно — скажите именно так, как написано.';
  }
}

/** What Chrome returned for one item (Web Speech, second pass). */
export interface LabChromeResult {
  alternatives: string[];
  confidences: (number | null)[];
  /** Error code of the recognizer or null. */
  error: string | null;
  /** From start() to the first result, ms. */
  resultMs: number | null;
  /** The speaker marks this take as spoiled (slipped, noise). */
  spoiled: boolean;
}

export interface LabManifestItem extends LabItem {
  /** Paths inside the ZIP; null if the item was not recorded. */
  audioWebm: string | null;
  audioWav: string | null;
  mimeType: string | null;
  durationMs: number | null;
  /** The recording is marked as spoiled by the speaker. */
  spoiled: boolean;
  chrome: LabChromeResult | null;
  /** Trial of simultaneous recording + recognition on pass 1 (null if not tried). */
  chromeSimultaneous: LabChromeResult | null;
}

export interface LabManifest {
  format: 'mana-lab-recordings';
  version: 1;
  language: string;
  createdAt: string;
  userAgent: string;
  items: LabManifestItem[];
}

/** 16-bit PCM mono WAV from samples in [-1, 1]. */
export function encodeWav16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

export function isLabSet(x: unknown): x is LabSet {
  const s = x as Partial<LabSet> | null;
  return (
    !!s &&
    s.format === 'mana-lab-set' &&
    s.version === 1 &&
    typeof s.language === 'string' &&
    Array.isArray(s.items) &&
    s.items.every(
      (i) =>
        typeof i?.id === 'string' &&
        typeof i.reference === 'string' &&
        typeof i.said === 'string' &&
        LAB_CATEGORIES.includes(i.category),
    )
  );
}
