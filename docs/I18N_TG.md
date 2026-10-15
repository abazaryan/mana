# Таджикские строки интерфейса — на проверку

Файл создаётся командой `npm run i18n:table` из исходников; править переводы нужно в исходниках (или написать Claude, что исправить). Тест следит, чтобы файл не отставал от кода.

Термины — в `docs/GLOSSARY_TG.md`. `{n}`, `{name}` и т. п. — места, куда приложение подставляет число или название.

Первый запуск: «Забонро интихоб кунед · Выберите язык · Choose a language». Названия языков в выборе: Тоҷикӣ, Русский, English.

## Интерфейс (`src/ui/strings.ts`)

| Ключ | Русский | English | Тоҷикӣ |
|---|---|---|---|
| `app.name` | Мана | Mana | Моно |
| `common.loading` | Загрузка… | Loading… | Боргузорӣ… |
| `common.close` | Закрыть | Close | Бастан |
| `common.cancel` | Отмена | Cancel | Лағв |
| `common.back` | Назад | Back | Бозгашт |
| `common.dbError` | Не удалось открыть базу данных: {error} | Could not open the database: {error} | Пойгоҳи додаҳо кушода нашуд: {error} |
| `nav.decks` | Колоды | Decks | Маҷмӯаҳо |
| `nav.settings` | Настройки | Settings | Танзимот |
| `decks.title` | Колоды | Decks | Маҷмӯаҳо |
| `decks.empty` | Колод пока нет. Загрузите ZIP-файл колоды. | No decks yet. Import a deck ZIP file. | Ҳанӯз маҷмӯае нест. Файли ZIP-и маҷмӯаро дарунрезӣ кунед. |
| `decks.import` | Импорт колоды (ZIP) | Import a deck (ZIP) | Дарунрезии маҷмӯа (ZIP) |
| `decks.entries` | Записей: {n} | Entries: {n} | Омӯзбаргҳо: {n} |
| `decks.revision` | Редакция: {n} | Revision: {n} | Нусха: {n} |
| `decks.audio` | Аудио: {mb} МБ | Audio: {mb} MB | Садо: {mb} МБ |
| `deck.hidden` | Скрыто: {n} — нет в новой редакции, их прогресс сохранён. | Hidden: {n} — not in the new revision; their progress is kept. | Пинҳон: {n} — дар нусхаи нав нестанд, пешрафташон ҳифз шудааст. |
| `deck.play` | Слушать | Play | Гӯш кардан |
| `deck.noAudio` | Нет аудио | No audio | Садо нест |
| `deck.audioError` | Не удалось воспроизвести аудио. | Could not play the audio. | Садо пахш нашуд. |
| `deck.notFound` | Колода не найдена. | Deck not found. | Маҷмӯа ёфт нашуд. |
| `skill.listen` | слушать | listen | шунидан |
| `skill.speak` | говорить | speak | гуфтан |
| `skill.write` | писать | write | навиштан |
| `common.next` | Дальше | Next | Баъдӣ |
| `study.start` | Заниматься | Study | Тамрин |
| `study.progress` | {i} из {n} | {i} of {n} | {i} аз {n} |
| `study.nothing` | Сейчас нечего повторять, и новых записей нет. | Nothing to review and no new entries right now. | Ҳоло чизе барои такрор нест ва омӯзбарги нав ҳам нест. |
| `study.noNew.noMaterial` | Новых записей в колоде не осталось. | No new entries left in this deck. | Дар ин маҷмӯа омӯзбарги нав намонд. |
| `study.noNew.dailyLimit` | Новые записи на сегодня закончились: лимит — {n} в день. | No more new entries today: the limit is {n} a day. | Омӯзбаргҳои нави имрӯз тамом шуданд: ҳадди рӯзона — {n}. |
| `study.noNew.portionFull` | Эту порцию заняли повторения; новые записи — в следующей. | Reviews filled this round; new entries come in the next one. | Ин даврро такрорҳо пур карданд; омӯзбаргҳои нав — дар даври дигар. |
| `study.done` | Порция пройдена | Round done | Давр тамом шуд |
| `study.more` | Ещё порция | Another round | Даври дигар |
| `study.introduced` | Знакомств: {n} | Introductions: {n} | Ошноӣ: {n} |
| `study.noLanguage` | Язык {lang} пока не поддерживается. | The language {lang} is not supported yet. | Барнома ҳанӯз бо забони {lang} кор намекунад. |
| `study.saveError` | Ответ не сохранён: {error} | The answer was not saved: {error} | Ҷавоб захира нашуд: {error} |
| `intro.label` | Знакомство | Introduction | Ошноӣ |
| `intro.echo` | Повторите вслух | Say it aloud | Бо садои баланд такрор кунед |
| `intro.copy` | Напишите по образцу | Copy it out | Аз рӯи намуна нависед |
| `intro.again` | Ещё раз | Once more | Боз як бор |
| `intro.skip` | Пропустить | Skip | Гузаштан |
| `speak.prompt` | Скажите ответ | Say the answer | Ҷавобро гӯед |
| `speak.type` | Написать | Type | Навиштан |
| `speak.typePlaceholder` | Напишите ответ | Type the answer | Ҷавобро нависед |
| `speak.check` | Проверить | Check | Санҷиш |
| `speak.dontKnow` | Не знаю | I don't know | Намедонам |
| `mic.start` | Говорить | Speak | Гуфтан |
| `mic.starting` | Включаю микрофон… | Starting the microphone… | Микрофон фаъол мешавад… |
| `mic.listening` | Слушаю… | Listening… | Гӯш медиҳам… |
| `mic.retry` | Повторить | Try again | Талоши дубора |
| `mic.unsupported` | Этот браузер не распознаёт речь — напишите ответ. | This browser has no speech recognition — type the answer. | Ин мурургар шинохти гуфторро надорад — ҷавобро нависед. |
| `mic.err.not-allowed` | Нет доступа к микрофону. Разрешите его для этого сайта. | No access to the microphone. Allow it for this site. | Иҷозати микрофон нест. Онро барои ин сомона иҷозат диҳед. |
| `mic.err.service-not-allowed` | Браузер не разрешил распознавание речи. | The browser did not allow speech recognition. | Мурургар шинохти гуфторро иҷозат надод. |
| `mic.err.audio-capture` | Микрофон не найден или занят другим приложением. | No microphone found, or another app is using it. | Микрофон ёфт нашуд ё барномаи дигар онро истифода мебарад. |
| `mic.err.network` | Для распознавания речи нужен интернет. | Speech recognition needs the internet. | Барои шинохти гуфтор интернет лозим аст. |
| `mic.err.no-speech` | Речь не услышана. | No speech heard. | Гуфтор шунида нашуд. |
| `mic.err.no-result` | Ничего не распознано. | Nothing recognised. | Чизе шинохта нашуд. |
| `mic.err.language-not-supported` | Этот браузер не распознаёт этот язык. | This browser cannot recognise this language. | Ин мурургар ин забонро намешиносад. |
| `mic.err.watchdog` | Микрофон не включился. | The microphone did not start. | Микрофон фаъол нашуд. |
| `mic.err.other` | Ошибка распознавания: {code} | Recognition error: {code} | Хатои шинохти гуфтор: {code} |
| `answer.heard` | Услышано: | Heard: | Шунида шуд: |
| `answer.nothing` | (ничего) | (nothing) | (ҳеҷ чиз) |
| `mark.heardX` | услышано: {x} | heard: {x} | шунида шуд: {x} |
| `mark.typedX` | набрано: {x} | typed: {x} | навишта шуд: {x} |
| `mark.sound` | засчитано по звучанию | accepted by sound | аз рӯи талаффуз қабул шуд |
| `mark.other` | распознано другое слово | recognised as another word | вожаи дигар шунида шуд |
| `mark.otherTyped` | другое слово | another word | вожаи дигар |
| `mark.unsaid` | не сказано | not said | гуфта нашуд |
| `mark.extra` | лишнее | extra | изофӣ |
| `mark.wrong` | ошибка | wrong | хато |
| `mark.missing` | пропущено | missing | ҷо монд |
| `mark.diacritic` | только диакритика (é/e) | accent only (é/e) | танҳо аломат (é/e) |
| `rating.1` | Снова | Again | Дубора |
| `rating.2` | Трудно | Hard | Сахт |
| `rating.3` | Хорошо | Good | Хуб |
| `rating.4` | Легко | Easy | Осон |
| `rating.suggested` | Предложено: {rating} | Suggested: {rating} | Пешниҳод: {rating} |
| `rating.misrecognized` | Меня неправильно распознали | I was misrecognised | Нодуруст шунид |
| `rating.lockedVoice` | «Снова» можно повысить только кнопкой «Меня неправильно распознали». | "Again" can be raised only with "I was misrecognised". | «Дубора»-ро танҳо бо «Нодуруст шунид» метавон баланд кард. |
| `rating.lockedTyped` | При ответе текстом «Снова» повысить нельзя. | A typed answer rated "Again" cannot be raised. | Дар ҷавоби навиштаӣ «Дубора»-ро баланд кардан мумкин нест. |
| `reason.incorrect` | Неверно | Incorrect | Нодуруст |
| `reason.almost` | Почти | Almost | Тақрибан дуруст |
| `reason.correct` | Верно | Correct | Дуруст |
| `reason.correct-fast` | Верно и быстро | Correct and fast | Дуруст ва босуръат |
| `reason.correct-retried` | Верно, но не с первой попытки | Correct, but not on the first try | Дуруст, вале на аз талоши аввал |
| `reason.correct-fast-twice` | Верно и быстро второй раз подряд | Correct and fast twice in a row | Дуруст ва босуръат, ду бор паёпай |
| `import.reading` | Читаю файл… | Reading the file… | Файл хонда мешавад… |
| `import.rejected` | Колода не принята | Deck not accepted | Маҷмӯа қабул нашуд |
| `import.authorNote` | Сообщения адресованы автору колоды. | The messages are in Russian — they are meant for the deck author. | Паёмҳо ба забони русӣ — онҳо барои муаллифи маҷмӯа навишта шудаанд. |
| `import.warnings` | Предупреждения: {n} | Warnings: {n} | Ҳушдорҳо: {n} |
| `import.confirmTitle` | Нужно подтверждение | Please confirm | Таъйид лозим аст |
| `import.reinstall` | Редакция {rev} уже установлена. Переустановить? Прогресс и журнал не изменятся. | Revision {rev} is already installed. Reinstall it? Progress and the journal stay as they are. | Нусхаи {rev} қаблан насб шудааст. Дубора насб кунем? Пешрафт ва таърихчаи ҷавобҳо тағйир намеёбанд. |
| `import.older` | Загружается редакция {incoming}, а установлена {installed} — загружаемая старее. Всё равно установить? | You are loading revision {incoming}, but revision {installed} is installed — the file is older. Install it anyway? | Шумо нусхаи {incoming}-ро дарунрезӣ мекунед, вале нусхаи {installed} насб шудааст — файли нав кӯҳнатар аст. Бо вуҷуди ин насб кунем? |
| `import.different` | Колода с таким id уже установлена («{name}»), но записи почти не совпадают: общих {shared} из {installed}. Возможно, это другая колода с тем же id. Если установить, записи «{name}», которых нет в новом файле, будут скрыты. | A deck with this id is already installed ("{name}"), but the entries hardly match: {shared} of {installed} in common. It may be another deck with the same id. If you install it, the entries of "{name}" missing from the new file will be hidden. | Маҷмӯа бо ҳамин шиноса аз қабл ҳаст («{name}»), вале омӯзбаргҳо қариб мувофиқат намекунанд: муштарак {shared} аз {installed}. Шояд ин маҷмӯаи дигар бо ҳамон шиноса бошад. Агар насб кунед, омӯзбаргҳои «{name}», ки дар файли нав нестанд, пинҳон мешаванд. |
| `import.languageChanged` | У колоды другой изучаемый язык: {from} → {to}. | The learning language differs: {from} → {to}. | Забони омӯзиши маҷмӯа дигар аст: {from} → {to}. |
| `import.install` | Установить | Install | Насб |
| `import.installed` | Колода установлена | Deck installed | Маҷмӯа насб шуд |
| `import.updated` | Колода обновлена | Deck updated | Маҷмӯа барӯзрасонӣ шуд |
| `import.summary` | Новых: {added} · обновлено: {updated} · скрыто: {hidden} · вернулось: {restored} | New: {added} · updated: {updated} · hidden: {hidden} · back: {restored} | Нав: {added} · барӯзшуда: {updated} · пинҳоншуда: {hidden} · баргашта: {restored} |
| `import.failed` | Не удалось установить: {error} | Install failed: {error} | Насб нашуд: {error} |
| `settings.title` | Настройки | Settings | Танзимот |
| `settings.uiLang` | Язык интерфейса | Interface language | Забони барнома |
| `settings.meaningLang` | Язык значений | Meaning language | Забони маъноҳо |
| `settings.meaningHint` | Значения, подсказки и заметки записей показываются на этом языке; если его нет — на другом имеющемся. | Meanings, hints and notes are shown in this language; if an entry lacks it, in another available one. | Маъно, роҳнамо ва ёддошти омӯзбаргҳо бо ин забон нишон дода мешаванд; агар бо ин забон набошад — бо забони дигари мавҷуда. |
| `settings.newPerDay` | Новых записей в день | New entries per day | Омӯзбаргҳои нав дар як рӯз |
| `settings.recognition` | Распознавание речи | Speech recognition | Шинохти гуфтор |
| `settings.biasing` | Подсказки распознавателю (эксперимент) | Recognizer hints (experiment) | Вожаҳо барои шинохти гуфтор (озмоишӣ) |
| `settings.biasingHint` | Распознаватель получает слова ваших колод, чтобы лучше их узнавать. Работает не во всех браузерах. | The recognizer gets the words of your decks to recognise them better. Not every browser supports it. | Ба шинохти гуфтор вожаҳои маҷмӯаҳои шумо дода мешаванд, то онҳоро беҳтар шиносад. Дар ҳама мурургарҳо кор намекунад. |
| `settings.biasingRejected` | Этот браузер не принял подсказки — на этом устройстве они не отправляются. Чтобы попробовать снова, выключите и включите переключатель. | This browser rejected the hints, so they are not sent on this device. To try again, switch this off and on. | Ин мурургар вожаҳоро қабул накард — дар ин дастгоҳ онҳо фиристода намешаванд. Барои санҷиши дубора хомӯш ва боз фаъол кунед. |
| `settings.biasingNoApi` | Этот браузер не поддерживает подсказки распознавателю. | This browser does not support recognizer hints. | Ин мурургар вожаҳо барои шинохти гуфторро қабул намекунад. |
| `pack.available` | Распознавание на устройстве ({lang}): установлено. | On-device recognition ({lang}): installed. | Шинохт дар дастгоҳ ({lang}): насб шудааст. |
| `pack.downloadable` | Распознавание на устройстве ({lang}): можно скачать. | On-device recognition ({lang}): can be downloaded. | Шинохт дар дастгоҳ ({lang}): боргирӣ кардан мумкин аст. |
| `pack.downloading` | Распознавание на устройстве ({lang}): скачивается… | On-device recognition ({lang}): downloading… | Шинохт дар дастгоҳ ({lang}): боргирӣ мешавад… |
| `pack.unavailable` | Распознавание на устройстве ({lang}): для этого языка недоступно. | On-device recognition ({lang}): not available for this language. | Шинохт дар дастгоҳ ({lang}): барои ин забон дастрас нест. |
| `pack.unsupported` | Этот браузер не умеет распознавать на устройстве. | This browser has no on-device recognition. | Ин мурургар шинохт дар дастгоҳро надорад. |
| `pack.download` | Скачать {lang} для распознавания на устройстве | Download {lang} for on-device recognition | Боргирии забони {lang} барои шинохт дар дастгоҳ |
| `pack.failed` | Скачать не удалось. | The download failed. | Боргирӣ нашуд. |
| `settings.prototype` | Экран прототипа (со старым журналом) | Prototype screen (with the old journal) | Саҳифаи пешнамуна (бо таърихчаи қаблӣ) |
| `backup.title` | Резервная копия | Backup | Нусхаи пуштибон |
| `backup.hint` | Журнал ответов (весь прогресс) хранится только в этом браузере. Время от времени сохраняйте его в файл. | The answer journal (all your progress) lives only in this browser. Save it to a file from time to time. | Таърихчаи ҷавобҳо (ҳамаи пешрафт) танҳо дар ҳамин мурургар захира мешавад. Гоҳ-гоҳ онро дар файл захира кунед. |
| `backup.save` | Сохранить журнал в файл | Save the journal to a file | Захираи таърихча дар файл |
| `backup.restore` | Восстановить из файла | Restore from a file | Бозёбӣ аз файл |
| `backup.saved` | В файле записей: {n} | Records in the file: {n} | Дар файл сабтҳо: {n} |
| `backup.restored` | Добавлено: {added} · уже было: {skipped} | Added: {added} · already present: {skipped} | Илова шуд: {added} · қаблан буд: {skipped} |
| `backup.error.json` | Это не файл журнала «Маны». | This is not a Mana journal file. | Ин файли таърихчаи «Моно» нест. |
| `backup.error.version` | Файл из более новой версии приложения. Обновите приложение. | The file comes from a newer version of the app. Update the app. | Файл аз нусхаи навтари барнома аст. Барномаро барӯзрасонӣ кунед. |
| `backup.error.records` | Файл повреждён: часть записей не читается. Ничего не добавлено. | The file is damaged: some records cannot be read. Nothing was added. | Файл осеб дидааст: баъзе сабтҳо хонда намешаванд. Ҳеҷ чиз илова нашуд. |
| `backup.error.otherUser` | Файл другого пользователя, а здесь уже есть свои ответы. Объединение появится на этапе синхронизации. | The file belongs to another user, and this browser already has its own answers. Merging comes with sync. | Файл ба корбари дигар тааллуқ дорад, вале дар ин ҷо аз қабл ҷавобҳои худатон ҳаст. Якҷоя кардан дар марҳилаи ҳамгомсозӣ илова мешавад. |
| `backup.error.failed` | Ошибка: {error} | Error: {error} | Хато: {error} |
| `storage.title` | Хранилище | Storage | Захирагоҳ |
| `storage.persisted` | Постоянное: браузер не удалит данные сам. | Persistent: the browser will not clear the data on its own. | Доимӣ: мурургар додаҳоро худ аз худ пок намекунад. |
| `storage.notPersisted` | При нехватке места браузер может удалить данные. Сохраняйте резервную копию. | The browser may clear the data when space runs low. Keep a backup. | Ҳангоми камбуди ҷой мурургар метавонад додаҳоро пок кунад. Нусхаи пуштибон гиред. |
| `storage.unsupported` | Браузер не сообщает, как хранит данные. | The browser does not report how it keeps the data. | Мурургар дар бораи захирагоҳ маълумот намедиҳад. |
| `storage.request` | Запросить постоянное хранилище | Request persistent storage | Дархости захирагоҳи доимӣ |

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
