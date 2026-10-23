/**
 * The messages of the deck check and of the report copied to an AI (R33 item 15): Russian by
 * design, the learner pastes them into a chat. Only this table, no logic: the scanner lists the
 * file in DATA_FILES for that reason (CLAUDE.md, "Cyrillic in code"). Parameters arrive already
 * formatted by the caller (quoted with q(), joined with list()).
 */
export const M = {
  genderM: 'мужской',
  genderF: 'женский',
  genderN: 'средний',
  typeList: 'список',
  typeString: 'строка',
  typeNumber: 'число',
  typeObject: 'объект',
  jsonPosition: (line: unknown, col: unknown) =>
    ` (строка ${line}, символ ${col})`,
  jsonInvalid: (deckJson: unknown, where: unknown, raw: unknown) =>
    `${deckJson}: это не правильный JSON${where}. Частые причины: лишняя запятая перед } или ], кавычки «ёлочки» вместо "", комментарии. Подробности: ${raw}`,
  missingField: (where: unknown) =>
    `${where}: нет обязательного поля.`,
  mustBeString: (where: unknown, v: unknown) =>
    `${where}: должна быть строка, а сейчас ${v}.`,
  emptyString: (where: unknown) =>
    `${where}: пустая строка.`,
  looksLikeHtml: (where: unknown, v: unknown) =>
    `${where}: похоже на HTML или разметку Anki (${v}). Нужен простой текст.`,
  surroundingSpaces: (where: unknown, v: unknown) =>
    `${where}: пробелы в начале или в конце (${v}).`,
  idMissing: (where: unknown) =>
    `${where}: нет обязательного поля id.`,
  idNotString: (where: unknown, v: unknown) =>
    `${where}: id должен быть строкой, а сейчас ${v}.`,
  idInvalid: (where: unknown, v: unknown) =>
    `${where}: id ${v} не подходит. Разрешены строчные латинские буквы, цифры и знаки - _ . (до 64 символов), первый символ — буква или цифра. Пример: «le-prenom».`,
  missingNamedField: (where: unknown, field: unknown, label: unknown) =>
    `${where}: нет обязательного поля ${field} (${label}).`,
  localizedNotObject: (where: unknown, field: unknown, v: unknown) =>
    `${where}: ${field} должно быть объектом с языками, например {"tg": "салом", "ru": "привет"}, а сейчас ${v}.`,
  localizedUnknownLang: (where: unknown, field: unknown, lang: unknown, uiLangs: unknown) =>
    `${where}: в ${field} язык ${lang} не поддерживается — этот текст приложение не покажет. Язык интерфейса и значений — только ${uiLangs} (ISO 639-1; не «tj», «tgk», «tg-TJ»).`,
  localizedFieldIn: (where: unknown, field: unknown, lang: unknown) =>
    `${where}, ${field} на ${lang}`,
  localizedEmpty: (where: unknown, field: unknown, uiLangs: unknown) =>
    `${where}: ${field} пустое — нужен текст хотя бы на одном языке (${uiLangs}).`,
  audioNotString: (where: unknown, v: unknown) =>
    `${where}: audio должно быть непустой строкой с путём к файлу, а сейчас ${v}.`,
  audioBackslash: (where: unknown, v: unknown) =>
    `${where}: в пути ${v} обратная косая черта. Нужна обычная: «audio/bonjour.mp3».`,
  audioWrongFolder: (where: unknown, v: unknown) =>
    `${where}: аудио должно лежать в папке audio/, например «audio/bonjour.mp3», а указано ${v}.`,
  audioBadPath: (where: unknown, v: unknown) =>
    `${where}: недопустимый путь ${v} (без «..», «.» и двойных косых).`,
  audioBadExtension: (where: unknown, v: unknown, audioExtensions: unknown) =>
    `${where}: неподдерживаемый тип аудио ${v}. Допустимы (строчными буквами): ${audioExtensions}.`,
  skillsMissing: (where: unknown) =>
    `${where}: нет обязательного поля skills (навыки), например ["listen", "speak", "write"].`,
  skillsNotList: (where: unknown, v: unknown) =>
    `${where}: skills должно быть списком, например ["listen", "speak"], а сейчас ${v}.`,
  skillsEmpty: (where: unknown, skills: unknown) =>
    `${where}: skills пустой — нужен хотя бы один навык (${skills}).`,
  skillUnknown: (where: unknown, s: unknown, skills: unknown) =>
    `${where}: неизвестный навык ${s}. Допустимы: ${skills}.`,
  skillDuplicate: (where: unknown, s: unknown) =>
    `${where}: навык ${s} указан дважды.`,
  tagCodeRule: 'строчные латинские буквы, цифры и знаки - _ . (до 64 символов), например «word»',
  tagsNotList: (where: unknown, v: unknown) =>
    `${where}: tags должно быть списком кодов тегов, например ["word"], а сейчас ${v}.`,
  tagCodeNotString: (where: unknown, t: unknown) =>
    `${where}: код тега должен быть строкой, а сейчас ${t}.`,
  tagCodeInvalid: (where: unknown, t: unknown, tagCodeRule: unknown) =>
    `${where}: код тега ${t} не подходит: ${tagCodeRule}. Название тега пишется в словаре tags колоды.`,
  tagDuplicate: (where: unknown, t: unknown) =>
    `${where}: тег ${t} указан дважды.`,
  tagDictNotObject: (v: unknown) =>
    `Колода: tags должно быть словарём тегов, например {"word": {"tg": "вожа", "ru": "слово", "en": "word"}}, а сейчас ${v}.`,
  tagDictCodeInvalid: (q: unknown, tagCodeRule: unknown) =>
    `Колода, словарь tags: код тега ${q} не подходит: ${tagCodeRule}.`,
  tagWhere: (q: unknown) =>
    `Тег ${q}`,
  labelTagName: 'название тега',
  genderInvalid: (where: unknown, label: unknown, v: unknown) =>
    `${where}: ${label} ${v} не подходит. Допустимо "m" (мужской), "f" (женский), "n" (средний); если рода нет, поле не пишите.`,
  genderNotInLanguage: (where: unknown, lang: unknown, v: unknown, v2: unknown, genders: unknown) =>
    `${where}: в языке ${lang} нет рода ${v} (${v2}). Допустимо: ${genders}.`,
  formNotObject: (where: unknown, v: unknown) =>
    `${where}: form должно быть объектом, например {"determiner": "definite"}, а сейчас ${v}.`,
  formEmpty: (where: unknown) =>
    `${where}: form пустое — укажите determiner, gender или number, или уберите поле.`,
  formDeterminerInvalid: (where: unknown, determiner: unknown) =>
    `${where}: form.determiner ${determiner} не подходит. Допустимо "definite" (определённая форма) или "indefinite" (неопределённая).`,
  formNumberInvalid: (where: unknown, number: unknown) =>
    `${where}: form.number ${number} не подходит. Допустимо "singular" (единственное число) или "plural" (множественное).`,
  formUnknownKey: (where: unknown, key: unknown, formKeys: unknown) =>
    `${where}: неизвестное поле form.${key} — будет пропущено. Допустимы: ${formKeys}.`,
  entryWhere: (i: unknown) =>
    `Запись ${i}`,
  entryNotObject: (where: unknown, v: unknown) =>
    `${where}: должна быть объектом { ... }, а сейчас ${v}.`,
  entryRenamedFr: (where: unknown) =>
    `${where}: поле fr переименовано в text — переименуйте его.`,
  entryTextWhere: (where: unknown) =>
    `${where}, поле text (текст на изучаемом языке)`,
  entryIpaWhere: (where: unknown) =>
    `${where}, поле ipa`,
  ipaBrackets: (where: unknown, ipa: unknown) =>
    `${where}: IPA пишется без скобок [ ] и косых / / — приложение добавит их само. Сейчас: ${ipa}.`,
  ipaMissing: (where: unknown) =>
    `${where}: нет IPA (произношения).`,
  labelMeaning: 'значение',
  labelHint: 'подсказка до ответа',
  labelNote: 'заметка после ответа',
  entrySpeechWhere: (where: unknown) =>
    `${where}, поле speech (текст для голоса браузера)`,
  speechSameAsText: (where: unknown) =>
    `${where}: speech совпадает с text — поле не нужно, голос браузера и так читает text.`,
  labelGender: 'род',
  determinerMoved: (where: unknown, determiner: unknown) =>
    `${where}: поле determiner перенесено в form — напишите "form": {"determiner": ${determiner}}.`,
  determinerNoGender: (where: unknown) =>
    `${where}: указан form.determiner, но нет gender — у существительного обычно есть род.`,
  packedForms: (where: unknown, q: unknown) =>
    `${where}: в text есть «(» или «/» (${q}). У записи один правильный ответ: каждую форму дайте отдельной записью, а форму укажите в form. Пример: «ravi(e)» → «ravi» с "form": {"gender": "m"} и «ravie» с "form": {"gender": "f"}.`,
  entryUnknownKey: (where: unknown, key: unknown) =>
    `${where}: неизвестное поле ${key} — будет пропущено.`,
  languageMissing: 'Нет поля language (изучаемый язык), например "language": "fr-FR".',
  languageBadTag: (v: unknown) =>
    `Поле language: ${v} — не код языка BCP-47. Примеры: "fr-FR", "en-GB", "de-DE", "lb-LU".`,
  languageUnsupported: (v: unknown, l: unknown) =>
    `Язык ${v} пока не поддерживается приложением. Поддерживаются: ${l}.`,
  sameSound: (i: unknown, i2: unknown, x: unknown, y: unknown, voiceSkills: unknown) =>
    `Записи ${i} и ${i2} звучат одинаково (${x} и ${y}), и у обеих есть ${voiceSkills}: ` +
          'по звучанию их не различить. Оставьте speak и listen только у одной записи, write — у обеих.',
  deckNotObject: (deckJson: unknown, value: unknown) =>
    `${deckJson}: в начале файла должен быть объект { ... }, а сейчас ${value}.`,
  formatLegacy: (legacyDeckFormat: unknown, deckFormat: unknown) =>
    `Поле format: ${legacyDeckFormat} — прежний идентификатор. Замените на ${deckFormat}; пока колода принимается.`,
  formatMissing: (deckFormat: unknown) =>
    `Нет поля format. Нужно "format": "${deckFormat}".`,
  formatWrong: (deckFormat: unknown, format: unknown) =>
    `Поле format: ожидается ${deckFormat}, а указано ${format}. Это не колода «Маны».`,
  versionMissing: (deckVersion: unknown) =>
    `Нет поля version. Нужно "version": ${deckVersion}.`,
  versionNotInteger: (deckVersion: unknown, version: unknown) =>
    `Поле version должно быть целым числом (${deckVersion}), а сейчас ${version}.`,
  versionNewer: (version: unknown, deckVersion: unknown) =>
    `Версия формата ${version} новее, чем понимает приложение (${deckVersion}). Обновите приложение.`,
  versionUnsupported: (version: unknown, deckVersion: unknown) =>
    `Версия формата ${version} не поддерживается. Поддерживается версия ${deckVersion}.`,
  deckWhere: 'Колода',
  revisionMissing: 'Нет поля revision (номер редакции колоды). У первой редакции "revision": 1.',
  revisionInvalid: (revision: unknown) =>
    `Поле revision должно быть целым числом от 1, а сейчас ${revision}.`,
  titleMissing: 'Колода: нет поля title (название на языках интерфейса, например {"tg": "Фаронсавӣ · Дарси 1", "ru": "Французский · Урок 1"}) — ' +
        'название возьмётся из имени ZIP-файла, а Chrome при повторном скачивании дописывает к нему «-1» (Р30).',
  labelDeckTitle: 'название колоды',
  deckKeyUnused: (key: unknown) =>
    `Колода: поле ${key} не используется. Поле будет пропущено.`,
  deckKeyUnknown: (key: unknown) =>
    `Колода: неизвестное поле ${key} — будет пропущено.`,
  entriesMissing: 'Нет поля entries (список записей).',
  entriesNotList: (entries: unknown) =>
    `Поле entries должно быть списком [ ... ], а сейчас ${entries}.`,
  entriesEmpty: 'Список entries пуст — в колоде нет ни одной записи.',
  entryIdDuplicate: (i: unknown, id: unknown, first: unknown) =>
    `Запись ${i}: id ${id} уже есть у записи ${first}. id должны быть разными.`,
  entryTextDuplicate: (i: unknown, e: unknown, first: unknown) =>
    `Запись ${i}: тот же текст ${e}, что у записи ${first}.`,
  entryAudioDuplicate: (i: unknown, audio: unknown, first: unknown) =>
    `Запись ${i}: файл ${audio} уже используется в записи ${first}.`,
  tagUndescribed: (t: unknown, shown: unknown) =>
    `Тег ${t} не описан в словаре tags колоды (записи ${shown}) — приложение покажет код вместо названия.`,
  tagUnused: (t: unknown) =>
    `Тег ${t} описан в словаре tags, но не используется ни одной записью.`,
  meaningMissingSome: (l: unknown, missing: unknown, entries: unknown) =>
    `Значение на ${l} есть не у всех записей: не хватает у ${missing} из ${entries}. Для них приложение покажет другой язык.`,
  unitMb: ' МБ',
  listenTail: ' Карточки listen для них — голосом браузера, если голос проверен на устройстве (Р33 п. 14).',
  noAudioAtAll: (tail: unknown) =>
    `В колоде нет звука: записи прозвучат голосом браузера.${tail}`,
  noAudioSome: (without: unknown, items: unknown, shown: unknown, tail: unknown) =>
    `Нет audio у ${without} из ${items} записей (записи ${shown}) — они прозвучат голосом браузера. Если звук для них есть, добавьте файлы.${tail}`,
  jsonOnlyNoArchive: (deckJson: unknown, declared: unknown) =>
    `Загружен только ${deckJson}, без архива: файлы audio (${declared}) не приложены. Чтобы добавить звук, соберите ZIP с папкой audio/.`,
  jsonInFolder: (deckJson: unknown, nested: unknown) =>
    `${deckJson} лежит в папке (${nested}), а должен — в корне архива. Заархивируйте содержимое папки, а не саму папку.`,
  jsonMissing: (deckJson: unknown) =>
    `В архиве нет файла ${deckJson}.`,
  audioCaseMismatch: (i: unknown, audio: unknown, near: unknown) =>
    `Запись ${i}: файла ${audio} нет, но есть ${near} — регистр букв должен совпадать.`,
  audioMissingInArchive: (i: unknown, audio: unknown) =>
    `Запись ${i}: файла ${audio} нет в архиве.`,
  fileUnused: (p: unknown) =>
    `Файл ${p} не используется ни одной записью.`,
  fileExtra: (p: unknown, deckJson: unknown) =>
    `Лишний файл ${p} — будет пропущен (нужны только ${deckJson} и папка audio/).`,
  archiveLarge: (archiveBytes: unknown, largeArchiveBytes: unknown) =>
    `Архив большой: ${archiveBytes} (порог ${largeArchiveBytes}). ` +
        `Он долго скачивается на телефон и занимает место.`,
  archiveLargeWav: (wav: unknown) =>
    ` WAV-файлов: ${wav} — в MP3 они станут в 5–10 раз меньше.`,
  entryLabel: (i: unknown, e: unknown) =>
    `Запись ${i} ${e}`,
  sameMeaningInDeck: (i: unknown, i2: unknown, x: unknown, y: unknown, lang: unknown, lang2: unknown) =>
    `Записи ${i} и ${i2} (${x}, ${y}): одинаковое значение (${lang}) ${lang2}, ` +
          'а form и hint их не различают — у карточки два правильных ответа. Разведите значения или добавьте hint / form (Р28).',
  grammarMark: (e: unknown, field: unknown, l: unknown, s: unknown) =>
    `${e}: в ${field}.${l} ${s} грамматика текстом — род и форму указывайте в form (Р28).`,
  tgGlossaryTerm: (i: unknown, field: unknown, word: unknown, tg: unknown, use: unknown) =>
    `Запись ${i}: в ${field}.tg слово ${word} (${tg}) — по глоссарию: ${use}. Грамматику указывайте в form, не текстом.`,
  addressInformal: (e: unknown) =>
    `${e}: обращение на «ты» — в конце en-значения нужна пометка «(informal)».`,
  addressFormal: (e: unknown) =>
    `${e}: обращение на «вы» — в конце en-значения нужна пометка «(formal)».`,
  articleNoDeterminer: (e: unknown) =>
    `${e}: слово с артиклем без form.determiner — неясно, какой артикль нужен в ответе (Р14, Р28).`,
  nounNoWrite: (e: unknown) =>
    `${e}: существительное с артиклем без write — род нигде не проверяется (Р23 п. 4, Р28).`,
  pronounNoGender: (e: unknown, first: unknown) =>
    `${e}: подлежащее ${first} — нужен form.gender: в значении (например, tg «ӯ», «онҳо») род не виден (Р28).`,
  numberNoGender: (e: unknown) =>
    `${e}: число с родом — нужен form.gender (Р28).`,
  otherGenderForm: (e: unknown, other: unknown) =>
    `${e}: есть форма другого рода (${other}) — у обеих записей нужен form.gender (Р16, Р28).`,
  otherDeckWhere: (name: unknown, i: unknown) =>
    `в колоде ${name} (запись ${i})`,
  duplicateInOtherDeck: (i: unknown, x: unknown, where: unknown) =>
    `К2. Запись ${i} ${x} уже есть ${where}`,
  duplicateSameMeaning: (lang: unknown, lang2: unknown) =>
    `, и значение то же (${lang}) ${lang2}`,
  duplicateTail: ' — она будет учиться дважды. Уберите повтор или, если он нужен намеренно, скажите об этом автору (Р28).',
  sameMeaningOtherDeck: (i: unknown, x: unknown, lang: unknown, lang2: unknown, y: unknown, where: unknown) =>
    `К1. Запись ${i} ${x}: то же значение (${lang}) ${lang2}, что у ${y} ${where}, ` +
            'а form и hint их не различают — у карточки два правильных ответа. Разведите значения или добавьте hint / form хотя бы одной из записей (Р28).',
  or: ' или ',
  whatDeckId: (deckId: unknown) => `колоды ${deckId}`,
  whatDeckIdRevision: (deckId: unknown, revision: unknown) => `колоды ${deckId}, редакция ${revision}`,
  elisionNeedsPair: (where: unknown, article: unknown, articles: unknown, rest: unknown) =>
    `${where}: род по артиклю ${article} не виден — нужна вторая запись с неопределённым артиклем ` +
    `(${articles} + ${rest}) и с write (Р23 п. 4, Р28).`,
  whatDeck: 'колоды',
  reportHeader: (what: unknown, errors: unknown, warnings: unknown, notes: unknown) =>
    `Проверка ${what} в приложении «Мана»: ошибок ${errors}, предупреждений ${warnings}, сведений ${notes}.`,
  sectionErrors: 'ОШИБКИ (колода не принимается):',
  sectionWarnings: 'ПРЕДУПРЕЖДЕНИЯ (колода принимается, но их нужно исправить):',
  sectionNotes: 'СВЕДЕНИЯ (исправлять не нужно):',
  fixInstructions: 'Исправь каждую ошибку и каждое предупреждение, не меняя id колоды и id существующих записей; увеличь revision на 1. ' +
        'К1 (то же значение, что в установленной колоде, у другого ответа) — разведи значения или добавь hint / form. ' +
        'К2 (запись уже есть в установленной колоде) — убери повтор; если он нужен намеренно, скажи об этом отдельной строкой. ' +
        'Верни deck.json целиком одним блоком ```json.',
  noIssues: 'Ошибок и предупреждений нет.',
  installedHeading: 'УСТАНОВЛЕННЫЕ КОЛОДЫ УЧЕНИКА. Не повторяй эти записи (тот же text с той же form). ' +
      'Значение новой записи не должно совпадать со значением записи отсюда с другим ответом, если их не различают form или hint. ' +
      'id новой колоды должен отличаться от этих id.',
  installedNone: 'Установленных колод нет.',
  zipNotOpened: (fileName: unknown) =>
    `Файл «${fileName}» не открывается как ZIP-архив.`,
};
