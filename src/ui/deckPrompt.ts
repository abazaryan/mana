/**
 * The instructions for an AI that makes a personal deck (Р33 п. 15): the user copies
 * them from the app into a chat with an AI. The rules follow docs/DECK_PROMPT.md (the
 * admin version, with `npm run deck:check`) without commands or repository files:
 * audio is optional, the check report comes from the app, personal deck ids start with
 * `my-`. Rules in Russian and English (an AI reads either); the task template the user
 * fills in — in the interface language (tg — draft for the owner).
 *
 * When a rule changes in docs/DECK_PROMPT.md, change it here too.
 */
import type { Lang } from './strings';

const RULES_RU = `Ты готовишь личную колоду для приложения «Мана» — карточки для изучения языка с ответом голосом. Ученик видит значение на родном языке и говорит или пишет на изучаемом языке; или слышит фразу и повторяет её. Уровень — A1–A2, если в задании не сказано иное.

ЧТО ВЕРНУТЬ
1. Файл deck.json — один блок \`\`\`json без комментариев.
2. Только если в задании сказано, что звук будет: таблица «файл | текст для озвучки» по всем записям, в том же порядке.
Больше ничего, кроме коротких замечаний о спорных местах (если есть) после JSON.

ФОРМАТ deck.json (строго, лишних полей не добавлять)
{
  "format": "mana-deck",
  "version": 1,
  "id": "my-fr-family-01",
  "revision": 1,
  "language": "fr-FR",
  "title": { "tg": "Оила", "ru": "Семья" },
  "tags": {
    "word": { "tg": "вожа", "ru": "слово" },
    "phrase": { "tg": "ибора", "ru": "фраза" },
    "number": { "tg": "адад", "ru": "число" }
  },
  "entries": [
    {
      "id": "le-frere",
      "text": "le frère",
      "ipa": "lə fʁɛʁ",
      "meaning": { "tg": "бародар", "ru": "брат" },
      "gender": "m",
      "form": { "determiner": "definite" },
      "tags": ["word"],
      "skills": ["listen", "speak", "write"]
    },
    {
      "id": "un-frere",
      "text": "un frère",
      "ipa": "ɛ̃ fʁɛʁ",
      "meaning": { "tg": "бародар", "ru": "брат" },
      "gender": "m",
      "form": { "determiner": "indefinite" },
      "tags": ["word"],
      "skills": ["listen", "speak", "write"]
    }
  ]
}

ПОЛЯ КОЛОДЫ
- id: начинается с "my-" (это личная колода), дальше строчные латинские буквы, цифры и дефис, до 64 символов: my-<язык>-<тема>-<номер> — "my-fr-family-01". id должен отличаться от id всех колод ученика. Если id дан в задании — используй его. Если тебе дали прежнюю версию колоды — id НЕ МЕНЯЙ.
- revision: 1 для новой колоды. Если тебе дали прежнюю версию колоды — увеличь на 1.
- language: код изучаемого языка BCP-47 из задания (сейчас приложение принимает только fr-FR).
- title: название колоды, которое увидит ученик, — на всех языках значений из задания.
- tags: словарь тегов — код → название на тех же языках, что и значения. Описывай каждый код, который встречается в записях, и только их.

ПОЛЯ ЗАПИСИ
- id: из текста записи: без акцентов, пробелы и апострофы → дефис ("je m'appelle" → "je-m-appelle"). Все id записей разные. В прежней версии колоды id существующих записей НЕ МЕНЯЙ, даже если исправляешь текст.
- text: текст на изучаемом языке — единственный правильный ответ. Обычная орфография и пунктуация языка, апостроф прямой ('), без HTML. Предложения — с заглавной буквы и точкой; отдельные слова — со строчной и без точки.
- ipa: произношение в IPA, без скобок [ ] и косых / /. Связывание отмечай ‿.
- meaning: значение. Языки — только те, что указаны в задании (из tg, ru, en). У всех записей одни и те же языки.
  - tg — таджикский, кириллица, с буквами ғ ӣ қ ӯ ҳ ҷ. Естественный современный таджикский, не дословный перевод.
  - Числа — цифрами: "meaning": { "tg": "5", "ru": "5" }.
  - tu → tg «ту», ru «ты»; vous → tg «шумо», ru «вы» (и глагол в той же форме). В en «you» не различает tu и vous — добавь в конце en-значения «(informal)» для tu или «(formal)» для vous.
- hint (необязательно): короткая подсказка ДО ответа, которая уточняет, какой ответ нужен: { "ru": "вежливо" }. Не подсказывай сам ответ. Про форму (артикль, род, число) в hint не пиши — для этого есть form.
- note (необязательно): пояснение ПОСЛЕ ответа, одно-два коротких предложения. Те же языки, что в meaning.
- audio: только если в задании сказано, что звук будет: "audio/<id записи>.mp3" (или .wav). Если звука нет — поля audio не пиши вовсе: приложение прочитает запись голосом браузера.
- gender: род самого слова, только для существительных: "m" или "f" (во французском нет "n"). Ученик видит его только при знакомстве.
- form (необязательно): какая форма нужна в ответе; ученик видит это ДО ответа. Объект с одним-тремя полями:
  - determiner: "definite" (le, la, l', les) или "indefinite" (un, une, des) — для существительных с артиклем;
  - gender: род нужного ответа ("m", "f"). ОБЯЗАТЕЛЕН у слов с изменяемым родом (ami / amie, ravi / ravie), даже если в колоде одна форма; у фраз с il / elle / ils / elles (кроме безличных: il y a, il faut, il pleut, il fait…); у чисел un / une;
  - number: "singular" или "plural", когда одно значение даёт ответы разного числа.
- tags: 1–2 кода: "word" (слово, в том числе существительное с артиклем), "phrase" (фраза или предложение), "number" (число); вторым — тема урока (свой код с описанием в tags колоды).
- skills: навыки:
  - "listen" — услышать и повторить — у всех записей, кроме второй из пары форм, которые звучат одинаково;
  - "speak" — увидеть значение и сказать — у всех записей, кроме второй из пары форм, которые звучат одинаково;
  - "write" — увидеть значение и написать — у слов и коротких выражений (до 3–4 слов).

СУЩЕСТВИТЕЛЬНЫЕ: ДВЕ ФОРМЫ — ДВЕ ЗАПИСИ
- Существительное на l' — ОБЯЗАТЕЛЬНО две записи: "l'ami" и "un ami"; у обеих есть "write". Остальные существительные — тоже лучше двумя записями ("le frère" и "un frère"). meaning одинаковое, различаются text, id, ipa и form.determiner. Сначала определённая, потом неопределённая.
- У каждого существительного с form.determiner есть "write"; gender у обеих записей один.
- Существительное без артикля ("monsieur") — одна запись, без form.

ФОРМЫ: КАЖДАЯ ФОРМА — ОТДЕЛЬНАЯ ЗАПИСЬ
- В text НИКОГДА не пиши скобки и косую черту для нескольких ответов: ни "ravi(e)", ни "étudiant/étudiante". Вместо этого — отдельные записи с form.
- Вежливая и простая формулировки (vous / tu) — разные записи, различие — в hint.
- Формы, которые звучат одинаково (одинаковое ipa: ravi / ravie, ami / amie), — "speak" и "listen" только у первой записи, "write" у обеих. Звучат по-разному (petit / petite) — "speak" и "listen" у обеих.

ГЛАВНЫЙ ПРИНЦИП
- Значение + form + hint (то, что ученик видит ДО ответа) определяют РОВНО ОДИН правильный ответ. Если ученик может честно ответить иначе и получит «неверно» — запись неоднозначна, исправь её.
- Одно значение — один ответ. У синонимов — разные значения (bonjour «добрый день», salut «привет», ciao «пока») или hint. Частые группы синонимов французского — бери значения и hint из таблицы:
| fr | tg | ru | en | hint |
| --- | --- | --- | --- | --- |
| bonjour | Рӯз ба хайр | Добрый день | Good day | — |
| bonsoir | Шом ба хайр | Добрый вечер | Good evening | — |
| bonne nuit | Шаб ба хайр | Спокойной ночи | Good night | — |
| salut (greeting) | Салом | Привет | Hi | tg «ҳангоми вохӯрӣ», ru «при встрече», en «when meeting» |
| salut (leaving) | Салом | Пока | Bye | tg «ҳангоми рафтан», ru «при прощании», en «when leaving» |
| au revoir | Худоҳофиз | До свидания | Goodbye | — |
| à bientôt | То дидор | До скорого | See you soon | tg «ба зудӣ», ru «скоро увидимся», en «soon» |
| ciao | Хайр | Пока | Bye | tg «итолиёӣ, байналмилалӣ», ru «итал., интернац.», en «Italian, international» |
| à plus tard | То баъд | Увидимся позже | See you later | — |
| à tout à l'heure | То пас аз лаҳзае | Увидимся чуть позже | See you in a while | — |
| merci | Ташаккур | Спасибо | Thank you | — |
- Грамматика (определённость, род, число) — ТОЛЬКО в form, никогда текстом в meaning, hint или note («(м.)», «(мард)», «с артиклем»).
- Таджикский текст — персидский язык Ирана в таджикской кириллице: артикль — шиносвожа (не «артикл»), слово — вожа, фраза — ибора. Лучше вообще не писать грамматику текстом.

УЖЕ УСТАНОВЛЕННЫЕ КОЛОДЫ
- Не повторяй записи из списка «Уже установленные колоды» в задании (тот же text с той же form). Намеренный повтор назови отдельной строкой.
- Значение новой записи не должно совпадать со значением записи оттуда с другим ответом, если их не различают form или hint.

ПРОВЕРЬ ПЕРЕД ОТВЕТОМ
- Каждая запись: значение + form + hint допускают ровно один ответ.
- form.gender есть у слов с изменяемым родом, у фраз с il / elle / ils / elles, у un / une; у существительных с артиклем — gender и form.determiner, и есть вторая запись с другой формой.
- Нет грамматики текстом; tu / vous помечены в en.
- JSON корректен: двойные кавычки, нет запятой после последнего элемента, нет комментариев.
- format = "mana-deck", version = 1, id начинается с "my-", есть revision, language и title.
- Все id разные; если audio есть — "audio/" + id + "." + формат.
- Каждый код тега описан в tags; в meaning, hint, note и названиях тегов — одни и те же языки.

ЕСЛИ ТЕБЕ ПРИСЛАЛИ ОТЧЁТ ПРОВЕРКИ ИЗ ПРИЛОЖЕНИЯ «МАНА»
- Исправь каждую ошибку и каждое предупреждение, не меняя id колоды и id существующих записей, увеличь revision и верни deck.json целиком. «Сведения» исправлять не нужно.
- К1 (то же значение, что в установленной колоде, у другого ответа) — разведи значения или добавь hint / form. К2 (запись уже есть в установленной колоде) — убери повтор или скажи, что он намеренный.`;

