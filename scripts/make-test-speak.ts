/**
 * Builds decks/test-speak.zip: a deck for checking stages 4.2–4.3 on the phone —
 * introductions, `speak`, sound-based matching (homophones, numbers), "almost",
 * the article rule with a form hint, "copy it out", and (revision 5) `listen` and
 * `write`: the written article rule (Р24), diacritics, a typo, typography, forms
 * that sound the same (Р16). Revision 6: grammar only through `form`, no grammar words
 * in hint / meaning (the article was «бо артикл», the gender «(мард)» / «(зан)»).
 * Revision 7 (Р28): one answer per card — form.gender for l'ami and «ils parlent»,
 * indefinite pairs for the nouns with l', write on every noun with form.determiner;
 * `npm run deck:check` without warnings.
 * Revision 8 (stage 4.4a): six new entries, so that new entries remain and the soft
 * ban on them while reviews from earlier days wait (Р29.5) can be seen on the phone.
 * Revision 9 (Р30): only the title — the deck name no longer follows the file name.
 * npm run deck:test-speak. Node 24+ (runs .ts directly).
 *
 * Audio: only the `listen` entries have it, copied from the lesson-1 deck
 * (decks/Фаронсавӣ · Дарси 01.zip, not published); without that file the deck is
 * built without them and `listen` is not issued. The other entries have none — the
 * browser voice stands in for it after the answer.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';

const LESSON_1 = new URL('../decks/Фаронсавӣ · Дарси 01.zip', import.meta.url);
/** Entries of this deck that get `listen` with the lesson-1 audio of the same id. */
const LISTEN_FROM_LESSON = ['le-nom', 'deux', 'un-rendez-vous', 'oui', 'je-m-appelle-nazanine'];

const word = { tg: 'вожа', ru: 'слово', en: 'word' };
const phrase = { tg: 'ибора', ru: 'фраза', en: 'phrase' };
const number = { tg: 'адад', ru: 'число', en: 'number' };

