/**
 * Interface strings in tg / ru / en (decision Р8). Tajik follows docs/GLOSSARY_TG.md
 * (approved by the user 12.10.2026); docs/I18N_TG.md is generated from this file
 * (`npm run i18n:table`) and a test keeps the two in step.
 *
 * No runtime imports: also run directly by Node in scripts/i18n-table.ts.
 * Placeholders: {name}. Counts are written as "Label: {n}" — no plural forms needed.
 */

export type Lang = 'tg' | 'ru' | 'en';
type Tr = Record<Lang, string>;

export const STRINGS = {
  // Common
  'app.name': { tg: 'Моно', ru: 'Мана', en: 'Mana' },
  'common.loading': { tg: 'Боргузорӣ…', ru: 'Загрузка…', en: 'Loading…' },
  'common.close': { tg: 'Бастан', ru: 'Закрыть', en: 'Close' },
  'common.cancel': { tg: 'Лағв', ru: 'Отмена', en: 'Cancel' },
  'common.back': { tg: 'Бозгашт', ru: 'Назад', en: 'Back' },
  'common.dbError': {
    tg: 'Пойгоҳи додаҳо кушода нашуд: {error}',
    ru: 'Не удалось открыть базу данных: {error}',
    en: 'Could not open the database: {error}',
  },

  // Navigation
  'nav.decks': { tg: 'Маҷмӯаҳо', ru: 'Колоды', en: 'Decks' },
  'nav.settings': { tg: 'Танзимот', ru: 'Настройки', en: 'Settings' },

  // Decks screen
  'decks.title': { tg: 'Маҷмӯаҳо', ru: 'Колоды', en: 'Decks' },
  'decks.empty': {
    tg: 'Ҳанӯз маҷмӯае нест. Файли ZIP-и маҷмӯаро дарунрезӣ кунед.',
    ru: 'Колод пока нет. Загрузите ZIP-файл колоды.',
    en: 'No decks yet. Import a deck ZIP file.',
  },
  'decks.import': { tg: 'Дарунрезии маҷмӯа (ZIP)', ru: 'Импорт колоды (ZIP)', en: 'Import a deck (ZIP)' },
  'decks.entries': { tg: 'Омӯзбаргҳо: {n}', ru: 'Записей: {n}', en: 'Entries: {n}' },
  'decks.revision': { tg: 'Нусха: {n}', ru: 'Редакция: {n}', en: 'Revision: {n}' },
  'decks.audio': { tg: 'Садо: {mb} МБ', ru: 'Аудио: {mb} МБ', en: 'Audio: {mb} MB' },

  // One deck
  'deck.hidden': {
    tg: 'Пинҳон: {n} — дар нусхаи нав нестанд, пешрафташон ҳифз шудааст.',
    ru: 'Скрыто: {n} — нет в новой редакции, их прогресс сохранён.',
    en: 'Hidden: {n} — not in the new revision; their progress is kept.',
  },
  'deck.play': { tg: 'Гӯш кардан', ru: 'Слушать', en: 'Play' },
  'deck.noAudio': { tg: 'Садо нест', ru: 'Нет аудио', en: 'No audio' },
  'deck.audioError': {
    tg: 'Садо пахш нашуд.',
    ru: 'Не удалось воспроизвести аудио.',
    en: 'Could not play the audio.',
  },
  'deck.notFound': { tg: 'Маҷмӯа ёфт нашуд.', ru: 'Колода не найдена.', en: 'Deck not found.' },

  // Skills (Р3)
  'skill.listen': { tg: 'шунидан', ru: 'слушать', en: 'listen' },
  'skill.speak': { tg: 'гуфтан', ru: 'говорить', en: 'speak' },
  'skill.write': { tg: 'навиштан', ru: 'писать', en: 'write' },

  // Study (stage 4.2, Р22; Tajik terms — docs/GLOSSARY_TG.md, section «Занятия»)
  'common.next': { tg: 'Баъдӣ', ru: 'Дальше', en: 'Next' },
  'study.start': { tg: 'Тамрин', ru: 'Заниматься', en: 'Study' },
  'study.progress': { tg: '{i} аз {n}', ru: '{i} из {n}', en: '{i} of {n}' },
  'study.nothing': {
    tg: 'Ҳоло чизе барои такрор нест ва омӯзбарги нав ҳам нест.',
    ru: 'Сейчас нечего повторять, и новых записей нет.',
    en: 'Nothing to review and no new entries right now.',
  },
  'study.noNew.noMaterial': {
    tg: 'Дар ин маҷмӯа омӯзбарги нав намонд.',
    ru: 'Новых записей в колоде не осталось.',
    en: 'No new entries left in this deck.',
  },
  'study.noNew.dailyLimit': {
    tg: 'Омӯзбаргҳои нави имрӯз тамом шуданд: ҳадди рӯзона — {n}.',
    ru: 'Новые записи на сегодня закончились: лимит — {n} в день.',
    en: 'No more new entries today: the limit is {n} a day.',
  },
  'study.noNew.portionFull': {
    tg: 'Ин даврро такрорҳо пур карданд; омӯзбаргҳои нав — дар даври дигар.',
    ru: 'Эту порцию заняли повторения; новые записи — в следующей.',
    en: 'Reviews filled this round; new entries come in the next one.',
  },
  'study.done': { tg: 'Давр тамом шуд', ru: 'Порция пройдена', en: 'Round done' },
  'study.more': { tg: 'Даври дигар', ru: 'Ещё порция', en: 'Another round' },
  'study.introduced': { tg: 'Ошноӣ: {n}', ru: 'Знакомств: {n}', en: 'Introductions: {n}' },
  'study.noLanguage': {
    tg: 'Барнома ҳанӯз бо забони {lang} кор намекунад.',
    ru: 'Язык {lang} пока не поддерживается.',
    en: 'The language {lang} is not supported yet.',
  },
  'study.saveError': {
    tg: 'Ҷавоб захира нашуд: {error}',
    ru: 'Ответ не сохранён: {error}',
    en: 'The answer was not saved: {error}',
  },

  // Introduction (Р3, Р22.5)
  'intro.label': { tg: 'Ошноӣ', ru: 'Знакомство', en: 'Introduction' },
  'intro.echo': { tg: 'Бо садои баланд такрор кунед', ru: 'Повторите вслух', en: 'Say it aloud' },
  'intro.copy': { tg: 'Аз рӯи намуна нависед', ru: 'Напишите по образцу', en: 'Copy it out' },
  'intro.again': { tg: 'Боз як бор', ru: 'Ещё раз', en: 'Once more' },
  'intro.skip': { tg: 'Гузаштан', ru: 'Пропустить', en: 'Skip' },

  // Speak (Р22.6)
  'speak.prompt': { tg: 'Ҷавобро гӯед', ru: 'Скажите ответ', en: 'Say the answer' },
  'speak.type': { tg: 'Навиштан', ru: 'Написать', en: 'Type' },
  'speak.typePlaceholder': { tg: 'Ҷавобро нависед', ru: 'Напишите ответ', en: 'Type the answer' },
  'speak.check': { tg: 'Санҷиш', ru: 'Проверить', en: 'Check' },
  'speak.dontKnow': { tg: 'Намедонам', ru: 'Не знаю', en: "I don't know" },

  // Microphone
  'mic.start': { tg: 'Гуфтан', ru: 'Говорить', en: 'Speak' },
  'mic.starting': { tg: 'Микрофон фаъол мешавад…', ru: 'Включаю микрофон…', en: 'Starting the microphone…' },
  'mic.listening': { tg: 'Гӯш медиҳам…', ru: 'Слушаю…', en: 'Listening…' },
  'mic.retry': { tg: 'Талоши дубора', ru: 'Повторить', en: 'Try again' },
  'mic.unsupported': {
    tg: 'Ин мурургар шинохти гуфторро надорад — ҷавобро нависед.',
    ru: 'Этот браузер не распознаёт речь — напишите ответ.',
    en: 'This browser has no speech recognition — type the answer.',
  },
  'mic.err.not-allowed': {
    tg: 'Иҷозати микрофон нест. Онро барои ин сомона иҷозат диҳед.',
    ru: 'Нет доступа к микрофону. Разрешите его для этого сайта.',
    en: 'No access to the microphone. Allow it for this site.',
  },
  'mic.err.service-not-allowed': {
    tg: 'Мурургар шинохти гуфторро иҷозат надод.',
    ru: 'Браузер не разрешил распознавание речи.',
    en: 'The browser did not allow speech recognition.',
  },
  'mic.err.audio-capture': {
    tg: 'Микрофон ёфт нашуд ё барномаи дигар онро истифода мебарад.',
    ru: 'Микрофон не найден или занят другим приложением.',
    en: 'No microphone found, or another app is using it.',
  },
  'mic.err.network': {
    tg: 'Барои шинохти гуфтор интернет лозим аст.',
    ru: 'Для распознавания речи нужен интернет.',
    en: 'Speech recognition needs the internet.',
  },
  'mic.err.no-speech': { tg: 'Гуфтор шунида нашуд.', ru: 'Речь не услышана.', en: 'No speech heard.' },
  'mic.err.no-result': { tg: 'Чизе шинохта нашуд.', ru: 'Ничего не распознано.', en: 'Nothing recognised.' },
  'mic.err.language-not-supported': {
    tg: 'Ин мурургар ин забонро намешиносад.',
    ru: 'Этот браузер не распознаёт этот язык.',
    en: 'This browser cannot recognise this language.',
  },
  'mic.err.watchdog': { tg: 'Микрофон фаъол нашуд.', ru: 'Микрофон не включился.', en: 'The microphone did not start.' },
  'mic.err.other': { tg: 'Хатои шинохти гуфтор: {code}', ru: 'Ошибка распознавания: {code}', en: 'Recognition error: {code}' },

  // Answer marks (Р22.9): the labels never promise to judge pronunciation
  'answer.heard': { tg: 'Шунида шуд:', ru: 'Услышано:', en: 'Heard:' },
  'answer.typed': { tg: 'Навишта шуд:', ru: 'Набрано:', en: 'Typed:' },
  'answer.nothing': { tg: '(ҳеҷ чиз)', ru: '(ничего)', en: '(nothing)' },
  'marks.rows.voice': {
    tg: 'Боло — шунидашуда, поён — ҷавоби дуруст',
    ru: 'Сверху — услышанное, снизу — правильный ответ',
    en: 'Top: what was heard; bottom: the right answer',
  },
  'marks.rows.typed': {
    tg: 'Боло — навиштаи шумо, поён — намуна',
    ru: 'Сверху — ваш ответ, снизу — образец',
    en: 'Top: what you typed; bottom: the model',
  },
  'mark.sound': { tg: 'аз рӯи талаффуз қабул шуд', ru: 'засчитано по звучанию', en: 'accepted by sound' },
  'mark.other': { tg: 'вожаи дигар шунида шуд', ru: 'распознано другое слово', en: 'recognised as another word' },
  'mark.otherTyped': { tg: 'вожаи дигар', ru: 'другое слово', en: 'another word' },
  'mark.unsaid': { tg: 'гуфта нашуд', ru: 'не сказано', en: 'not said' },
  'mark.extra': { tg: 'изофӣ', ru: 'лишнее', en: 'extra' },
  'mark.wrong': { tg: 'хато', ru: 'ошибка', en: 'wrong' },
  'mark.missing': { tg: 'ҷо монд', ru: 'пропущено', en: 'missing' },
  'mark.diacritic': { tg: 'танҳо аломат (é/e)', ru: 'только диакритика (é/e)', en: 'accent only (é/e)' },

  // Rating (Р4)
  'rating.1': { tg: 'Дубора', ru: 'Снова', en: 'Again' },
  'rating.2': { tg: 'Сахт', ru: 'Трудно', en: 'Hard' },
  'rating.3': { tg: 'Хуб', ru: 'Хорошо', en: 'Good' },
  'rating.4': { tg: 'Осон', ru: 'Легко', en: 'Easy' },
  'rating.suggested': { tg: 'Пешниҳод: {rating}', ru: 'Предложено: {rating}', en: 'Suggested: {rating}' },
  'rating.misrecognized': { tg: 'Нодуруст шунид', ru: 'Меня неправильно распознали', en: 'I was misrecognised' },
  'rating.lockedVoice': {
    tg: '«Дубора»-ро танҳо бо «Нодуруст шунид» метавон баланд кард.',
    ru: '«Снова» можно повысить только кнопкой «Меня неправильно распознали».',
    en: '"Again" can be raised only with "I was misrecognised".',
  },
  'rating.lockedTyped': {
    tg: 'Дар ҷавоби навиштаӣ «Дубора»-ро баланд кардан мумкин нест.',
    ru: 'При ответе текстом «Снова» повысить нельзя.',
    en: 'A typed answer rated "Again" cannot be raised.',
  },
  'reason.incorrect': { tg: 'Нодуруст', ru: 'Неверно', en: 'Incorrect' },
  'reason.almost': { tg: 'Тақрибан дуруст', ru: 'Почти', en: 'Almost' },
  'reason.correct': { tg: 'Дуруст', ru: 'Верно', en: 'Correct' },
  'reason.correct-fast': { tg: 'Дуруст ва босуръат', ru: 'Верно и быстро', en: 'Correct and fast' },
  'reason.correct-fast-twice': {
    tg: 'Дуруст ва босуръат, ду бор паёпай',
    ru: 'Верно и быстро второй раз подряд',
    en: 'Correct and fast twice in a row',
  },

  // Import
  'import.reading': { tg: 'Файл хонда мешавад…', ru: 'Читаю файл…', en: 'Reading the file…' },
  'import.rejected': { tg: 'Маҷмӯа қабул нашуд', ru: 'Колода не принята', en: 'Deck not accepted' },
  'import.authorNote': {
    tg: 'Паёмҳо ба забони русӣ — онҳо барои муаллифи маҷмӯа навишта шудаанд.',
    ru: 'Сообщения адресованы автору колоды.',
    en: 'The messages are in Russian — they are meant for the deck author.',
  },
  'import.warnings': { tg: 'Ҳушдорҳо: {n}', ru: 'Предупреждения: {n}', en: 'Warnings: {n}' },
  'import.confirmTitle': { tg: 'Таъйид лозим аст', ru: 'Нужно подтверждение', en: 'Please confirm' },
  'import.reinstall': {
    tg: 'Нусхаи {rev} қаблан насб шудааст. Дубора насб кунем? Пешрафт ва таърихчаи ҷавобҳо тағйир намеёбанд.',
    ru: 'Редакция {rev} уже установлена. Переустановить? Прогресс и журнал не изменятся.',
    en: 'Revision {rev} is already installed. Reinstall it? Progress and the journal stay as they are.',
  },
  'import.older': {
    tg: 'Шумо нусхаи {incoming}-ро дарунрезӣ мекунед, вале нусхаи {installed} насб шудааст — файли нав кӯҳнатар аст. Бо вуҷуди ин насб кунем?',
    ru: 'Загружается редакция {incoming}, а установлена {installed} — загружаемая старее. Всё равно установить?',
    en: 'You are loading revision {incoming}, but revision {installed} is installed — the file is older. Install it anyway?',
  },
  'import.different': {
    tg: 'Маҷмӯа бо ҳамин шиноса аз қабл ҳаст («{name}»), вале омӯзбаргҳо қариб мувофиқат намекунанд: муштарак {shared} аз {installed}. Шояд ин маҷмӯаи дигар бо ҳамон шиноса бошад. Агар насб кунед, омӯзбаргҳои «{name}», ки дар файли нав нестанд, пинҳон мешаванд.',
    ru: 'Колода с таким id уже установлена («{name}»), но записи почти не совпадают: общих {shared} из {installed}. Возможно, это другая колода с тем же id. Если установить, записи «{name}», которых нет в новом файле, будут скрыты.',
    en: 'A deck with this id is already installed ("{name}"), but the entries hardly match: {shared} of {installed} in common. It may be another deck with the same id. If you install it, the entries of "{name}" missing from the new file will be hidden.',
  },
  'import.languageChanged': {
    tg: 'Забони омӯзиши маҷмӯа дигар аст: {from} → {to}.',
    ru: 'У колоды другой изучаемый язык: {from} → {to}.',
    en: 'The learning language differs: {from} → {to}.',
  },
  'import.install': { tg: 'Насб', ru: 'Установить', en: 'Install' },
  'import.installed': { tg: 'Маҷмӯа насб шуд', ru: 'Колода установлена', en: 'Deck installed' },
  'import.updated': { tg: 'Маҷмӯа барӯзрасонӣ шуд', ru: 'Колода обновлена', en: 'Deck updated' },
  'import.summary': {
    tg: 'Нав: {added} · барӯзшуда: {updated} · пинҳоншуда: {hidden} · баргашта: {restored}',
    ru: 'Новых: {added} · обновлено: {updated} · скрыто: {hidden} · вернулось: {restored}',
    en: 'New: {added} · updated: {updated} · hidden: {hidden} · back: {restored}',
  },
  'import.failed': {
    tg: 'Насб нашуд: {error}',
    ru: 'Не удалось установить: {error}',
    en: 'Install failed: {error}',
  },

  // Settings
  'settings.title': { tg: 'Танзимот', ru: 'Настройки', en: 'Settings' },
  'settings.uiLang': { tg: 'Забони барнома', ru: 'Язык интерфейса', en: 'Interface language' },
  'settings.meaningLang': { tg: 'Забони маъноҳо', ru: 'Язык значений', en: 'Meaning language' },
  'settings.meaningHint': {
    tg: 'Маъно, роҳнамо ва ёддошти омӯзбаргҳо бо ин забон нишон дода мешаванд; агар бо ин забон набошад — бо забони дигари мавҷуда.',
    ru: 'Значения, подсказки и заметки записей показываются на этом языке; если его нет — на другом имеющемся.',
    en: 'Meanings, hints and notes are shown in this language; if an entry lacks it, in another available one.',
  },
  'settings.newPerDay': { tg: 'Омӯзбаргҳои нав дар як рӯз', ru: 'Новых записей в день', en: 'New entries per day' },
  'settings.prototype': {
    tg: 'Саҳифаи пешнамуна (бо таърихчаи қаблӣ)',
    ru: 'Экран прототипа (со старым журналом)',
    en: 'Prototype screen (with the old journal)',
  },

  // Backup
  'backup.title': { tg: 'Нусхаи пуштибон', ru: 'Резервная копия', en: 'Backup' },
  'backup.hint': {
    tg: 'Таърихчаи ҷавобҳо (ҳамаи пешрафт) танҳо дар ҳамин мурургар захира мешавад. Гоҳ-гоҳ онро дар файл захира кунед.',
    ru: 'Журнал ответов (весь прогресс) хранится только в этом браузере. Время от времени сохраняйте его в файл.',
    en: 'The answer journal (all your progress) lives only in this browser. Save it to a file from time to time.',
  },
  'backup.save': { tg: 'Захираи таърихча дар файл', ru: 'Сохранить журнал в файл', en: 'Save the journal to a file' },
  'backup.restore': { tg: 'Бозёбӣ аз файл', ru: 'Восстановить из файла', en: 'Restore from a file' },
  'backup.saved': { tg: 'Дар файл сабтҳо: {n}', ru: 'В файле записей: {n}', en: 'Records in the file: {n}' },
  'backup.restored': {
    tg: 'Илова шуд: {added} · қаблан буд: {skipped}',
    ru: 'Добавлено: {added} · уже было: {skipped}',
    en: 'Added: {added} · already present: {skipped}',
  },
  'backup.error.json': {
    tg: 'Ин файли таърихчаи «Моно» нест.',
    ru: 'Это не файл журнала «Маны».',
    en: 'This is not a Mana journal file.',
  },
  'backup.error.version': {
    tg: 'Файл аз нусхаи навтари барнома аст. Барномаро барӯзрасонӣ кунед.',
    ru: 'Файл из более новой версии приложения. Обновите приложение.',
    en: 'The file comes from a newer version of the app. Update the app.',
  },
  'backup.error.records': {
    tg: 'Файл осеб дидааст: баъзе сабтҳо хонда намешаванд. Ҳеҷ чиз илова нашуд.',
    ru: 'Файл повреждён: часть записей не читается. Ничего не добавлено.',
    en: 'The file is damaged: some records cannot be read. Nothing was added.',
  },
  'backup.error.otherUser': {
    tg: 'Файл ба корбари дигар тааллуқ дорад, вале дар ин ҷо аз қабл ҷавобҳои худатон ҳаст. Якҷоя кардан дар марҳилаи ҳамгомсозӣ илова мешавад.',
    ru: 'Файл другого пользователя, а здесь уже есть свои ответы. Объединение появится на этапе синхронизации.',
    en: 'The file belongs to another user, and this browser already has its own answers. Merging comes with sync.',
  },
  'backup.error.failed': { tg: 'Хато: {error}', ru: 'Ошибка: {error}', en: 'Error: {error}' },

  // Storage persistence
  'storage.title': { tg: 'Захирагоҳ', ru: 'Хранилище', en: 'Storage' },
  'storage.persisted': {
    tg: 'Доимӣ: мурургар додаҳоро худ аз худ пок намекунад.',
    ru: 'Постоянное: браузер не удалит данные сам.',
    en: 'Persistent: the browser will not clear the data on its own.',
  },
  'storage.notPersisted': {
    tg: 'Ҳангоми камбуди ҷой мурургар метавонад додаҳоро пок кунад. Нусхаи пуштибон гиред.',
    ru: 'При нехватке места браузер может удалить данные. Сохраняйте резервную копию.',
    en: 'The browser may clear the data when space runs low. Keep a backup.',
  },
  'storage.unsupported': {
    tg: 'Мурургар дар бораи захирагоҳ маълумот намедиҳад.',
    ru: 'Браузер не сообщает, как хранит данные.',
    en: 'The browser does not report how it keeps the data.',
  },
  'storage.request': {
    tg: 'Дархости захирагоҳи доимӣ',
    ru: 'Запросить постоянное хранилище',
    en: 'Request persistent storage',
  },
} satisfies Record<string, Tr>;

