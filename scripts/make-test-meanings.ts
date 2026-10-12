/**
 * Builds decks/test-meanings.zip: a tiny deck for checking the "meaning language" setting.
 * npm run deck:test-meanings. Node 24+ (runs .ts directly). No audio.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';

const deck = {
  format: 'sluh-deck',
  version: 1,
  id: 'fr-test-meanings-01',
  revision: 1,
  language: 'fr-FR',
  tags: { word: { tg: 'калима', ru: 'слово', en: 'word' } },
  entries: [
    {
      id: 'chat',
      text: 'le chat',
      ipa: 'lə ʃa',
      meaning: { tg: 'гурба (tg)', ru: 'кошка (ru)', en: 'cat (en)' },
      gender: 'm',
      form: { determiner: 'definite' },
      tags: ['word'],
      skills: ['speak'],
    },
    {
      id: 'chien',
      text: 'le chien',
      ipa: 'lə ʃjɛ̃',
      meaning: { tg: 'саг (tg)', ru: 'собака (ru)', en: 'dog (en)' },
      gender: 'm',
      form: { determiner: 'definite' },
      tags: ['word'],
      skills: ['speak'],
    },
    {
      id: 'oiseau',
      text: 'l\'oiseau',
      ipa: 'lwazo',
      meaning: { tg: 'парранда (только tg)' },
      gender: 'm',
      form: { determiner: 'definite' },
      tags: ['word'],
      skills: ['speak'],
    },
  ],
};

const zip = new JSZip();
zip.file('deck.json', JSON.stringify(deck, null, 2));
await mkdir(new URL('../decks/', import.meta.url), { recursive: true });
const out = new URL('../decks/test-meanings.zip', import.meta.url);
await writeFile(out, await zip.generateAsync({ type: 'nodebuffer' }));
console.log('decks/test-meanings.zip готов.');
