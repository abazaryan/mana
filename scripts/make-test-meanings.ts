/**
 * Builds decks/test-meanings.zip: a tiny deck for checking the "meaning language" setting.
 * npm run deck:test-meanings. Node 24+ (runs .ts directly). No audio.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { TEST_MEANINGS_DECK as deck } from './data/test-decks.ts';

const zip = new JSZip();
zip.file('deck.json', JSON.stringify(deck, null, 2));
await mkdir(new URL('../decks/', import.meta.url), { recursive: true });
const out = new URL('../decks/test-meanings.zip', import.meta.url);
await writeFile(out, await zip.generateAsync({ type: 'nodebuffer' }));
console.log('decks/test-meanings.zip is ready.');