export type StringKey = keyof typeof STRINGS;
export type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: StringKey, vars: Vars = {}): string {
  return STRINGS[key][lang].replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m,
  );
}

/** Native language names, for the language pickers. */
export const LANG_NAMES: Record<Lang, string> = { tg: 'Тоҷикӣ', ru: 'Русский', en: 'English' };

/** First run: the language question in all three languages at once. */
export const FIRST_RUN_TITLE = 'Забонро интихоб кунед · Выберите язык · Choose a language';

export interface TableRow {
  key: string;
  tr: Tr;
}

/**
 * Strings kept outside this file, passed in so Node can run the table script:
 * form hint labels (FORM_LABELS, confirmed by the user 11.10.2026) and language names.
 */
export function tableExtras(
  formLabels: Record<string, Record<string, Tr>>,
  packs: readonly { code: string; name: Tr }[],
): { title: string; rows: TableRow[] }[] {
  return [
    {
      title: 'Подсказки формы (`FORM_LABELS` в `src/core/deckFormat.ts`, подтверждены 11.10.2026)',
      rows: Object.entries(formLabels).flatMap(([group, values]) =>
        Object.entries(values).map(([value, tr]) => ({ key: `${group}.${value}`, tr })),
      ),
    },
    {
      title: 'Изучаемые языки (`src/core/languages.ts`)',
      rows: packs.map((p) => ({ key: p.code, tr: p.name })),
    },
  ];
}