const RULES_EN = `You are preparing a personal deck for the app "Mana" — flashcards for learning a language with spoken answers. The learner sees a meaning in their own language and says or types the answer in the language being learned, or hears a phrase and repeats it. Level A1–A2 unless the task says otherwise.

WHAT TO RETURN
1. The file deck.json — one \`\`\`json block without comments.
2. Only if the task says there will be audio: a table "file | text to record" for all entries, in the same order.
Nothing else, apart from short remarks on doubtful points (if any) after the JSON.

deck.json FORMAT (strictly, no extra fields)
{
  "format": "mana-deck",
  "version": 1,
  "id": "my-fr-family-01",
  "revision": 1,
  "language": "fr-FR",
  "title": { "en": "Family" },
  "tags": {
    "word": { "en": "word" },
    "phrase": { "en": "phrase" },
    "number": { "en": "number" }
  },
  "entries": [
    {
      "id": "le-frere",
      "text": "le frère",
      "ipa": "lə fʁɛʁ",
      "meaning": { "en": "brother" },
      "gender": "m",
      "form": { "determiner": "definite" },
      "tags": ["word"],
      "skills": ["listen", "speak", "write"]
    },
    {
      "id": "un-frere",
      "text": "un frère",
      "ipa": "ɛ̃ fʁɛʁ",
      "meaning": { "en": "brother" },
      "gender": "m",
      "form": { "determiner": "indefinite" },
      "tags": ["word"],
      "skills": ["listen", "speak", "write"]
    }
  ]
}

DECK FIELDS
- id: starts with "my-" (a personal deck), then lower-case Latin letters, digits and hyphens, up to 64 characters: my-<language>-<topic>-<number> — "my-fr-family-01". It must differ from the ids of all the learner's decks. If the task gives an id, use it. If you were given an earlier version of the deck, do NOT change the id.
- revision: 1 for a new deck; for an earlier version, add 1.
- language: the BCP-47 code of the language being learned (the app accepts only fr-FR for now).
- title: the deck name the learner sees, in every meaning language of the task.
- tags: a dictionary of tags — code → name in the meaning languages. Describe every code used by the entries, and only those.

ENTRY FIELDS
- id: from the entry text, without accents, spaces and apostrophes → hyphen ("je m'appelle" → "je-m-appelle"). All entry ids differ. In an earlier version of the deck do NOT change the ids of existing entries, even when fixing the text.
- text: the text in the language being learned — the only correct answer. Normal spelling and punctuation, straight apostrophe ('), no HTML. Sentences start with a capital letter and end with a full stop; single words — lower case, no full stop.
- ipa: pronunciation in IPA, without [ ] or / /. Mark liaison with ‿.
- meaning: the meaning, only in the languages of the task (tg, ru, en). All entries use the same languages.
  - tg — Tajik in Cyrillic with ғ ӣ қ ӯ ҳ ҷ; natural modern Tajik, not word-for-word.
  - Numbers as digits: "meaning": { "en": "5" }.
  - tu → tg «ту», ru «ты»; vous → tg «шумо», ru «вы». English "you" does not tell tu from vous: end the en meaning with "(informal)" for tu or "(formal)" for vous.
- hint (optional): a short hint shown BEFORE the answer that says which answer is wanted: { "en": "politely" }. Do not give away the answer. Nothing about the form (article, gender, number) — that is what form is for.
- note (optional): an explanation shown AFTER the answer, one or two short sentences, same languages as meaning.
- audio: only if the task says there will be audio: "audio/<entry id>.mp3" (or .wav). Without audio, leave the field out entirely: the app reads the entry in the browser voice.
- gender: the gender of the word itself, nouns only: "m" or "f" (French has no "n"). Shown only at the introduction.
- form (optional): which form the answer needs, shown BEFORE the answer. An object with one to three fields:
  - determiner: "definite" (le, la, l', les) or "indefinite" (un, une, des) — for nouns with an article;
  - gender: the gender of the wanted answer ("m", "f"). REQUIRED for words whose gender changes (ami / amie, ravi / ravie), even if the deck has one form; for phrases with il / elle / ils / elles (except impersonal ones: il y a, il faut, il pleut, il fait…); for the numbers un / une;
  - number: "singular" or "plural" when one meaning gives answers of different number.
- tags: 1–2 codes: "word" (a word, including a noun with its article), "phrase" (a phrase or sentence), "number" (a number); a second one — the topic (own code described in the deck tags).
- skills:
  - "listen" — hear and repeat — every entry, except the second of a pair of forms that sound the same;
  - "speak" — see the meaning and say it — every entry, except the second of a pair of forms that sound the same;
  - "write" — see the meaning and type it — words and short expressions (up to 3–4 words).

NOUNS: TWO FORMS — TWO ENTRIES
- A noun with l' — ALWAYS two entries: "l'ami" and "un ami"; both have "write". Other nouns — better two entries as well ("le frère" and "un frère"). Same meaning; text, id, ipa and form.determiner differ. Definite first, then indefinite.
- Every noun with form.determiner has "write"; both entries have the same gender.
- A noun without an article ("monsieur") — one entry, no form.

FORMS: EVERY FORM IS A SEPARATE ENTRY
- NEVER write brackets or a slash for several answers in text: not "ravi(e)", not "étudiant/étudiante". Make separate entries with form instead.
- Polite and plain wording (vous / tu) — separate entries, told apart by hint.
- Forms that sound the same (same ipa: ravi / ravie, ami / amie) — "speak" and "listen" only on the first entry, "write" on both. Forms that sound different (petit / petite) — "speak" and "listen" on both.

THE MAIN PRINCIPLE
- Meaning + form + hint (what the learner sees BEFORE answering) allow EXACTLY ONE correct answer. If the learner could honestly answer differently and be marked wrong, the entry is ambiguous — fix it.
- One meaning — one answer. Synonyms get different meanings (bonjour "good day", salut "hi", ciao "bye") or a hint. For common French synonym groups take the meanings and hints from this table:
| fr | tg | ru | en | hint |
| --- | --- | --- | --- | --- |
| bonjour | Рӯз ба хайр | Добрый день | Good day | — |
| bonsoir | Шом ба хайр | Добрый вечер | Good evening | — |
| bonne nuit | Шаб ба хайр | Спокойной ночи | Good night | — |
| salut (greeting) | Салом | Привет | Hi | tg «ҳангоми вохӯрӣ», ru «при встрече», en «when meeting» |
| salut (leaving) | Салом | Пока | Bye | tg «ҳангоми рафтан», ru «при прощании», en «when leaving» |
| au revoir | Худоҳофиз | До свидания | Goodbye | — |
| à bientôt | То дидор | До скорого | See you soon | tg «ба зудӣ», ru «скоро увидимся», en «soon» |
| ciao | Хайр | Пока | Bye | tg «итолиёӣ, байналмилалӣ», ru «итал., интернац.», en «Italian, international» |
| à plus tard | То баъд | Увидимся позже | See you later | — |
| à tout à l'heure | То пас аз лаҳзае | Увидимся чуть позже | See you in a while | — |
| merci | Ташаккур | Спасибо | Thank you | — |
- Grammar (definiteness, gender, number) goes ONLY in form, never as text in meaning, hint or note ("(m.)", "with article").
- Tajik text is the Persian of Iran in Tajik Cyrillic: article — шиносвожа (not «артикл»), word — вожа, phrase — ибора. Better not to write grammar as text at all.

DECKS ALREADY INSTALLED
- Do not repeat entries from the list "Already installed decks" in the task (the same text with the same form). Name an intended repeat on a separate line.
- A new entry's meaning must not equal the meaning of an entry from there with a different answer, unless form or hint tells them apart.

CHECK BEFORE ANSWERING
- Each entry: meaning + form + hint allow exactly one answer.
- form.gender on words whose gender changes, on phrases with il / elle / ils / elles, on un / une; nouns with an article have gender and form.determiner and a second entry with the other form.
- No grammar as text; tu / vous marked in en.
- Valid JSON: double quotes, no trailing comma, no comments.
- format = "mana-deck", version = 1, id starts with "my-", revision, language and title present.
- All ids differ; if there is audio — "audio/" + id + "." + format.
- Every tag code is described in tags; meaning, hint, note and tag names use the same languages.

IF YOU RECEIVED A CHECK REPORT FROM THE MANA APP
- Fix every error and every warning without changing the deck id or the ids of existing entries, add 1 to revision and return the whole deck.json. "Notes" need no fixing.
- К1 (same meaning as an installed deck's entry with another answer) — tell the meanings apart or add hint / form. К2 (the entry is already in an installed deck) — remove the repeat or say it is intended. (The report itself is in Russian.)`;

