/**
 * Builds decks/test-speak.zip: a deck for checking stage 4.2 on the phone —
 * introductions, `speak`, sound-based matching (homophones, numbers), "almost",
 * the article rule with a form hint, and "copy it out" (entries with `write`).
 * npm run deck:test-speak. Node 24+ (runs .ts directly). No audio: the browser
 * voice stands in for it.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';

const word = { tg: 'вожа', ru: 'слово', en: 'word' };
const phrase = { tg: 'ибора', ru: 'фраза', en: 'phrase' };
const number = { tg: 'адад', ru: 'число', en: 'number' };

const deck = {
  format: 'mana-deck',
  version: 1,
  id: 'fr-test-speak-01',
  revision: 4,
  language: 'fr-FR',
  tags: { word, phrase, number },
  entries: [
    {
      id: 'le-nom',
      text: 'le nom',
      ipa: 'lə nɔ̃',
      meaning: { tg: 'насаб', ru: 'фамилия', en: 'surname' },
      hint: { tg: 'бо артикл', ru: 'с артиклем', en: 'with the article' },
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
      skills: ['speak'],
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
      meaning: { tg: 'ӯ танҳост (зан)', ru: 'она одна', en: 'she is alone' },
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
      form: { determiner: 'definite' },
      tags: ['word'],
      skills: ['speak'],
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
  ],
};

const zip = new JSZip();
zip.file('deck.json', JSON.stringify(deck, null, 2));
await mkdir(new URL('../decks/', import.meta.url), { recursive: true });
const out = new URL('../decks/test-speak.zip', import.meta.url);
await writeFile(out, await zip.generateAsync({ type: 'nodebuffer' }));
console.log('decks/test-speak.zip готов.');
