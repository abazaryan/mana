/**
 * French data for the sound-based check of a spoken answer (R5, R22): numbers in
 * words and the closed lists of homophone rules. The algorithm is language-neutral
 * and lives in src/core/spoken.ts; everything French is here.
 *
 * Principle (R22.1): a false "correct" is worse than a false "Again" (the learner
 * can press "I was misrecognised"). There is no general phonetics: two different
 * spellings match only through one of the rules below, and every exception is a
 * closed list in this file, not code.
 *
 * Type-only imports: run directly by Node through languages.ts.
 */
import { SOUND_RULE } from './cyrillicData.ts';
import type { SpokenRules } from './languages.ts';

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];
const TENS: Record<number, string> = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

/** 0–99. `final`: nothing follows (only then "quatre-vingts" keeps its s). */
function below100(n: number, final: boolean): string {
  if (n <= 16) return UNITS[n]!;
  if (n < 20) return `dix-${UNITS[n - 10]!}`;
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7 || t === 9) {
    const base = t === 7 ? 'soixante' : 'quatre-vingt';
    const rest = n - (t === 7 ? 60 : 80);
    if (t === 7 && rest === 11) return 'soixante et onze';
    return `${base}-${below100(rest, true)}`;
  }
  if (t === 8) return u === 0 ? (final ? 'quatre-vingts' : 'quatre-vingt') : `quatre-vingt-${UNITS[u]!}`;
  const tens = TENS[t]!;
  if (u === 0) return tens;
  if (u === 1) return `${tens} et un`;
  return `${tens}-${UNITS[u]!}`;
}

/** 0–999. */
function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return below100(r, final);
  const hundreds = h === 1 ? 'cent' : `${UNITS[h]!} cent${r === 0 && final ? 's' : ''}`;
  return r === 0 ? hundreds : `${hundreds} ${below100(r, final)}`;
}

/** Cardinal number in words, 0–999 999 (traditional spelling, fr-FR); null outside the range. */
export function frenchCardinal(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) return null;
  if (n < 1000) return below1000(n, true);
  const th = Math.floor(n / 1000);
  const r = n % 1000;
  const thousands = th === 1 ? 'mille' : `${below1000(th, false)} mille`;
  return r === 0 ? thousands : `${thousands} ${below1000(r, true)}`;
}

/** Ordinal in words: 1 → premier / première, 2 → deuxième, 21 → vingt et unième. */
export function frenchOrdinal(n: number, feminine: boolean): string | null {
  if (n === 1) return feminine ? 'première' : 'premier';
  const card = frenchCardinal(n);
  if (card === null || n === 0) return null;
  const m = /^(.*?)([^\s-]+)$/.exec(card)!;
  let last = m[2]!.replace(/s$/, '');
  if (last === 'cinq') last = 'cinqu';
  else if (last === 'neuf') last = 'neuv';
  else last = last.replace(/e$/, '');
  return `${m[1]!}${last}ième`;
}

/**
 * Words ending in -er that are read [ɛʁ], not [e]. Rule Z1 never applies to them
 * (cher ≠ chez). Closed list; every word has a test.
 */
export const ER_READ_AS_AIR: readonly string[] = [
  'amer', 'blazer', 'bulldozer', 'bunker', 'cancer', 'charter', 'cher', 'cluster',
  'cocker', 'container', 'cuiller', 'dealer', 'docker', 'enfer', 'esther', 'éther', 'fer',
  'fier', 'freezer', 'gangster', 'geyser', 'hacker', 'hamster', 'hier', 'hiver', 'holster',
  'joker', 'jupiter', 'kaiser', 'laser', 'leader', 'lucifer', 'magister', 'master', 'mer',
  'munster', 'pater', 'poker', 'reporter', 'revolver', 'rocker',
  'scooter', 'speaker', 'spencer', 'starter', 'super', 'sweater', 'tender', 'thriller', 'ver',
];

/**
 * Rule Z9: a final consonant that is pronounced stays the same when -e is added
 * (seul = seule, noir = noire, tadjik = tadjike). Only these stem endings: l, k, and
 * r not after e (léger ≠ légère; -er belongs to Z1). t, d, n, f… are silent or change
 * (petit ≠ petite, grand ≠ grande, brun ≠ brune, actif → active).
 */
export const PRONOUNCED_FINAL = /(?:l|k|[^e]r)$/;

/** Words where Z9 does not apply although the ending fits: the sound changes with -e. Closed list. */
export const PRONOUNCED_FINAL_EXCEPTIONS: readonly string[] = ['gentil'];

/**
 * Words whose final s or x is pronounced. Rules Z5 and Z6 (silent final -s/-x)
 * never apply to them (bus ≠ bu). Closed list.
 */
export const FINAL_S_PRONOUNCED: readonly string[] = [
  'albatros', 'anus', 'as', 'atlas', 'autobus', 'bis', 'blocus', 'bonus', 'box', 'bus', 'cactus',
  'campus', 'cassis', 'consensus', 'cosmos', 'dix', 'express', 'fax', 'fils', 'hélas', 'humus',
  'index', 'jadis', 'latex', 'lis', 'lotus', 'lynx', 'maïs', 'mars', 'moeurs', 'oasis', 'os',
  'ours', 'papyrus', 'pathos', 'plus', 'processus', 'relax', 'rhinocéros', 'sens', 'silex',
  'sinus', 'six', 'sphinx', 'stimulus', 'stress', 'tennis', 'terminus', 'thermos', 'thorax',
  'tous', 'tournevis', 'virus', 'vis',
];