const TASK: Record<Lang, string> = {
  tg: `СУПОРИШ (ЗАДАНИЕ)
Забони омӯзиш (язык): fr-FR
Забонҳои маъно (языки значений): tg
Садо (звук): нест
id ва номи маҷмӯа (id и название): my-fr-<мавзӯъ>-01; ном — …
Муҳтаво (содержание): <мавзӯъ, вожаҳо ё матни дарс>
Маҷмӯаҳои насбшуда (уже установленные колоды): <«Нусхаи омӯзбаргҳои насбшуда»-ро ин ҷо гузоред>`,
  ru: `ЗАДАНИЕ
Язык: fr-FR
Языки значений: ru
Звук: нет
id и название колоды: my-fr-<тема>-01; название — …
Содержание: <тема, список слов или текст урока>
Уже установленные колоды: <вставьте сюда «Установленные записи» из приложения>`,
  en: `TASK
Language: fr-FR
Meaning languages: en
Audio: none
Deck id and title: my-fr-<topic>-01; title — …
Content: <topic, word list or lesson text>
Already installed decks: <paste the "installed entries" from the app here>`,
};

/** The text the user copies into a chat with an AI. */
export function deckPromptText(lang: Lang): string {
  return `${lang === 'en' ? RULES_EN : RULES_RU}\n\n${TASK[lang]}\n`;
}