const deck = {
  format: 'mana-deck',
  version: 1,
  id: 'fr-test-speak-01',
  revision: 9,
  language: 'fr-FR',
  title: { tg: 'test-speak', ru: 'test-speak', en: 'test-speak' },
  tags: { word, phrase, number },
  entries: [
    {
      id: 'le-nom',
      text: 'le nom',
      ipa: 'lə nɔ̃',
      meaning: { tg: 'насаб', ru: 'фамилия', en: 'surname' },
      hint: { tg: 'на ном', ru: 'не имя', en: 'not the first name' },
      gender: 'm',
      form: { determiner: 'definite' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'parler',
      text: 'parler',
      ipa: 'paʁle',
      meaning: { tg: 'гап задан', ru: 'говорить', en: 'to speak' },
      note: { tg: 'parlé / parlez ҳамон тавр садо медиҳанд', ru: 'parlé / parlez звучат так же', en: 'parlé / parlez sound the same' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'vingt-et-un',
      text: 'vingt et un',
      ipa: 'vɛ̃t‿e œ̃',
      meaning: { tg: 'бисту як (21)', ru: 'двадцать один (21)', en: 'twenty-one (21)' },
      tags: ['number'],
      skills: ['speak'],
    },
    {
      id: 'ils-parlent-francais',
      text: 'ils parlent français',
      ipa: 'il paʁl fʁɑ̃sɛ',
      meaning: { tg: 'онҳо фаронсавӣ гап мезананд', ru: 'они говорят по-французски', en: 'they speak French' },
      note: { tg: '«il parle français» ҳамин тавр садо медиҳад', ru: '«il parle français» звучит так же', en: '"il parle français" sounds the same' },
      form: { gender: 'm' },
      tags: ['phrase'],
      skills: ['speak'],
    },
    {
      id: 'je-voudrais-un-cafe',
      text: 'Je voudrais un café avec du sucre.',
      ipa: 'ʒə vudʁɛ œ̃ kafe avɛk dy sykʁ',
      meaning: { tg: 'Ман қаҳва бо шакар мехостам.', ru: 'Я бы хотел кофе с сахаром.', en: 'I would like a coffee with sugar.' },
      note: {
        tg: '7 вожа: як вожаи гумшуда — «тақрибан дуруст»',
        ru: '7 слов: одно пропущенное слово — «почти»',
        en: '7 words: one word missed is "almost"',
      },
      tags: ['phrase'],
      skills: ['speak'],
    },
    {
      id: 'un-rendez-vous',
      text: 'un rendez-vous',
      ipa: 'œ̃ ʁɑ̃devu',
      meaning: { tg: 'вохӯрӣ', ru: 'встреча', en: 'an appointment' },
      gender: 'm',
      form: { determiner: 'indefinite' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'quatre-vingts',
      text: 'quatre-vingts',
      ipa: 'katʁə vɛ̃',
      meaning: { tg: 'ҳаштод (80)', ru: 'восемьдесят (80)', en: 'eighty (80)' },
      tags: ['number'],
      skills: ['speak'],
    },
    {
      id: 'est-ce-que-tu-parles-francais',
      text: 'Est-ce que tu parles français ?',
      ipa: 'ɛs kə ty paʁl fʁɑ̃sɛ',
      meaning: { tg: 'Ту фаронсавӣ гап мезанӣ?', ru: 'Ты говоришь по-французски?', en: 'Do you speak French? (informal)' },
      tags: ['phrase'],
      skills: ['speak', 'write'],
    },
    {
      id: 'l-eleve',
      text: "l'élève",
      ipa: 'lelɛv',
      meaning: { tg: 'шогирд', ru: 'ученик', en: 'the pupil' },
      gender: 'm',
      form: { determiner: 'definite' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'c-est-la-vie',
      text: "C'est la vie.",
      ipa: 'sɛ la vi',
      meaning: { tg: 'Зиндагӣ ҳамин аст.', ru: 'Такова жизнь.', en: "That's life." },
      tags: ['phrase'],
      skills: ['speak'],
    },
    {
      id: 'tres-tres-bien',
      text: 'très très bien',
      ipa: 'tʁɛ tʁɛ bjɛ̃',
      meaning: { tg: 'хеле-хеле хуб', ru: 'очень-очень хорошо', en: 'very very well' },
      tags: ['phrase'],
      skills: ['speak'],
    },
    {
      id: 'elle-est-seule',
      text: 'elle est seule',
      ipa: 'ɛl ɛ sœl',
      meaning: { tg: 'ӯ танҳост', ru: 'она одна', en: 'she is alone' },
      form: { gender: 'f' },
      note: { tg: '«seul» ва «seule» ҳамон тавр садо медиҳанд', ru: '«seul» и «seule» звучат одинаково', en: '"seul" and "seule" sound the same' },
      tags: ['phrase'],
      skills: ['speak'],
    },
    {
      id: 'deux',
      text: 'deux',
      ipa: 'dø',
      meaning: { tg: 'ду (2)', ru: 'два (2)', en: 'two (2)' },
      tags: ['number'],
      skills: ['speak'],
    },
    {
      id: 'l-ami',
      text: "l'ami",
      ipa: 'lami',
      meaning: { tg: 'дӯст', ru: 'друг', en: 'the friend' },
      gender: 'm',
      form: { determiner: 'definite', gender: 'm' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    // Revision 4: three new entries for checking introductions on the phone.
    {
      id: 'le-livre',
      text: 'le livre',
      ipa: 'lə livʁ',
      meaning: { tg: 'китоб', ru: 'книга', en: 'the book' },
      gender: 'm',
      form: { determiner: 'definite' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'oui',
      text: 'oui',
      ipa: 'wi',
      meaning: { tg: 'ҳа', ru: 'да', en: 'yes' },
      tags: ['word'],
      skills: ['speak'],
    },
    {
      id: 'bonne-nuit',
      text: 'Bonne nuit !',
      ipa: 'bɔn nɥi',
      meaning: { tg: 'Шаб ба хайр!', ru: 'Спокойной ночи!', en: 'Good night!' },
      tags: ['phrase'],
      skills: ['speak', 'write'],
    },
    // Revision 5 (stage 4.3): `listen` and `write`.
    {
      id: 'je-m-appelle-nazanine',
      text: "Je m'appelle Nazanine.",
      ipa: 'ʒə mapɛl nazanin',
      meaning: { tg: 'Номи ман Нозанин.', ru: 'Меня зовут Назанин.', en: 'My name is Nazanine.' },
      note: {
        tg: 'Аудиои аз ҳама дароз (2,4 с): микрофон пас аз он худ аз худ фаъол мешавад',
        ru: 'Самое длинное аудио (2,4 с): микрофон включается сам после него',
        en: 'The longest audio (2.4 s): the microphone starts by itself after it',
      },
      tags: ['phrase'],
      skills: ['speak', 'listen'],
    },
    {
      id: 'la-maison',
      text: 'la maison',
      ipa: 'la mɛzɔ̃',
      meaning: { tg: 'хона', ru: 'дом', en: 'the house' },
      note: {
        tg: '«le maison» ва «maison» — нодуруст (Р24)',
        ru: '«le maison» и «maison» — неверно (Р24)',
        en: '"le maison" and "maison" are incorrect (Р24)',
      },
      gender: 'f',
      form: { determiner: 'definite' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'l-hopital',
      text: "l'hôpital",
      ipa: 'lɔpital',
      meaning: { tg: 'беморхона', ru: 'больница', en: 'the hospital' },
      note: {
        tg: "«le hôpital» — тақрибан дуруст (l' лозим аст); «la hôpital» — нодуруст; «l'hopital» — тақрибан дуруст",
        ru: "«le hôpital» — почти (нужна элизия l'); «la hôpital» — неверно; «l'hopital» — почти",
        en: "\"le hôpital\" is almost (needs l'); \"la hôpital\" is incorrect; \"l'hopital\" is almost",
      },
      gender: 'm',
      form: { determiner: 'definite' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'beaucoup',
      text: 'beaucoup',
      ipa: 'boku',
      meaning: { tg: 'бисёр', ru: 'много', en: 'a lot' },
      note: { tg: '«beacoup» — тақрибан дуруст (як хато)', ru: '«beacoup» — почти (одна опечатка)', en: '"beacoup" is almost (one typo)' },
      tags: ['word'],
      skills: ['write'],
    },
    {
      id: 'ca-va',
      text: 'Ça va ?',
      ipa: 'sa va',
      meaning: { tg: 'Чӣ хел? (корҳо хуб?)', ru: 'Как дела?', en: 'How are you?' },
      note: { tg: '«ça va?» бе фосила ҳам дуруст аст', ru: '«ça va?» без пробела — тоже верно', en: '"ça va?" without the space is correct too' },
      tags: ['phrase'],
      skills: ['speak', 'write'],
    },
    {
      id: 'ravi',
      text: 'ravi',
      ipa: 'ʁavi',
      meaning: { tg: 'шодам', ru: 'рад', en: 'glad' },
      note: { tg: '«ravie» ҳамин тавр садо медиҳад', ru: '«ravie» звучит так же', en: '"ravie" sounds the same' },
      form: { gender: 'm' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'ravie',
      text: 'ravie',
      ipa: 'ʁavi',
      meaning: { tg: 'шодам', ru: 'рада', en: 'glad' },
      note: {
        tg: 'Ҳамон садо, ки «ravi»: танҳо навиштан (Р16)',
        ru: 'Звучит как «ravi»: только письмо (Р16)',
        en: 'Sounds like "ravi": writing only (Р16)',
      },
      form: { gender: 'f' },
      tags: ['word'],
      skills: ['write'],
    },
    // Revision 7 (Р28): the indefinite pairs of the nouns with l' (only `write` checks the gender).
    {
      id: 'un-ami',
      text: 'un ami',
      ipa: 'œ̃n‿ami',
      meaning: { tg: 'дӯст', ru: 'друг', en: 'a friend' },
      gender: 'm',
      form: { determiner: 'indefinite', gender: 'm' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'un-eleve',
      text: 'un élève',
      ipa: 'œ̃n‿elɛv',
      meaning: { tg: 'шогирд', ru: 'ученик', en: 'a pupil' },
      gender: 'm',
      form: { determiner: 'indefinite' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'un-hopital',
      text: 'un hôpital',
      ipa: 'œ̃n‿ɔpital',
      meaning: { tg: 'беморхона', ru: 'больница', en: 'a hospital' },
      gender: 'm',
      form: { determiner: 'indefinite' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    // Revision 8 (stage 4.4a): new entries left to introduce, for the soft ban while debts wait (Р29.5).
    {
      id: 'le-pain',
      text: 'le pain',
      ipa: 'lə pɛ̃',
      meaning: { tg: 'нон', ru: 'хлеб', en: 'the bread' },
      gender: 'm',
      form: { determiner: 'definite' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'la-porte',
      text: 'la porte',
      ipa: 'la pɔʁt',
      meaning: { tg: 'дар', ru: 'дверь', en: 'the door' },
      gender: 'f',
      form: { determiner: 'definite' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'aujourd-hui',
      text: "aujourd'hui",
      ipa: 'oʒuʁdɥi',
      meaning: { tg: 'имрӯз', ru: 'сегодня', en: 'today' },
      tags: ['word'],
      skills: ['speak', 'write'],
    },
    {
      id: 'trente',
      text: 'trente',
      ipa: 'tʁɑ̃t',
      meaning: { tg: 'сӣ (30)', ru: 'тридцать (30)', en: 'thirty (30)' },
      tags: ['number'],
      skills: ['speak'],
    },
    {
      id: 'j-ai-faim',
      text: "J'ai faim.",
      ipa: 'ʒe fɛ̃',
      meaning: { tg: 'Гуруснаам.', ru: 'Я хочу есть.', en: "I'm hungry." },
      tags: ['phrase'],
      skills: ['speak'],
    },
    {
      id: 'merci-beaucoup',
      text: 'Merci beaucoup !',
      ipa: 'mɛʁsi boku',
      meaning: { tg: 'Ташаккури зиёд!', ru: 'Большое спасибо!', en: 'Thank you very much!' },
      tags: ['phrase'],
      skills: ['speak'],
    },
  ],
};

const zip = new JSZip();
try {
  const lesson = await JSZip.loadAsync(await readFile(LESSON_1));
  const lessonDeck = JSON.parse(await lesson.file('deck.json')!.async('string')) as { entries: { id: string; audio?: string }[] };
  for (const id of LISTEN_FROM_LESSON) {
    const path = lessonDeck.entries.find((e) => e.id === id)?.audio;
    const file = path ? lesson.file(path) : null;
    const target = deck.entries.find((e) => e.id === id) as { audio?: string; skills: string[] } | undefined;
    if (!file || !path || !target) {
      console.log(`Нет аудио для ${id} в уроке 1 — без listen.`);
      continue;
    }
    zip.file(path, await file.async('nodebuffer'));
    target.audio = path;
    target.skills = [...target.skills, 'listen'].filter((s, k, all) => all.indexOf(s) === k);
  }
} catch {
  console.log('Нет decks/Фаронсавӣ · Дарси 01.zip — колода без аудио, listen не будет выдаваться.');
}
for (const e of deck.entries as { audio?: string; skills: string[] }[]) {
  if (!e.audio) e.skills = e.skills.filter((s) => s !== 'listen');
}
zip.file('deck.json', JSON.stringify(deck, null, 2));
await mkdir(new URL('../decks/', import.meta.url), { recursive: true });
const out = new URL('../decks/test-speak.zip', import.meta.url);
await writeFile(out, await zip.generateAsync({ type: 'nodebuffer' }));
console.log('decks/test-speak.zip готов.');
