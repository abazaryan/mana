# Таджикские строки интерфейса — на проверку

Файл создаётся командой `npm run i18n:table` из исходников; править переводы нужно в исходниках (или написать Claude, что исправить). Тест следит, чтобы файл не отставал от кода.

Термины: колода — «маҷмӯа», запись — «сабт», журнал — «дафтари ҷавобҳо», редакция — «таҳрир». `{n}`, `{name}` и т. п. — места, куда приложение подставляет число или название.

Первый запуск: «Забонро интихоб кунед · Выберите язык · Choose a language». Названия языков в выборе: Тоҷикӣ, Русский, English.

## Интерфейс (`src/ui/strings.ts`)

| Ключ | Русский | English | Тоҷикӣ |
|---|---|---|---|
| `common.loading` | Загрузка… | Loading… | Бор шуда истодааст… |
| `common.close` | Закрыть | Close | Пӯшидан |
| `common.cancel` | Отмена | Cancel | Бекор кардан |
| `common.back` | Назад | Back | Бозгашт |
| `common.dbError` | Не удалось открыть базу данных: {error} | Could not open the database: {error} | Пойгоҳи маълумот кушода нашуд: {error} |
| `nav.decks` | Колоды | Decks | Маҷмӯаҳо |
| `nav.settings` | Настройки | Settings | Танзимот |
| `decks.title` | Колоды | Decks | Маҷмӯаҳо |
| `decks.empty` | Колод пока нет. Загрузите ZIP-файл колоды. | No decks yet. Import a deck ZIP file. | Ҳоло маҷмӯа нест. Файли ZIP-и маҷмӯаро бор кунед. |
| `decks.import` | Импорт колоды (ZIP) | Import a deck (ZIP) | Бор кардани маҷмӯа (ZIP) |
| `decks.entries` | Записей: {n} | Entries: {n} | Сабтҳо: {n} |
| `decks.revision` | Редакция: {n} | Revision: {n} | Таҳрир: {n} |
| `decks.audio` | Аудио: {mb} МБ | Audio: {mb} MB | Аудио: {mb} МБ |
| `deck.hidden` | Скрыто: {n} — нет в новой редакции, их прогресс сохранён. | Hidden: {n} — not in the new revision; their progress is kept. | Пинҳон: {n} — дар таҳрири нав нестанд, пешрафташон нигоҳ дошта шудааст. |
| `deck.play` | Слушать | Play | Гӯш кардан |
| `deck.noAudio` | Нет аудио | No audio | Аудио нест |
| `deck.audioError` | Не удалось воспроизвести аудио. | Could not play the audio. | Аудио пахш нашуд. |
| `deck.notFound` | Колода не найдена. | Deck not found. | Маҷмӯа ёфт нашуд. |
| `skill.listen` | слушать | listen | шунидан |
| `skill.speak` | говорить | speak | гуфтан |
| `skill.write` | писать | write | навиштан |
| `import.reading` | Читаю файл… | Reading the file… | Файл хонда мешавад… |
| `import.rejected` | Колода не принята | Deck not accepted | Маҷмӯа қабул нашуд |
| `import.authorNote` | Сообщения адресованы автору колоды. | The messages are in Russian — they are meant for the deck author. | Паёмҳо ба забони русӣ — онҳо барои муаллифи маҷмӯа навишта шудаанд. |
| `import.warnings` | Предупреждения: {n} | Warnings: {n} | Огоҳиҳо: {n} |
| `import.confirmTitle` | Нужно подтверждение | Please confirm | Тасдиқ лозим аст |
| `import.reinstall` | Редакция {rev} уже установлена. Переустановить? Прогресс и журнал не изменятся. | Revision {rev} is already installed. Reinstall it? Progress and the journal stay as they are. | Таҳрири {rev} аллакай насб шудааст. Аз нав насб кунем? Пешрафт ва дафтари ҷавобҳо тағйир намеёбанд. |
| `import.older` | Загружается редакция {incoming}, а установлена {installed} — загружаемая старее. Всё равно установить? | You are loading revision {incoming}, but revision {installed} is installed — the file is older. Install it anyway? | Шумо таҳрири {incoming}-ро бор мекунед, вале таҳрири {installed} насб шудааст — файли нав кӯҳнатар аст. Бо вуҷуди ин насб кунем? |
| `import.different` | Колода с таким id уже установлена («{name}»), но записи почти не совпадают: общих {shared} из {installed}. Возможно, это другая колода с тем же id. Если установить, записи «{name}», которых нет в новом файле, будут скрыты. | A deck with this id is already installed ("{name}"), but the entries hardly match: {shared} of {installed} in common. It may be another deck with the same id. If you install it, the entries of "{name}" missing from the new file will be hidden. | Маҷмӯа бо ҳамин id аллакай ҳаст («{name}»), вале сабтҳо қариб мувофиқат намекунанд: умумӣ {shared} аз {installed}. Шояд ин маҷмӯаи дигар бо ҳамон id бошад. Агар насб кунед, сабтҳои «{name}», ки дар файли нав нестанд, пинҳон мешаванд. |
| `import.languageChanged` | У колоды другой изучаемый язык: {from} → {to}. | The learning language differs: {from} → {to}. | Забони омӯзиши маҷмӯа дигар аст: {from} → {to}. |
| `import.install` | Установить | Install | Насб кардан |
| `import.installed` | Колода установлена | Deck installed | Маҷмӯа насб шуд |
| `import.updated` | Колода обновлена | Deck updated | Маҷмӯа нав карда шуд |
| `import.summary` | Новых: {added} · обновлено: {updated} · скрыто: {hidden} · вернулось: {restored} | New: {added} · updated: {updated} · hidden: {hidden} · back: {restored} | Нав: {added} · навшуда: {updated} · пинҳоншуда: {hidden} · баргашта: {restored} |
| `import.failed` | Не удалось установить: {error} | Install failed: {error} | Насб нашуд: {error} |
| `settings.title` | Настройки | Settings | Танзимот |
| `settings.uiLang` | Язык интерфейса | Interface language | Забони барнома |
| `settings.meaningLang` | Язык значений | Meaning language | Забони маъноҳо |
| `settings.meaningHint` | Значения, подсказки и заметки записей показываются на этом языке; если его нет — на другом имеющемся. | Meanings, hints and notes are shown in this language; if an entry lacks it, in another available one. | Маъно, ишора ва эзоҳи сабтҳо бо ин забон нишон дода мешаванд; агар бо ин забон набошад — бо забони дигари мавҷуда. |
| `settings.prototype` | Экран прототипа (со старым журналом) | Prototype screen (with the old journal) | Экрани прототип (бо дафтари кӯҳна) |
| `backup.title` | Резервная копия | Backup | Нусхаи эҳтиётӣ |
| `backup.hint` | Журнал ответов (весь прогресс) хранится только в этом браузере. Время от времени сохраняйте его в файл. | The answer journal (all your progress) lives only in this browser. Save it to a file from time to time. | Дафтари ҷавобҳо (ҳамаи пешрафт) танҳо дар ҳамин браузер нигоҳ дошта мешавад. Гоҳ-гоҳ онро дар файл нигоҳ доред. |
| `backup.save` | Сохранить журнал в файл | Save the journal to a file | Нигоҳ доштани дафтар дар файл |
| `backup.restore` | Восстановить из файла | Restore from a file | Барқарор кардан аз файл |
| `backup.saved` | В файле записей: {n} | Records in the file: {n} | Дар файл сабтҳо: {n} |
| `backup.restored` | Добавлено: {added} · уже было: {skipped} | Added: {added} · already present: {skipped} | Илова шуд: {added} · аллакай буд: {skipped} |
| `backup.error.json` | Это не файл журнала «Слуха». | This is not a Sluh journal file. | Ин файли дафтари «Слух» нест. |
| `backup.error.version` | Файл из более новой версии приложения. Обновите приложение. | The file comes from a newer version of the app. Update the app. | Файл аз версияи навтари барнома аст. Барномаро нав кунед. |
| `backup.error.records` | Файл повреждён: часть записей не читается. Ничего не добавлено. | The file is damaged: some records cannot be read. Nothing was added. | Файл вайрон аст: баъзе сабтҳо хонда намешаванд. Ҳеҷ чиз илова нашуд. |
| `backup.error.otherUser` | Файл другого пользователя, а здесь уже есть свои ответы. Объединение появится на этапе синхронизации. | The file belongs to another user, and this browser already has its own answers. Merging comes with sync. | Файл ба корбари дигар тааллуқ дорад, вале дар ин ҷо аллакай ҷавобҳои худатон ҳаст. Якҷоя кардан дар марҳилаи ҳамоҳангсозӣ илова мешавад. |
| `backup.error.failed` | Ошибка: {error} | Error: {error} | Хатогӣ: {error} |
| `storage.title` | Хранилище | Storage | Нигоҳдории маълумот |
| `storage.persisted` | Постоянное: браузер не удалит данные сам. | Persistent: the browser will not clear the data on its own. | Доимӣ: браузер маълумотро худ аз худ пок намекунад. |
| `storage.notPersisted` | При нехватке места браузер может удалить данные. Сохраняйте резервную копию. | The browser may clear the data when space runs low. Keep a backup. | Ҳангоми камии ҷой браузер метавонад маълумотро пок кунад. Нусхаи эҳтиётӣ нигоҳ доред. |
| `storage.unsupported` | Браузер не сообщает, как хранит данные. | The browser does not report how it keeps the data. | Браузер дар бораи нигоҳдорӣ маълумот намедиҳад. |
| `storage.request` | Запросить постоянное хранилище | Request persistent storage | Нигоҳдории доимиро дархост кардан |

## Подсказки формы (`FORM_LABELS` в `src/core/deckFormat.ts`, подтверждены 11.10.2026)

| Ключ | Русский | English | Тоҷикӣ |
|---|---|---|---|
| `determiner.definite` | опред. | def. | муай. |
| `determiner.indefinite` | неопред. | indef. | номуай. |
| `gender.m` | м. р. | m. | музак. |
| `gender.f` | ж. р. | f. | муан. |
| `gender.n` | ср. р. | n. | хунсо |
| `number.singular` | ед. ч. | sg. | танҳ. |
| `number.plural` | мн. ч. | pl. | ҷамъ |

## Изучаемые языки (`src/core/languages.ts`)

| Ключ | Русский | English | Тоҷикӣ |
|---|---|---|---|
| `fr` | французский | French | фаронсавӣ |
