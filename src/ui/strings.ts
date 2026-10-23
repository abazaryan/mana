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
  'decks.import': { tg: 'Дарунрезии маҷмӯа (ZIP ё JSON)', ru: 'Импорт колоды (ZIP или JSON)', en: 'Import a deck (ZIP or JSON)' },
  'decks.entries': { tg: 'Омӯзбаргҳо: {n}', ru: 'Записей: {n}', en: 'Entries: {n}' },
  'decks.revision': { tg: 'Нусха: {n}', ru: 'Редакция: {n}', en: 'Revision: {n}' },
  'decks.audio': { tg: 'Садо: {mb} МБ', ru: 'Аудио: {mb} МБ', en: 'Audio: {mb} MB' },

  // One deck
  'deck.dueToday': { tg: 'Имрӯз барои такрор: {n}', ru: 'К повторению сегодня: {n}', en: 'Due today: {n}' },
  /** Appended to deck.dueToday when new cards wait today: new entries and catch-up together (19.10.2026). */
  'deck.dueNew': { tg: ' · нав: {m}', ru: ' · новых: {m}', en: ' · new: {m}' },
  'deck.overdue': {
    tg: 'Аз рӯзҳои гузашта: {n} — омӯзбаргҳои нав баъд аз онҳо',
    ru: 'С прошлых дней: {n} — новые записи после них',
    en: 'From earlier days: {n} — new entries after them',
  },
  'deck.overdueIn': {
    tg: 'Дар маҷмӯаи «{deck}» аз рӯзҳои гузашта: {n} — омӯзбаргҳои нав баъд аз онҳо',
    ru: 'В колоде «{deck}» с прошлых дней: {n} — новые записи после них',
    en: 'In “{deck}”: {n} from earlier days — new entries after them',
  },
  'deck.hidden': {
    tg: 'Пинҳон: {n} — дар нусхаи нав нестанд, пешрафташон ҳифз шудааст.',
    ru: 'Скрыто: {n} — нет в новой редакции, их прогресс сохранён.',
    en: 'Hidden: {n} — not in the new revision; their progress is kept.',
  },
  'deck.play': { tg: 'Пахш', ru: 'Слушать', en: 'Play' },
  'deck.contents': { tg: 'Омӯзбаргҳо ({n})', ru: 'Записи ({n})', en: 'Entries ({n})' },
  'deck.audioError': {
    tg: 'Садо пахш нашуд.',
    ru: 'Не удалось воспроизвести аудио.',
    en: 'Could not play the audio.',
  },
  'deck.notFound': { tg: 'Маҷмӯа ёфт нашуд.', ru: 'Колода не найдена.', en: 'Deck not found.' },
  // Deleting a deck (Р34)
  'deck.delete': { tg: 'Пок кардани маҷмӯа', ru: 'Удалить колоду', en: 'Delete deck' },
  'deck.deleteTitle': { tg: 'Маҷмӯа пок шавад?', ru: 'Удалить колоду?', en: 'Delete this deck?' },
  'deck.deleteText': {
    tg: '«{name}» бо омӯзбаргҳо ва файлҳои садо аз ин дастгоҳ пок мешавад. Таърихчаи тамрин мемонад: агар ҳамин маҷмӯаро дубора насб кунед, пешрафт бармегардад. Барои насби дубора файл ё матни маҷмӯа лозим аст.',
    ru: 'Колода «{name}» с записями и звуком будет удалена с этого устройства. Журнал занятий остаётся: если установить эту колоду снова, прогресс вернётся. Для повторной установки нужен файл или текст колоды.',
    en: '“{name}” will be deleted from this device with its entries and audio. The study log is kept: if you install this deck again, your progress comes back. To install it again you need the deck file or text.',
  },
  'deck.deleteConfirm': { tg: 'Пок кардан', ru: 'Удалить', en: 'Delete' },

  // Skills (Р3)
  'skill.listen': { tg: 'гӯш додан', ru: 'слушать', en: 'listen' },
  'skill.speak': { tg: 'гуфтан', ru: 'говорить', en: 'speak' },
  'skill.write': { tg: 'навиштан', ru: 'писать', en: 'write' },

  // Study (stage 4.2, Р22; Tajik terms — docs/GLOSSARY_TG.md, section «Занятия»)
  'common.next': { tg: 'Баъдӣ', ru: 'Дальше', en: 'Next' },
  'study.start': { tg: 'Тамрин', ru: 'Заниматься', en: 'Study' },
  'study.progress': { tg: '{i} аз {n}', ru: '{i} из {n}', en: '{i} of {n}' },
  'study.nothing': { tg: 'Ҳоло чизе барои такрор нест.', ru: 'Сейчас повторять нечего.', en: 'Nothing to review right now.' },
  'study.noNew.noMaterial': {
    tg: 'Дар ин маҷмӯа омӯзбарги нав намонд.',
    ru: 'Новых записей в колоде не осталось.',
    en: 'No new entries left in this deck.',
  },
  // One line for both daily limits — new entries and new skills of known ones (phone check 19.10.2026).
  'study.noNew.dailyLimit': {
    tg: 'Саҳмияи имрӯзи омӯзбаргҳои нав тамом шуд.',
    ru: 'На сегодня новых больше нет: дневной лимит исчерпан.',
    en: 'No more new cards today: daily limit reached.',
  },
  'study.noNew.portionFull': {
    tg: 'Ин даврро такрорҳо пур карданд; омӯзбаргҳои нав — дар даври дигар.',
    ru: 'Эту порцию заняли повторения; новые записи — в следующей.',
    en: 'Reviews filled this round; new entries come in the next one.',
  },
  'study.done': { tg: 'Давр тамом шуд', ru: 'Порция пройдена', en: 'Round done' },
  'study.more': { tg: 'Даври дигар', ru: 'Ещё порция', en: 'Another round' },
  'study.introduced': { tg: 'Ошноӣ: {n}', ru: 'Знакомств: {n}', en: 'Introductions: {n}' },
  // Debts and the end of a portion (Р29.5, Р29.6; tg approved 18.10.2026)
  'study.noNew.overdue': {
    tg: 'Аввал такрорҳои рӯзҳои гузашта, баъд омӯзбаргҳои нав.',
    ru: 'Сначала — повторения с прошлых дней, потом новые записи.',
    en: 'Reviews from earlier days first, then new entries.',
  },
  'study.noNew.overdueIn': {
    tg: 'Аввал такрорҳои рӯзҳои гузашта дар маҷмӯаи «{deck}»{more}, баъд омӯзбаргҳои нав.',
    ru: 'Сначала — повторения с прошлых дней в колоде «{deck}»{more}, потом новые записи.',
    en: 'First the reviews from earlier days in “{deck}”{more}, then new entries.',
  },
  'study.noNew.overdueMore': { tg: ' ва {n} маҷмӯаи дигар', ru: ' и ещё в {n}', en: ' and {n} more' },
  'study.addAnyway': { tg: 'Ба ҳар ҳол илова', ru: 'Всё равно добавить', en: 'Add anyway' },
  'study.left.today': { tg: 'Имрӯз мондааст: {n}', ru: 'Сегодня ещё: {n}', en: 'Still today: {n}' },
  'study.left.tomorrow': { tg: 'Фардо: {n}', ru: 'Завтра: {n}', en: 'Tomorrow: {n}' },
  'study.left.week': { tg: 'Дар 7 рӯзи оянда: {n}', ru: 'За 7 дней: {n}', en: 'Next 7 days: {n}' },
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
  'intro.echo': { tg: 'Бо садои баланд хонед', ru: 'Прочитайте вслух', en: 'Read it aloud' },
  'intro.again': { tg: 'Бори дигар', ru: 'Ещё раз', en: 'Once more' },
  'intro.skip': { tg: 'Гузаштан', ru: 'Пропустить', en: 'Skip' },

  // Speak (Р22.6)
  'speak.sayIn': { tg: '{inLang} бигӯед', ru: 'Скажите {inLang}', en: 'Say it {inLang}' },
  'speak.typeIn': { tg: '{inLang} нависед…', ru: 'Напишите {inLang}…', en: 'Type it {inLang}…' },
  'speak.type': { tg: 'Навиштан', ru: 'Написать', en: 'Type' },
  'speak.check': { tg: 'Санҷиш', ru: 'Проверить', en: 'Check' },
  'speak.dontKnow': { tg: 'Намедонам', ru: 'Не знаю', en: "I don't know" },
  'listen.say': { tg: 'Бигӯед', ru: 'Скажите', en: 'Say it' },
  'listen.playing': { tg: 'Гӯш диҳед…', ru: 'Слушайте…', en: 'Listen…' },
  'listen.replay': { tg: 'Такрор', ru: 'Прослушать ещё раз', en: 'Play again' },
  'write.article': { tg: 'Шиносвожаи нодуруст', ru: 'Неверный артикль', en: 'Wrong article' },
  'write.elision': { tg: "Ин ҷо l' лозим аст", ru: "Нужна элизия: l'", en: "Needs the elision: l'" },
  'study.returned': { tg: 'Пас аз «Дубора» баргашт', ru: 'Вернулась после «Снова»', en: 'Back after Again' },

  // Microphone
  'mic.start': { tg: 'Гуфтан', ru: 'Говорить', en: 'Speak' },
  'mic.repeatHint': { tg: 'Вожаро ду-се бор пайи ҳам бигӯед', ru: 'Скажите слово 2–3 раза подряд', en: 'Say the word 2–3 times in a row' },
  'mic.hint': { tg: 'Фишор диҳед ва бигӯед', ru: 'Нажмите и говорите', en: 'Tap and speak' },
  'write.placeholder': { tg: 'Нависед…', ru: 'Напишите…', en: 'Type…' },

  // On-screen keyboard (Р31): names for the screen reader; tg approved by the owner 20.10.2026
  'kb.group': { tg: 'Сафҳакалид', ru: 'Клавиатура', en: 'Keyboard' },
  'kb.shift': { tg: 'Ҳарфи калон', ru: 'Заглавная', en: 'Shift' },
  'kb.backspace': { tg: 'Ҳазф', ru: 'Стереть', en: 'Delete' },
  'kb.space': { tg: 'Фосила', ru: 'Пробел', en: 'Space' },
  'kb.apostrophe': { tg: 'Апостроф', ru: 'Апостроф', en: 'Apostrophe' },
  'kb.hyphen': { tg: 'Хати пайванд', ru: 'Дефис', en: 'Hyphen' },
  'kb.hold': { tg: 'нигоҳ доред: {list}', ru: 'удерживайте: {list}', en: 'hold for {list}' },
  'mic.starting': { tg: 'Микрофон равшан мешавад…', ru: 'Микрофон включается…', en: 'Starting the microphone…' },
  'mic.unsupported': {
    tg: 'Ин мурургар бозшиносии гуфторро надорад — ҷавобро нависед.',
    ru: 'Этот браузер не распознаёт речь — напишите ответ.',
    en: 'This browser has no speech recognition — type the answer.',
  },
  'mic.err.not-allowed': {
    tg: 'Иҷозати микрофон нест. Онро барои ин сайт иҷозат диҳед.',
    ru: 'Нет доступа к микрофону. Разрешите его для этого сайта.',
    en: 'No access to the microphone. Allow it for this site.',
  },
  'mic.err.service-not-allowed': {
    tg: 'Мурургар бозшиносии гуфторро иҷозат надод.',
    ru: 'Браузер не разрешил распознавание речи.',
    en: 'The browser did not allow speech recognition.',
  },
  'mic.err.audio-capture': {
    tg: 'Микрофон ёфт нашуд ё барномаи дигар онро истифода мебарад.',
    ru: 'Микрофон не найден или занят другим приложением.',
    en: 'No microphone found, or another app is using it.',
  },
  'mic.err.network': {
    tg: 'Барои бозшиносии гуфтор интернет лозим аст.',
    ru: 'Для распознавания речи нужен интернет.',
    en: 'Speech recognition needs the internet.',
  },
  'mic.err.no-speech': { tg: 'Гуфтор шунида нашуд.', ru: 'Речь не услышана.', en: 'No speech heard.' },
  'mic.err.no-result': { tg: 'Чизе шунида нашуд.', ru: 'Ничего не распознано.', en: 'Nothing recognised.' },
  'mic.err.language-not-supported': {
    tg: 'Бозшиносии гуфтор барои ин забон дар ин мурургар дар дастрас нест.',
    ru: 'Этот браузер не распознаёт этот язык.',
    en: 'This browser cannot recognise this language.',
  },
  'mic.err.watchdog': { tg: 'Микрофон фаъол нашуд.', ru: 'Микрофон не включился.', en: 'The microphone did not start.' },
  'mic.err.other': { tg: 'Хатои бозшиносии гуфтор: {code}', ru: 'Ошибка распознавания: {code}', en: 'Recognition error: {code}' },

  // Answer marks (Р22.9): the labels never promise to judge pronunciation
  'mark.heardX': { tg: 'шунида шуд: {x}', ru: 'услышано: {x}', en: 'heard: {x}' },
  'mark.typedX': { tg: 'навишта шуд: {x}', ru: 'набрано: {x}', en: 'typed: {x}' },
  'mark.sound': { tg: 'аз рӯи талаффуз қабул шуд', ru: 'засчитано по звучанию', en: 'accepted by sound' },
  'mark.other': { tg: 'вожаи дигар шунида шуд', ru: 'распознано другое слово', en: 'recognised as another word' },
  'mark.otherTyped': { tg: 'вожаи дигар', ru: 'другое слово', en: 'another word' },
  'mark.unsaid': { tg: 'гуфта нашуд', ru: 'не сказано', en: 'not said' },
  'mark.extra': { tg: 'изофӣ', ru: 'лишнее', en: 'extra' },
  'mark.wrong': { tg: 'хато', ru: 'ошибка', en: 'wrong' },
  'mark.missing': { tg: 'ҷо монд', ru: 'пропущено', en: 'missing' },
  'mark.diacritic': { tg: 'танҳо аломат (é/e)', ru: 'только диакритика (é/e)', en: 'accent only (é/e)' },
  'mark.punct': { tg: 'нишонаи нигоришӣ — ба арзёбӣ таъсир надорад', ru: 'знак препинания — на оценку не влияет', en: "punctuation — doesn't affect the grade" },

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
  'reason.correct-retried': {
    tg: 'Дуруст, вале бо талоши дубора',
    ru: 'Верно, но не с первой попытки',
    en: 'Correct, but not on the first try',
  },
  'reason.listen-no-easy': { tg: 'Дуруст ва босуръат', ru: 'Верно и быстро', en: 'Correct and fast' },
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
  'import.checkTitle': { tg: 'Натиҷаи санҷиш', ru: 'Итог проверки', en: 'Check result' },
  'import.clean': { tg: 'Хато ва ҳушдор нест.', ru: 'Ошибок и предупреждений нет.', en: 'No errors or warnings.' },
  'import.willChange': { tg: 'Пас аз насб:', ru: 'После установки:', en: 'After installing:' },
  'import.reinstall': {
    tg: 'Нусхаи {rev} қаблан насб шудааст. Дубора насб кунем? Пешрафт ва таърихчаи тамрин тағйир намеёбанд.',
    ru: 'Редакция {rev} уже установлена. Переустановить? Прогресс и журнал не изменятся.',
    en: 'Revision {rev} is already installed. Reinstall it? Progress and the study log stay as they are.',
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
  'settings.newPerDay': { tg: 'Омӯзбаргҳои нав дар рӯз', ru: 'Новых записей в день', en: 'New entries per day' },
  'settings.recognition': { tg: 'Бозшиносии гуфтор', ru: 'Распознавание речи', en: 'Speech recognition' },
  'settings.biasing': {
    tg: 'Вожаҳо барои бозшиносии гуфтор (озмоишӣ)',
    ru: 'Подсказки распознавателю (эксперимент)',
    en: 'Recognizer hints (experiment)',
  },
  'settings.biasingHint': {
    tg: 'Ба бозшиносии гуфтор вожаҳои маҷмӯаҳои шумо дода мешаванд, то онҳоро беҳтар бишносад. Дар ҳама мурургарҳо кор намекунад.',
    ru: 'Распознаватель получает слова ваших колод, чтобы лучше их узнавать. Работает не во всех браузерах.',
    en: 'The recognizer gets the words of your decks to recognise them better. Not every browser supports it.',
  },
  'settings.biasingRejected': {
    tg: 'Ин мурургар вожаҳоро қабул накард — дар ин дастгоҳ онҳо фиристода намешаванд. Барои санҷиши дубора хомӯш ва дубора равшан кунед.',
    ru: 'Этот браузер не принял подсказки — на этом устройстве они не отправляются. Чтобы попробовать снова, выключите и включите переключатель.',
    en: 'This browser rejected the hints, so they are not sent on this device. To try again, switch this off and on.',
  },
  'settings.biasingNoApi': {
    tg: 'Ин мурургар вожаҳо барои бозшиносии гуфторро қабул намекунад.',
    ru: 'Этот браузер не поддерживает подсказки распознавателю.',
    en: 'This browser does not support recognizer hints.',
  },
  'settings.systemKeyboard': { tg: 'Сафҳакалиди дастгоҳ', ru: 'Системная клавиатура', en: 'System keyboard' },
  // The skill is named as on the cards ('skill.write'). tg approved 20.10.2026.
  'settings.systemKeyboardHint': {
    tg: 'Ҷавобҳоро бо сафҳакалиди дастгоҳ менависед, на бо сафҳакалиди Моно. Бо сафҳахон роҳаттар аст. Дар маҳорати «навиштан» сафҳакалиди дастгоҳ метавонад ҷавобро пешниҳод кунад.',
    ru: 'Ответы вы набираете на клавиатуре телефона, а не на клавиатуре Маны. С экранным диктором так удобнее. В навыке «писать» клавиатура телефона может подсказать ответ.',
    en: "You type answers on the phone's keyboard instead of Mana's. Easier with a screen reader. In the “write” skill the phone's keyboard may suggest the answer.",
  },
  'pack.available': {
    tg: 'Бозшиносӣ дар дастгоҳ ({lang}): насб шудааст.',
    ru: 'Распознавание на устройстве ({lang}): установлено.',
    en: 'On-device recognition ({lang}): installed.',
  },
  'pack.downloadable': {
    tg: 'Бозшиносӣ дар дастгоҳ ({lang}): боргирӣ кардан мумкин аст.',
    ru: 'Распознавание на устройстве ({lang}): можно скачать.',
    en: 'On-device recognition ({lang}): can be downloaded.',
  },
  'pack.downloading': {
    tg: 'Бозшиносӣ дар дастгоҳ ({lang}): боргирӣ мешавад…',
    ru: 'Распознавание на устройстве ({lang}): скачивается…',
    en: 'On-device recognition ({lang}): downloading…',
  },
  'pack.unavailable': {
    tg: 'Бозшиносӣ дар дастгоҳ ({lang}): барои ин забон дар дастрас нест.',
    ru: 'Распознавание на устройстве ({lang}): для этого языка недоступно.',
    en: 'On-device recognition ({lang}): not available for this language.',
  },
  'pack.unsupported': {
    tg: 'Ин мурургар бозшиносӣ дар дастгоҳро надорад.',
    ru: 'Этот браузер не умеет распознавать на устройстве.',
    en: 'This browser has no on-device recognition.',
  },
  'pack.download': {
    tg: 'Боргирии забони {lang} барои бозшиносӣ дар дастгоҳ',
    ru: 'Скачать {lang} для распознавания на устройстве',
    en: 'Download {lang} for on-device recognition',
  },
  'pack.failed': { tg: 'Боргирӣ нашуд.', ru: 'Скачать не удалось.', en: 'The download failed.' },
  'settings.prototype': {
    tg: 'Саҳифаи пешнамуна (бо таърихчаи қаблӣ)',
    ru: 'Экран прототипа (со старым журналом)',
    en: 'Prototype screen (with the old study log)',
  },

  // Personal decks without a server, browser voice (Р33 пп. 14–16; tg — draft for the owner, 21.10.2026)
  'decks.paste': { tg: 'Часпондани матни маҷмӯа', ru: 'Вставить текст колоды', en: 'Paste deck text' },
  'decks.makeWithAi': { tg: 'Сохтани маҷмӯа бо ҳуши маснӯӣ', ru: 'Сделать колоду с ИИ', en: 'Make a deck with AI' },
  'privacy.voice': {
    tg: 'Гуфтори шуморо мурургар бозшиносӣ мекунад: Chrome садоро ба Google мефиристад, Edge — ба Microsoft.',
    ru: 'Голосовой ответ распознаёт браузер: Chrome отправляет звук в Google, Edge — в Microsoft.',
    en: 'Your browser recognises voice answers: Chrome sends the audio to Google, Edge to Microsoft.',
  },
  'paste.title': { tg: 'Матни маҷмӯа', ru: 'Текст колоды', en: 'Deck text' },
  'paste.hint': {
    tg: 'Ҷавоби ҳуши маснӯиро бо deck.json-и пурра ин ҷо часпонед.',
    ru: 'Вставьте сюда ответ ИИ с deck.json целиком.',
    en: 'Paste the answer of the AI with the whole deck.json here.',
  },
  'import.notes': { tg: 'Маълумот: {n}', ru: 'Сведения: {n}', en: 'Notes: {n}' },
  'import.fixFirst': {
    tg: 'Беҳтар аст аввал маҷмӯаро ислоҳ кунед: «Нусха барои ҳуши маснӯӣ»-ро ба ҳуши маснӯӣ диҳед.',
    ru: 'Лучше сначала исправить колоду: отдайте «Копию для ИИ» вашему ИИ.',
    en: 'Better fix the deck first: give the “Copy for the AI” to your AI.',
  },
  'import.copyReport': { tg: 'Нусха барои ҳуши маснӯӣ', ru: 'Копия для ИИ', en: 'Copy for the AI' },
  'common.copied': { tg: 'Нусха гирифта шуд', ru: 'Скопировано', en: 'Copied' },
  'common.copyFailed': {
    tg: 'Нусха гирифта нашуд — матни поёнро дастӣ интихоб кунед.',
    ru: 'Не удалось скопировать — выделите текст ниже вручную.',
    en: 'Could not copy — select the text below by hand.',
  },
  'prompt.step1': {
    tg: '«Нусхаи дастур»-ро фишор диҳед, матнро дар гуфтугӯ бо ҳуши маснӯӣ (Claude, Gemini, ChatGPT) часпонед ва фиристед. Ҳуши маснӯӣ бо шумо ба забони русӣ гуфтугӯ мекунад; метавонед забони дигарро дархост кунед.',
    ru: 'Нажмите «Копировать инструкцию», вставьте текст в чат с ИИ (Claude, Gemini, ChatGPT) и отправьте. ИИ будет говорить по-русски; можно попросить другой язык.',
    en: 'Tap “Copy the instructions”, paste the text into a chat with an AI (Claude, Gemini, ChatGPT) and send it. The AI will talk in English; you can ask for another language.',
  },
  'prompt.step2': {
    tg: 'Ҳуши маснӯӣ аввал мепурсад: маҷмӯаро аз чӣ созад (мавзӯъ, матн ё акси саҳифаи китоби дарсӣ), чиро аз он гирад ва чанд омӯзбарг бошад.',
    ru: 'ИИ сначала спросит: из чего делать колоду (тема, текст или фото страницы учебника), что из этого взять и сколько записей.',
    en: 'The AI asks first: what to make the deck from (a topic, a text or a photo of a textbook page), what to take from it and how many entries.',
  },
  'prompt.step3': {
    tg: 'Баъд ҳуши маснӯӣ ҷадвали омӯзбаргҳоро нишон медиҳад — онро санҷед ва ислоҳҳоро нависед. deck.json-ро танҳо пас аз таъйиди шумо медиҳад.',
    ru: 'Затем ИИ покажет таблицу записей — проверьте её и напишите исправления. deck.json он даст только после вашего подтверждения.',
    en: 'Then the AI shows a table of the entries — check it and write your corrections. It gives deck.json only after you confirm.',
  },
  'prompt.step4': {
    tg: 'Ҷавоби ҳуши маснӯиро дар «Моно» часпонед: «Часпондани матни маҷмӯа». Агар санҷиш хато ё ҳушдор ёбад — «Нусха барои ҳуши маснӯӣ»-ро фишор диҳед, дар гуфтугӯ часпонед ва дархост кунед, ки ислоҳ кунад.',
    ru: 'Ответ ИИ вставьте в «Ману»: «Вставить текст колоды». Если проверка найдёт ошибки или предупреждения — «Копия для ИИ», вставьте её ИИ и попросите исправить.',
    en: 'Paste the answer of the AI into Mana: “Paste deck text”. If the check finds errors or warnings — “Copy for the AI”, paste it to the AI and ask it to fix them.',
  },
  'prompt.step5': {
    tg: 'Файли садо ихтиёрӣ аст: бе он омӯзбаргҳоро садои мурургар мехонад.',
    ru: 'Звук необязателен: без него карточки прочитает голос браузера.',
    en: 'Audio is optional: without it the browser voice reads the cards.',
  },
  'prompt.personal': {
    tg: 'Масъули муҳтавои маҷмӯаи худ шумо ҳастед. Агар ҷавоби дуруст нодуруст ҳисоб шавад, маҷмӯаро бо ҳуши маснӯӣ ислоҳ кунед.',
    ru: 'За содержание своей колоды отвечаете вы. Если верный ответ засчитан как неверный — исправьте колоду с ИИ.',
    en: 'You are responsible for the content of your deck. If a correct answer is marked wrong, fix the deck with the AI.',
  },
  'prompt.copy': { tg: 'Нусхаи дастур', ru: 'Копировать инструкцию', en: 'Copy the instructions' },
  'voice.title': { tg: 'Санҷиши садо', ru: 'Проверка голоса', en: 'Voice check' },
  'voice.intro': {
    tg: 'Омӯзбаргҳои бе файли садоро садои мурургар мехонад. «Пахш»-ро фишор диҳед ва гӯш диҳед.',
    ru: 'Карточки без звука колоды читает голос браузера. Нажмите «Слушать» и послушайте.',
    en: 'The browser voice reads cards without deck audio. Tap Play and listen.',
  },
  'voice.heard': { tg: 'Садоро шунидед?', ru: 'Слышен голос?', en: 'Did you hear the voice?' },
  'voice.yes': { tg: 'Бале', ru: 'Да', en: 'Yes' },
  'voice.no': { tg: 'Не', ru: 'Нет', en: 'No' },
  'voice.ok': {
    tg: 'Дар ин дастгоҳ омӯзбаргҳои «гӯш додан» бе файли садо бо садои мурургар дода мешаванд.',
    ru: 'Хорошо: на этом устройстве карточки «слушать» без звука колоды будут звучать голосом браузера.',
    en: 'Good: on this device, “listen” cards without deck audio will use the browser voice.',
  },
  'voice.none': {
    tg: 'Мурургар дар ин дастгоҳ садои ин забонро намеёбад.',
    ru: 'Браузер не находит на этом устройстве голоса этого языка.',
    en: 'The browser finds no voice for this language on this device.',
  },
  'voice.howAndroid': {
    tg: 'Android — Settings → Accessibility (ё System → Languages & input) → Text-to-speech → Google → Install voice data; бо русӣ — Настройки → Специальные возможности (ё Система → Язык и ввод) → Синтез речи → Google → Установить голосовые данные. Забонро интихоб ва боргирӣ кунед. Номи бандҳо дар ҳар телефон дигар аст.',
    ru: 'Android — Настройки → Специальные возможности (или Система → Язык и ввод) → Синтез речи → Google → Установить голосовые данные; по-английски — Settings → Accessibility (or System → Languages & input) → Text-to-speech → Google → Install voice data. Выберите язык и скачайте. Названия пунктов зависят от телефона.',
    en: 'Android — Settings → Accessibility (or System → Languages & input) → Text-to-speech → Google → Install voice data; in Russian — Настройки → Специальные возможности (или Система → Язык и ввод) → Синтез речи → Google → Установить голосовые данные. Pick the language and download it. Item names differ between phones.',
  },
  'voice.howWindows': {
    tg: 'Windows — Settings → Time & language → Speech → Add voices; бо русӣ — Параметры → Время и язык → Речь → Добавить голоса. Забонро интихоб кунед, баъд Edge-ро аз нав кушоед.',
    ru: 'Windows — Параметры → Время и язык → Речь → Добавить голоса; по-английски — Settings → Time & language → Speech → Add voices. Выберите язык, затем перезапустите Edge.',
    en: 'Windows — Settings → Time & language → Speech → Add voices; in Russian — Параметры → Время и язык → Речь → Добавить голоса. Pick the language, then restart Edge.',
  },
  'voice.howOther': {
    tg: 'Садои ин забонро дар танзимоти дастгоҳ (Text-to-speech) насб кунед. iPhone — баъдтар.',
    ru: 'Установите голос этого языка в настройках устройства (Синтез речи / Text-to-speech). iPhone — позже.',
    en: 'Install a voice for this language in the device settings (Text-to-speech). iPhone comes later.',
  },
  'voice.rule': {
    tg: 'Агар дар дастгоҳ садои ин забон умуман набошад, омӯзбаргҳои «гӯш додан» бе файли садо дода намешаванд.',
    ru: 'Если голоса этого языка на устройстве нет совсем, карточки «слушать» без звука колоды не выдаются.',
    en: 'If the device has no voice for this language at all, “listen” cards without deck audio are not given.',
  },
  'voice.state.yes': { tg: 'Санҷида шуд: садо ҳаст', ru: 'Проверено: слышно', en: 'Checked: works' },
  'voice.state.no': { tg: 'Санҷида шуд: садо нест', ru: 'Проверено: не слышно', en: 'Checked: not heard' },
  'voice.state.none': { tg: 'Санҷида нашудааст', ru: 'Не проверено', en: 'Not checked' },
  'settings.voice': { tg: 'Садои мурургар', ru: 'Голос браузера', en: 'Browser voice' },
  'settings.voiceHint': {
    tg: 'Барои омӯзбаргҳои бе файли садо.',
    ru: 'Для карточек без звука колоды.',
    en: 'For cards without deck audio.',
  },

  // Study log sheet (prototype screen)
  'log.title': { tg: 'Таърихчаи тамрин', ru: 'Журнал занятий', en: 'Study log' },

  // Backup
  'backup.title': { tg: 'Нусхаи пуштибон', ru: 'Резервная копия', en: 'Backup' },
  'backup.hint': {
    tg: 'Таърихчаи тамрин (ҳамаи пешрафт) танҳо дар ҳамин мурургар захира мешавад. Гоҳ-гоҳ онро дар файл захира кунед.',
    ru: 'Журнал занятий (весь прогресс) хранится только в этом браузере. Время от времени сохраняйте его в файл.',
    en: 'The study log (all your progress) lives only in this browser. Save it to a file from time to time.',
  },
  'backup.save': { tg: 'Захираи таърихча дар файл', ru: 'Сохранить журнал в файл', en: 'Save the study log to a file' },
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
    en: 'This is not a Mana study log file.',
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

  // New scheduling rules: one-time rebuild (Р29.7; tg approved 18.10.2026)
  'migrate.title': { tg: 'Қоидаҳои такрор барӯз шуданд', ru: 'Правила повторений обновлены', en: 'Review rules updated' },
  'migrate.text': {
    tg: 'Вақти такрорҳо бо қоидаҳои нав аз нав ҳисоб мешавад. Аввал таърихча дар файл захира мешавад — барои эҳтиёт; худи таърихча тағйир намеёбад.',
    ru: 'Сроки повторений пересчитаются по новым правилам. Сначала журнал сохранится в файл — на всякий случай; сам журнал не меняется.',
    en: 'Review dates will be recalculated with the new rules. First the study log is saved to a file, just in case; the log itself does not change.',
  },
  'migrate.go': { tg: 'Захира ва идома', ru: 'Сохранить и продолжить', en: 'Save and continue' },

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

  // Account: Settings section (stage 6a.2, R37). tg — DRAFT for the terminology chat, not approved.
  'account.title': { tg: 'Ҳисоб', ru: 'Аккаунт', en: 'Account' },
  'account.signedOut': {
    tg: 'Шумо ба ҳисоб ворид нашудаед. Бе ҳисоб ҳама чиз танҳо дар ҳамин дастгоҳ аст.',
    ru: 'Вы не вошли в аккаунт. Без аккаунта всё хранится только на этом устройстве.',
    en: 'You are not signed in. Without an account everything stays on this device only.',
  },
  'account.haveCode': { tg: 'Код дорам', ru: 'У меня есть код', en: 'I have a code' },
  'account.signedIn': { tg: 'Шумо ба ҳисоб ворид шудаед.', ru: 'Вы вошли в аккаунт.', en: 'You are signed in.' },
  'account.deviceName': { tg: 'Номи ин дастгоҳ', ru: 'Имя этого устройства', en: 'Name of this device' },
  'account.save': { tg: 'Захира', ru: 'Сохранить', en: 'Save' },
  'account.devices': { tg: 'Дастгоҳҳо', ru: 'Устройства', en: 'Devices' },
  'account.thisDevice': { tg: '(ин дастгоҳ)', ru: '(это устройство)', en: '(this device)' },
  'account.lastSeen': { tg: 'Охирин вуруд: {date}', ru: 'Последний вход: {date}', en: 'Last sign-in: {date}' },
  'account.remove': { tg: 'Хориҷ кардан', ru: 'Отключить', en: 'Remove' },
  'account.removeConfirm': {
    tg: 'Дастгоҳи «{name}» аз ҳисоб хориҷ шавад? Додаҳояш дар худи он мемонанд, вале барои ворид шудани дубора даъватнома ё код лозим мешавад.',
    ru: 'Отключить «{name}» от аккаунта? Данные на нём останутся, но для нового входа понадобится приглашение или код.',
    en: 'Remove “{name}” from the account? Its data stays on it, but signing in again will need an invitation or a code.',
  },
  'account.addDevice': { tg: 'Иловаи дастгоҳ', ru: 'Добавить устройство', en: 'Add a device' },
  'account.codeHint': {
    tg: 'Дар дастгоҳи нав: Танзимот → «Код дорам» → ин кодро ворид кунед. Як бор кор мекунад; боқӣ: {time}',
    ru: 'На новом устройстве: Настройки → «У меня есть код» → введите этот код. Срабатывает один раз; осталось: {time}',
    en: 'On the new device: Settings → “I have a code” → enter this code. Works once; time left: {time}',
  },
  'account.codeExpired': { tg: 'Мӯҳлати код гузашт.', ru: 'Срок кода истёк.', en: 'The code has expired.' },
  'account.newCode': { tg: 'Коди нав', ru: 'Новый код', en: 'New code' },
  'account.signOut': { tg: 'Хуруҷ', ru: 'Выйти', en: 'Sign out' },
  'account.signOutConfirm': {
    tg: 'Дар ин дастгоҳ аз ҳисоб хуруҷ мекунед? Додаҳо дар ин дастгоҳ мемонанд.',
    ru: 'Выйти из аккаунта на этом устройстве? Данные на устройстве останутся.',
    en: 'Sign out on this device? The data on this device stays.',
  },
  'account.signedOutBy': {
    tg: 'Ин дастгоҳ дигар ба ҳисоб ворид нест: онро аз дастгоҳи дигар хориҷ карданд ё муддати зиёд истифода нашуд. Додаҳо дар ин дастгоҳ мемонанд.',
    ru: 'Это устройство больше не в аккаунте: его отключили с другого устройства или им долго не пользовались. Данные на устройстве на месте.',
    en: 'This device is no longer signed in: it was removed from another device or not used for a long time. The data on this device is still here.',
  },
  'account.offline': {
    tg: 'Сервер ҷавоб намедиҳад. Баъдтар бори дигар кӯшиш кунед.',
    ru: 'Сервер не отвечает. Попробуйте позже.',
    en: "The server isn't responding. Try again later.",
  },
  'account.privacy': { tg: 'Додаҳо ва ҳарими хусусӣ', ru: 'Данные и конфиденциальность', en: 'Data and privacy' },

  // Sign-in screen and invitation steps (stage 6a.2). tg — DRAFT for the terminology chat.
  'signin.title': { tg: 'Вуруд', ru: 'Вход', en: 'Sign in' },
  'signin.label': { tg: 'Даъватнома ё код', ru: 'Ссылка-приглашение или код', en: 'Invitation link or code' },
  'signin.hint': {
    tg: 'Даъватномаро аз паём часпонед ё коди 8-аломата аз дастгоҳи дигаратонро ворид кунед.',
    ru: 'Вставьте ссылку-приглашение из сообщения или введите код из 8 знаков с другого вашего устройства.',
    en: 'Paste the invitation link from the message or enter the 8-character code from your other device.',
  },
  'signin.submit': { tg: 'Вуруд', ru: 'Войти', en: 'Sign in' },
  'signin.invalid': {
    tg: 'Даъватнома ё код кор намекунад: нодуруст аст, аллакай истифода шудааст ё мӯҳлаташ гузаштааст. Навашро дархост кунед.',
    ru: 'Приглашение или код не подходят: неверные, уже использованы или срок истёк. Попросите новые.',
    en: "The invitation or code doesn't work: it is wrong, already used or expired. Ask for a new one.",
  },
  'signin.tooMany': {
    tg: 'Кӯшишҳо хеле зиёд шуданд. Баъдтар бори дигар кӯшиш кунед.',
    ru: 'Слишком много попыток. Попробуйте позже.',
    en: 'Too many attempts. Try again later.',
  },
  'signin.hasAnswers': {
    tg: 'Дар ин дастгоҳ аллакай ҷавобҳои шумо ҳастанд. Ворид шудан дар чунин дастгоҳ дар нусхаи ояндаи барнома имконпазир мешавад — он гоҳ ҷавобҳоро ба ҳисоб илова кардан мумкин аст. Ҳоло ҳеҷ чиз тағйир наёфт; додаҳо дар ҷояшон.',
    ru: 'На этом устройстве уже есть ваши ответы. Вход на таком устройстве появится в следующей версии приложения — тогда ответы можно будет добавить в аккаунт. Сейчас ничего не изменилось, данные на месте.',
    en: 'This device already has your answers. Signing in on such a device comes in a later version of the app, and then the answers can be added to the account. Nothing has changed; your data is in place.',
  },
  'signin.already': {
    tg: 'Шумо дар ин дастгоҳ аллакай ба ҳисоб ворид шудаед.',
    ru: 'Вы уже вошли в аккаунт на этом устройстве.',
    en: 'You are already signed in on this device.',
  },
  'signin.outdated': {
    tg: 'Нусхаи барнома кӯҳна аст: онро пӯшед ва дубора кушоед.',
    ru: 'Версия приложения устарела: закройте его и откройте снова.',
    en: 'This version of the app is out of date: close it and open it again.',
  },
  'signin.done': { tg: 'Шумо ба ҳисоб ворид шудед.', ru: 'Вы вошли в аккаунт.', en: 'You are signed in.' },
  'signin.error': {
    tg: 'Хато рух дод. Баъдтар бори дигар кӯшиш кунед.',
    ru: 'Что-то пошло не так. Попробуйте позже.',
    en: 'Something went wrong. Try again later.',
  },
  'join.title': { tg: 'Даъватнома', ru: 'Приглашение', en: 'Invitation' },
  'join.agree': { tg: 'Мувофиқам', ru: 'Согласен(на)', en: 'I agree' },
  'join.age': { tg: 'Шумо 16-сола шудаед?', ru: 'Вам уже исполнилось 16 лет?', en: 'Are you 16 or older?' },
  'join.ageHint': {
    tg: 'Агар не, ризояти волидайн ё сарпараст лозим аст — дар ҳамин дастгоҳ.',
    ru: 'Если нет — нужно согласие родителя или опекуна, на этом же устройстве.',
    en: 'If not, a parent or guardian must agree, on this same device.',
  },
  'join.parentHint': {
    tg: 'Ин саҳифаро яке аз волидайн ё сарпараст пур мекунад.',
    ru: 'Этот экран заполняет родитель или опекун.',
    en: 'A parent or guardian fills in this screen.',
  },
  'join.parentMissing': {
    tg: 'Номи худро нависед ва аломат гузоред.',
    ru: 'Напишите своё имя и поставьте отметку.',
    en: 'Write your name and tick the box.',
  },
  'join.signIn': { tg: 'Вуруд', ru: 'Войти', en: 'Sign in' },
  'join.deviceInvite': {
    tg: 'Ин даъватнома барои ворид шудани ин дастгоҳ ба ҳисоби мавҷудаи шумост.',
    ru: 'Это приглашение — для входа этого устройства в ваш аккаунт.',
    en: 'This invitation signs this device in to your existing account.',
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
