/**
 * Golden values taken before the bottom row of the on-screen keyboard changed (R41):
 * the written check and the set of typable characters must stay exactly as they were.
 */
import { describe, expect, it } from 'vitest';
import { checkWritten, type ArticleForm } from './evaluate';
import { reachableChars } from './keyboard';
import { FRENCH } from './languages';

const NONE: ArticleForm = { determiner: false };

const CASES: readonly [expected: string, typed: string][] = [
  ['Oui, merci.', 'Oui merci'],
  ['Oui merci', 'Oui, merci,'],
  ['« Bonjour »', 'bonjour'],
  ['Il dit : "non"', 'Il dit non'],
  ['Il dit : “non”', 'Il dit "non"'],
  ['„ja“', 'ja'],
  ['Ça va ?', 'Ça va !'],
  ['Attends…', 'Attends...'],
  ['Viens ; vite !', 'Viens: vite'],
  ["aujourd'hui", 'aujourdhui'],
  ["aujourd'hui", "aujourd'hui"],
  ["l'ami", 'lami'],
  ["l'ami", "l'ami,"],
  ['grand-père', 'grand père'],
  ['grand-père', 'grand-père'],
  ['est-ce que', 'est ce que ?'],
  ["Qu'est-ce que c'est ?", "Qu'est-ce que c'est"],
  ["Qu'est-ce que c'est ?", 'Quest-ce que cest'],
  ['rendez-vous', "rendez'vous"],
  ['bonjour', 'bonjour-'],
];

const show = (expected: string, typed: string) => {
  const { evaluation, cells } = checkWritten(expected, typed, FRENCH.writing, NONE);
  const marks = cells.filter((c) => c.status !== 'ok').map((c) => `${c.status}:${c.top ?? '_'}/${c.bottom ?? '_'}`);
  return `${evaluation.verdict}${evaluation.errorType ? ` ${evaluation.errorType}` : ''}${evaluation.punctuationNote ? ' punct' : ''} | ${marks.join(' ')}`;
};

describe('the written check is unchanged by the bottom row (R41)', () => {
  it('verdicts and marks of answers with punctuation, apostrophe and hyphen', () => {
    expect(CASES.map(([e, a]) => show(e, a))).toMatchInlineSnapshot(`
      [
        "correct punct | punct:_/, punct:_/.",
        "correct punct | punct:,/_ punct:,/_",
        "correct punct | punct:_/« punct:_/»",
        "correct punct | punct:_/: punct:_/" punct:_/"",
        "correct punct | punct:"/: punct:_/“ punct:"/”",
        "correct punct | punct:_/„ punct:_/“",
        "correct punct | punct:!/?",
        "correct punct | punct:./… punct:./_ punct:./_",
        "correct punct | punct::/_ punct:_/; punct:_/!",
        "almost typo | missing:_/'",
        "correct | ",
        "incorrect | missing:_/'",
        "correct punct | punct:,/_",
        "almost typo | wrong: /-",
        "correct | ",
        "almost typo punct | wrong: /- punct:?/_",
        "correct punct | punct:_/?",
        "almost typo punct | missing:_/' missing:_/' punct:_/?",
        "almost typo | wrong:'/-",
        "almost typo | extra:-/_",
      ]
    `);
  });

  it('the ignored punctuation is the same 13 marks', () => {
    let sample = '’‘‹›–—';
    for (let c = 32; c < 127; c++) sample += String.fromCharCode(c);
    sample += '…«»“”„';
    const ignored = new Set([...sample].filter((ch) => ch.replace(FRENCH.writing.ignoredPunctuation!, '') === ''));
    expect([...ignored].sort()).toEqual(['.', ',', '?', '!', ':', ';', '…', '«', '»', '"', '“', '”', '„'].sort());
  });
});

describe('the on-screen keyboard types the same characters (R41)', () => {
  it('letters, letter variants and marks', () => {
    expect([...reachableChars(FRENCH.keyboard)].sort().join('')).toBe(
      [..." '-.,?!:;…«»\"“”„qwertyuiopasdfghjklzxcvbnméèêëàâæçîïôœûùü"].sort().join(''),
    );
  });
});