// A stem ending in a vowel letter other than a plain e: after a plain e the
// ending pairs belong to Z3 (le ≠ les, ce ≠ ces).
const VOWEL_END = /[aiouyàâäéèêëîïôöùûü]$/;
const NOT_E_END = /[^e]$/;

export const FRENCH_SPOKEN: SpokenRules = {
  articles: ['le', 'la', "l'", 'les', 'un', 'une', 'des', 'du'],
  fillers: ['euh', 'heu', 'hum'],
  abbreviations: { 'm.': 'monsieur', mme: 'madame', mlle: 'mademoiselle' },
  cardinal: frenchCardinal,
  ordinal: frenchOrdinal,
  // 1er, 1re, 1ère, 2e, 2ème, 2eme, 2è
  ordinalSuffix: /^(\d+)(er|re|ère|e|ème|eme|è)$/,
  feminineOrdinalSuffixes: ['re', 'ère'],
  endingRules: [
    {
      id: SOUND_RULE.Z1,
      // [e]: parler = parlé = parlez; aimé = aimée
      endings: ['é', 'ée', 'és', 'ées', 'er', 'ez'],
      minStem: 2,
      exceptions: ER_READ_AS_AIR,
    },
    // [ɛ]: parlais = parlait = parlaient (not = parlé: [ɛ] ≠ [e])
    { id: SOUND_RULE.Z2, endings: ['ais', 'ait', 'aient'], minStem: 2 },
    // silent -e/-es: parle = parles; petite = petites (le ≠ les: the stem is too short)
    { id: SOUND_RULE.Z3, endings: ['e', 'es'], minStem: 2 },
    // verb -ent after ils/elles: il parle = ils parlent (content ≠ conte)
    { id: SOUND_RULE.Z4, endings: ['e', 'es', 'ent'], minStem: 2, pluralSubject: 'ent' },
    // silent final -s: ami = amis, il = ils (not before a vowel: liaison)
    { id: SOUND_RULE.Z5, endings: ['', 's'], minStem: 2, stemPattern: NOT_E_END, exceptions: FINAL_S_PRONOUNCED },
    // silent final -x after a vowel: beau = beaux, jeu = jeux
    { id: SOUND_RULE.Z5, endings: ['', 'x'], minStem: 2, stemPattern: VOWEL_END, exceptions: FINAL_S_PRONOUNCED },
    // silent -e after a vowel: ami = amie = amies (petit ≠ petite)
    { id: SOUND_RULE.Z6, endings: ['', 'e', 's', 'es'], minStem: 2, stemPattern: VOWEL_END, exceptions: FINAL_S_PRONOUNCED },
    // cruel = cruelle; quel = quelle = quels = quelles
    { id: SOUND_RULE.Z7, endings: ['el', 'elle', 'els', 'elles'], minStem: 2 },
    // -e after a pronounced final consonant: seul = seule, noir = noire, tadjik = tadjike
    {
      id: SOUND_RULE.Z9,
      endings: ['', 'e', 's', 'es'],
      minStem: 2,
      stemPattern: PRONOUNCED_FINAL,
      exceptions: [...PRONOUNCED_FINAL_EXCEPTIONS, ...FINAL_S_PRONOUNCED],
    },
  ],
  wordClasses: [
    { id: SOUND_RULE.Z8, words: ['a', 'à'] },
    { id: SOUND_RULE.Z8, words: ['ou', 'où'] },
    { id: SOUND_RULE.Z8, words: ['la', 'là'] },
    { id: SOUND_RULE.Z8, words: ['du', 'dû'] },
    { id: SOUND_RULE.Z8, words: ['sur', 'sûr'] },
    { id: SOUND_RULE.Z8, words: ['ces', 'ses'] },
    { id: SOUND_RULE.Z8, words: ['ce', 'se'] },
    { id: SOUND_RULE.Z8, words: ["c'", "s'"] },
    { id: SOUND_RULE.Z8, words: ['on', 'ont'] },
    { id: SOUND_RULE.Z8, words: ['son', 'sont'] },
    { id: SOUND_RULE.Z8, words: ['es', 'est'] },
    { id: SOUND_RULE.Z8, words: ['peu', 'peux', 'peut'] },
    { id: SOUND_RULE.Z8, words: ['veux', 'veut'] },
    { id: SOUND_RULE.Z8, words: ['vingt', 'vin', 'vain'] },
    { id: SOUND_RULE.Z8, words: ['cent', 'sans', 'sang'] },
  ],
  // A final s/x/z before a word starting with a vowel or h may be heard (liaison):
  // there a silent-ending rule does not apply (ils aiment ≠ il aime).
  liaisonFinal: /[sxz]$/,
  liaisonNext: /^[aeiouyhàâäéèêëîïôöùûüœæ]/,
  pluralSubjects: ['ils', 'elles'],
  subjectClitics: ['ne', "n'", 'me', "m'", 'te', "t'", 'se', "s'", 'le', 'la', 'les', "l'", 'y', 'en', 'nous', 'vous', 'lui', 'leur'],
};
