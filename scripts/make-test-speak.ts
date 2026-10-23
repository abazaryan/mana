/**
 * Builds decks/test-speak.zip: a deck for checking stages 4.2–4.3 on the phone —
 * introductions, `speak`, sound-based matching (homophones, numbers), "almost",
 * the article rule with a form hint, "copy it out", and (revision 5) `listen` and
 * `write`: the written article rule (R24), diacritics, a typo, typography, forms
 * that sound the same (R16). Revision 6: grammar only through `form`, no grammar words
 * in hint / meaning (the article was spelled out in a hint, the gender written in parentheses).
 * Revision 7 (R28): one answer per card — form.gender for l'ami and "ils parlent",
 * indefinite pairs for the nouns with l', write on every noun with form.determiner;
 * `npm run deck:check` without warnings.
 * Revision 8 (stage 4.4a): six new entries, so that new entries remain and the soft
 * ban on them while reviews from earlier days wait (R29.5) can be seen on the phone.
 * Revision 9 (R30): only the title — the deck name no longer follows the file name.
 * npm run deck:test-speak. Node 24+ (runs .ts directly).
 *
 * Audio: only the `listen` entries have it, copied from the lesson-1 deck
 * (decks/<lesson 1 file name>, not published); without that file the deck is
 * built without them and `listen` is not issued. The other entries have none — the
 * browser voice stands in for it after the answer.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { LESSON_1_FILE_NAME, TEST_SPEAK_DECK as deck } from './data/test-decks.ts';

const LESSON_1 = new URL(`../decks/${LESSON_1_FILE_NAME}`, import.meta.url);
/** Entries of this deck that get `listen` with the lesson-1 audio of the same id. */
const LISTEN_FROM_LESSON = ['le-nom', 'deux', 'un-rendez-vous', 'oui', 'je-m-appelle-nazanine'];

const zip = new JSZip();
try {
  const lesson = await JSZip.loadAsync(await readFile(LESSON_1));
  const lessonDeck = JSON.parse(await lesson.file('deck.json')!.async('string')) as { entries: { id: string; audio?: string }[] };
  for (const id of LISTEN_FROM_LESSON) {
    const path = lessonDeck.entries.find((e) => e.id === id)?.audio;
    const file = path ? lesson.file(path) : null;
    const target = deck.entries.find((e) => e.id === id) as { audio?: string; skills: string[] } | undefined;
    if (!file || !path || !target) {
      console.log(`No audio for ${id} in lesson 1 — no listen.`);
      continue;
    }
    zip.file(path, await file.async('nodebuffer'));
    target.audio = path;
    target.skills = [...target.skills, 'listen'].filter((s, k, all) => all.indexOf(s) === k);
  }
} catch {
  console.log(`No decks/${LESSON_1_FILE_NAME} — the deck has no audio, listen is not issued.`);
}
for (const e of deck.entries as { audio?: string; skills: string[] }[]) {
  if (!e.audio) e.skills = e.skills.filter((s) => s !== 'listen');
}
zip.file('deck.json', JSON.stringify(deck, null, 2));
await mkdir(new URL('../decks/', import.meta.url), { recursive: true });
const out = new URL('../decks/test-speak.zip', import.meta.url);
await writeFile(out, await zip.generateAsync({ type: 'nodebuffer' }));
console.log('decks/test-speak.zip is ready.');