function cell(s: string): string {
  return s.replace(/\|/g, '\\|');
}

/**
 * docs/I18N_TG.md: every Tajik string next to Russian and English, for the user's check.
 * `extra` adds strings kept elsewhere (form labels, language names).
 */
export function tajikTable(extra: readonly { title: string; rows: readonly TableRow[] }[]): string {
  const sections = [
    { title: 'Интерфейс (`src/ui/strings.ts`)', rows: Object.entries(STRINGS).map(([key, tr]) => ({ key, tr })) },
    ...extra,
  ];
  const out = [
    '# Таджикские строки интерфейса — на проверку',
    '',
    'Файл создаётся командой `npm run i18n:table` из исходников; править переводы нужно в исходниках (или написать Claude, что исправить). Тест следит, чтобы файл не отставал от кода.',
    '',
    'Термины — в `docs/GLOSSARY_TG.md`. `{n}`, `{name}` и т. п. — места, куда приложение подставляет число или название.',
    '',
    `Первый запуск: «${FIRST_RUN_TITLE}». Названия языков в выборе: ${Object.values(LANG_NAMES).join(', ')}.`,
  ];
  for (const s of sections) {
    out.push('', `## ${s.title}`, '', '| Ключ | Русский | English | Тоҷикӣ |', '|---|---|---|---|');
    for (const r of s.rows) out.push(`| \`${r.key}\` | ${cell(r.tr.ru)} | ${cell(r.tr.en)} | ${cell(r.tr.tg)} |`);
  }
  return out.join('\n') + '\n';
}
