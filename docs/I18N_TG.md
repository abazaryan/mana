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
| `decks.import` | Импорт колоды (ZIP или JSON) | Import a deck (ZIP or JSON) | Дарунрезии маҷмӯа (ZIP ё JSON) |
| `decks.entries` | Записей: {n} | Entries: {n} | Омӯзбаргҳо: {n} |
| `decks.revision` | Редакция: {n} | Revision: {n} | Нусха: {n} |
| `decks.audio` | Аудио: {mb} МБ | Audio: {mb} MB | Садо: {mb} МБ |
| `deck.dueToday` | К повторению сегодня: {n} | Due today: {n} | Имрӯз барои такрор: {n} |
| `deck.dueNew` |  · новых: {m} |  · new: {m} |  · нав: {m} |
| `deck.overdue` | С прошлых дней: {n} — новые записи после них | From earlier days: {n} — new entries after them | Аз рӯзҳои гузашта: {n} — омӯзбаргҳои нав баъд аз онҳо |
| `deck.overdueIn` | В колоде «{deck}» с прошлых дней: {n} — новые записи после них | In “{deck}”: {n} from earlier days — new entries after them | Дар маҷмӯаи «{deck}» аз рӯзҳои гузашта: {n} — омӯзбаргҳои нав баъд аз онҳо |
| `deck.hidden` | Скрыто: {n} — нет в новой редакции, их прогресс сохранён. | Hidden: {n} — not in the new revision; their progress is kept. | Пинҳон: {n} — дар нусхаи нав нестанд, пешрафташон ҳифз шудааст. |
| `deck.play` | Слушать | Play | Пахш |
| `deck.contents` | Записи ({n}) | Entries ({n}) | Омӯзбаргҳо ({n}) |
| `deck.audioError` | Не удалось воспроизвести аудио. | Could not play the audio. | Садо пахш нашуд. |
| `deck.notFound` | Колода не найдена. | Deck not found. | Маҷмӯа ёфт нашуд. |
| `deck.delete` | Удалить колоду | Delete deck | Пок кардани маҷмӯа |
| `deck.deleteTitle` | Удалить колоду? | Delete this deck? | Маҷмӯа пок шавад? |
| `deck.deleteText` | Колода «{name}» с записями и звуком будет удалена с этого устройства. Журнал занятий остаётся: если установить эту колоду снова, прогресс вернётся. Для повторной установки нужен файл или текст колоды. | “{name}” will be deleted from this device with its entries and audio. The study log is kept: if you install this deck again, your progress comes back. To install it again you need the deck file or text. | «{name}» бо омӯзбаргҳо ва файлҳои садо аз ин дастгоҳ пок мешавад. Таърихчаи тамрин мемонад: агар ҳамин маҷмӯаро дубора насб кунед, пешрафт бармегардад. Барои насби дубора файл ё матни маҷмӯа лозим аст. |
| `deck.deleteConfirm` | Удалить | Delete | Пок кардан |
| `skill.listen` | слушать | listen | гӯш додан |
| `skill.speak` | говорить | speak | гуфтан |
| `skill.write` | писать | write | навиштан |
| `common.next` | Дальше | Next | Баъдӣ |
| `study.start` | Заниматься | Study | Тамрин |
| `study.progress` | {i} из {n} | {i} of {n} | {i} аз {n} |
| `study.nothing` | Сейчас повторять нечего. | Nothing to review right now. | Ҳоло чизе барои такрор нест. |
| `study.noNew.noMaterial` | Новых записей в колоде не осталось. | No new entries left in this deck. | Дар ин маҷмӯа омӯзбарги нав намонд. |
| `study.noNew.dailyLimit` | На сегодня новых больше нет: дневной лимит исчерпан. | No more new cards today: daily limit reached. | Саҳмияи имрӯзи омӯзбаргҳои нав тамом шуд. |
| `study.noNew.portionFull` | Эту порцию заняли повторения; новые записи — в следующей. | Reviews filled this round; new entries come in the next one. | Ин даврро такрорҳо пур карданд; омӯзбаргҳои нав — дар даври дигар. |
| `study.done` | Порция пройдена | Round done | Давр тамом шуд |
| `study.more` | Ещё порция | Another round | Даври дигар |
| `study.introduced` | Знакомств: {n} | Introductions: {n} | Ошноӣ: {n} |
| `study.noNew.overdue` | Сначала — повторения с прошлых дней, потом новые записи. | Reviews from earlier days first, then new entries. | Аввал такрорҳои рӯзҳои гузашта, баъд омӯзбаргҳои нав. |
| `study.noNew.overdueIn` | Сначала — повторения с прошлых дней в колоде «{deck}»{more}, потом новые записи. | First the reviews from earlier days in “{deck}”{more}, then new entries. | Аввал такрорҳои рӯзҳои гузашта дар маҷмӯаи «{deck}»{more}, баъд омӯзбаргҳои нав. |
| `study.noNew.overdueMore` |  и ещё в {n} |  and {n} more |  ва {n} маҷмӯаи дигар |
| `study.addAnyway` | Всё равно добавить | Add anyway | Ба ҳар ҳол илова |
| `study.left.today` | Сегодня ещё: {n} | Still today: {n} | Имрӯз мондааст: {n} |
| `study.left.tomorrow` | Завтра: {n} | Tomorrow: {n} | Фардо: {n} |
| `study.left.week` | За 7 дней: {n} | Next 7 days: {n} | Дар 7 рӯзи оянда: {n} |
| `study.noLanguage` | Язык {lang} пока не поддерживается. | The language {lang} is not supported yet. | Барнома ҳанӯз бо забони {lang} кор намекунад. |
| `study.saveError` | Ответ не сохранён: {error} | The answer was not saved: {error} | Ҷавоб захира нашуд: {error} |
| `intro.label` | Знакомство | Introduction | Ошноӣ |
| `intro.echo` | Прочитайте вслух | Read it aloud | Бо садои баланд хонед |
| `intro.again` | Ещё раз | Once more | Бори дигар |
| `intro.skip` | Пропустить | Skip | Гузаштан |
| `speak.sayIn` | Скажите {inLang} | Say it {inLang} | {inLang} бигӯед |
| `speak.typeIn` | Напишите {inLang}… | Type it {inLang}… | {inLang} нависед… |
| `speak.type` | Написать | Type | Навиштан |
| `speak.check` | Проверить | Check | Санҷиш |
| `speak.dontKnow` | Не знаю | I don't know | Намедонам |
| `listen.say` | Скажите | Say it | Бигӯед |
| `listen.playing` | Слушайте… | Listen… | Гӯш диҳед… |
| `listen.replay` | Прослушать ещё раз | Play again | Такрор |
| `write.article` | Неверный артикль | Wrong article | Шиносвожаи нодуруст |
| `write.elision` | Нужна элизия: l' | Needs the elision: l' | Ин ҷо l' лозим аст |
| `study.returned` | Вернулась после «Снова» | Back after Again | Пас аз «Дубора» баргашт |
| `mic.start` | Говорить | Speak | Гуфтан |
| `mic.repeatHint` | Скажите слово 2–3 раза подряд | Say the word 2–3 times in a row | Вожаро ду-се бор пайи ҳам бигӯед |
| `mic.hint` | Нажмите и говорите | Tap and speak | Фишор диҳед ва бигӯед |
| `write.placeholder` | Напишите… | Type… | Нависед… |
| `kb.group` | Клавиатура | Keyboard | Сафҳакалид |
| `kb.shift` | Заглавная | Shift | Ҳарфи калон |
| `kb.backspace` | Стереть | Delete | Ҳазф |
| `kb.space` | Пробел | Space | Фосила |
| `kb.apostrophe` | Апостроф | Apostrophe | Апостроф |
| `kb.hyphen` | Дефис | Hyphen | Хати пайванд |
| `kb.hold` | удерживайте: {list} | hold for {list} | нигоҳ доред: {list} |
| `mic.starting` | Микрофон включается… | Starting the microphone… | Микрофон равшан мешавад… |
| `mic.unsupported` | Этот браузер не распознаёт речь — напишите ответ. | This browser has no speech recognition — type the answer. | Ин мурургар бозшиносии гуфторро надорад — ҷавобро нависед. |
| `mic.err.not-allowed` | Нет доступа к микрофону. Разрешите его для этого сайта. | No access to the microphone. Allow it for this site. | Иҷозати микрофон нест. Онро барои ин сайт иҷозат диҳед. |
| `mic.err.service-not-allowed` | Браузер не разрешил распознавание речи. | The browser did not allow speech recognition. | Мурургар бозшиносии гуфторро иҷозат надод. |
| `mic.err.audio-capture` | Микрофон не найден или занят другим приложением. | No microphone found, or another app is using it. | Микрофон ёфт нашуд ё барномаи дигар онро истифода мебарад. |
| `mic.err.network` | Для распознавания речи нужен интернет. | Speech recognition needs the internet. | Барои бозшиносии гуфтор интернет лозим аст. |
| `mic.err.no-speech` | Речь не услышана. | No speech heard. | Гуфтор шунида нашуд. |
| `mic.err.no-result` | Ничего не распознано. | Nothing recognised. | Чизе шунида нашуд. |
| `mic.err.language-not-supported` | Этот браузер не распознаёт этот язык. | This browser cannot recognise this language. | Бозшиносии гуфтор барои ин забон дар ин мурургар дар дастрас нест. |
| `mic.err.watchdog` | Микрофон не включился. | The microphone did not start. | Микрофон фаъол нашуд. |
| `mic.err.other` | Ошибка распознавания: {code} | Recognition error: {code} | Хатои бозшиносии гуфтор: {code} |
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
| `mark.punct` | знак препинания — на оценку не влияет | punctuation — doesn't affect the grade | нишонаи нигоришӣ — ба арзёбӣ таъсир надорад |
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
| `reason.correct-retried` | Верно, но не с первой попытки | Correct, but not on the first try | Дуруст, вале бо талоши дубора |
| `reason.listen-no-easy` | Верно и быстро | Correct and fast | Дуруст ва босуръат |
| `reason.correct-fast-twice` | Верно и быстро второй раз подряд | Correct and fast twice in a row | Дуруст ва босуръат, ду бор паёпай |
| `import.reading` | Читаю файл… | Reading the file… | Файл хонда мешавад… |
| `import.rejected` | Колода не принята | Deck not accepted | Маҷмӯа қабул нашуд |
| `import.authorNote` | Сообщения адресованы автору колоды. | The messages are in Russian — they are meant for the deck author. | Паёмҳо ба забони русӣ — онҳо барои муаллифи маҷмӯа навишта шудаанд. |
| `import.warnings` | Предупреждения: {n} | Warnings: {n} | Ҳушдорҳо: {n} |
| `import.checkTitle` | Итог проверки | Check result | Натиҷаи санҷиш |
| `import.clean` | Ошибок и предупреждений нет. | No errors or warnings. | Хато ва ҳушдор нест. |
| `import.willChange` | После установки: | After installing: | Пас аз насб: |
| `import.reinstall` | Редакция {rev} уже установлена. Переустановить? Прогресс и журнал не изменятся. | Revision {rev} is already installed. Reinstall it? Progress and the study log stay as they are. | Нусхаи {rev} қаблан насб шудааст. Дубора насб кунем? Пешрафт ва таърихчаи тамрин тағйир намеёбанд. |
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
| `settings.newPerDay` | Новых записей в день | New entries per day | Омӯзбаргҳои нав дар рӯз |
| `settings.recognition` | Распознавание речи | Speech recognition | Бозшиносии гуфтор |
| `settings.biasing` | Подсказки распознавателю (эксперимент) | Recognizer hints (experiment) | Вожаҳо барои бозшиносии гуфтор (озмоишӣ) |
| `settings.biasingHint` | Распознаватель получает слова ваших колод, чтобы лучше их узнавать. Работает не во всех браузерах. | The recognizer gets the words of your decks to recognise them better. Not every browser supports it. | Ба бозшиносии гуфтор вожаҳои маҷмӯаҳои шумо дода мешаванд, то онҳоро беҳтар бишносад. Дар ҳама мурургарҳо кор намекунад. |
| `settings.biasingRejected` | Этот браузер не принял подсказки — на этом устройстве они не отправляются. Чтобы попробовать снова, выключите и включите переключатель. | This browser rejected the hints, so they are not sent on this device. To try again, switch this off and on. | Ин мурургар вожаҳоро қабул накард — дар ин дастгоҳ онҳо фиристода намешаванд. Барои санҷиши дубора хомӯш ва дубора равшан кунед. |
| `settings.biasingNoApi` | Этот браузер не поддерживает подсказки распознавателю. | This browser does not support recognizer hints. | Ин мурургар вожаҳо барои бозшиносии гуфторро қабул намекунад. |
| `settings.systemKeyboard` | Системная клавиатура | System keyboard | Сафҳакалиди дастгоҳ |
| `settings.systemKeyboardHint` | Ответы вы набираете на клавиатуре телефона, а не на клавиатуре Маны. С экранным диктором так удобнее. В навыке «писать» клавиатура телефона может подсказать ответ. | You type answers on the phone's keyboard instead of Mana's. Easier with a screen reader. In the “write” skill the phone's keyboard may suggest the answer. | Ҷавобҳоро бо сафҳакалиди дастгоҳ менависед, на бо сафҳакалиди Моно. Бо сафҳахон роҳаттар аст. Дар маҳорати «навиштан» сафҳакалиди дастгоҳ метавонад ҷавобро пешниҳод кунад. |
| `pack.available` | Распознавание на устройстве ({lang}): установлено. | On-device recognition ({lang}): installed. | Бозшиносӣ дар дастгоҳ ({lang}): насб шудааст. |
| `pack.downloadable` | Распознавание на устройстве ({lang}): можно скачать. | On-device recognition ({lang}): can be downloaded. | Бозшиносӣ дар дастгоҳ ({lang}): боргирӣ кардан мумкин аст. |
| `pack.downloading` | Распознавание на устройстве ({lang}): скачивается… | On-device recognition ({lang}): downloading… | Бозшиносӣ дар дастгоҳ ({lang}): боргирӣ мешавад… |
| `pack.unavailable` | Распознавание на устройстве ({lang}): для этого языка недоступно. | On-device recognition ({lang}): not available for this language. | Бозшиносӣ дар дастгоҳ ({lang}): барои ин забон дар дастрас нест. |
| `pack.unsupported` | Этот браузер не умеет распознавать на устройстве. | This browser has no on-device recognition. | Ин мурургар бозшиносӣ дар дастгоҳро надорад. |
| `pack.download` | Скачать {lang} для распознавания на устройстве | Download {lang} for on-device recognition | Боргирии забони {lang} барои бозшиносӣ дар дастгоҳ |
| `pack.failed` | Скачать не удалось. | The download failed. | Боргирӣ нашуд. |
| `decks.paste` | Вставить текст колоды | Paste deck text | Ҷойгузории матни маҷмӯа |
| `decks.makeWithAi` | Сделать колоду с ИИ | Make a deck with AI | Сохтани маҷмӯа бо ҳуши маснӯӣ |
| `privacy.voice` | Голосовой ответ распознаёт браузер: Chrome отправляет звук в Google, Edge — в Microsoft. | Your browser recognises voice answers: Chrome sends the audio to Google, Edge to Microsoft. | Гуфтори шуморо мурургар бозшиносӣ мекунад: Chrome садоро ба Google мефиристад, Edge — ба Microsoft. |
| `paste.title` | Текст колоды | Deck text | Матни маҷмӯа |
| `paste.hint` | Вставьте сюда ответ ИИ с deck.json целиком. | Paste the answer of the AI with the whole deck.json here. | Ҷавоби ҳуши маснӯиро бо deck.json-и пурра ин ҷо ҷойгузорӣ кунед. |
| `import.notes` | Сведения: {n} | Notes: {n} | Маълумот: {n} |
| `import.fixFirst` | Лучше сначала исправить колоду: отдайте «Копию для ИИ» вашему ИИ. | Better fix the deck first: give the “Copy for the AI” to your AI. | Беҳтар аст аввал маҷмӯаро ислоҳ кунед: «Нусха барои ҳуши маснӯӣ»-ро ба ҳуши маснӯӣ диҳед. |
| `import.copyReport` | Копия для ИИ | Copy for the AI | Нусха барои ҳуши маснӯӣ |
| `common.copied` | Скопировано | Copied | Нусха гирифта шуд |
| `common.copyFailed` | Не удалось скопировать — выделите текст ниже вручную. | Could not copy — select the text below by hand. | Нусха гирифта нашуд — матни поёнро дастӣ интихоб кунед. |
| `prompt.step1` | Нажмите «Копировать инструкцию», вставьте текст в чат с ИИ (Claude, Gemini, ChatGPT) и отправьте. ИИ будет говорить по-русски; можно попросить другой язык. | Tap “Copy the instructions”, paste the text into a chat with an AI (Claude, Gemini, ChatGPT) and send it. The AI will talk in English; you can ask for another language. | «Нусхаи дастур»-ро фишор диҳед, матнро дар гуфтугӯ бо ҳуши маснӯӣ (Claude, Gemini, ChatGPT) ҷойгузорӣ кунед ва фиристед. Ҳуши маснӯӣ бо шумо ба забони русӣ гуфтугӯ мекунад; метавонед забони дигарро дархост кунед. |
| `prompt.step2` | ИИ сначала спросит: из чего делать колоду (тема, текст или фото страницы учебника), что из этого взять и сколько записей. | The AI asks first: what to make the deck from (a topic, a text or a photo of a textbook page), what to take from it and how many entries. | Ҳуши маснӯӣ аввал мепурсад: маҷмӯаро аз чӣ созад (мавзӯъ, матн ё акси саҳифаи китоби дарсӣ), чиро аз он гирад ва чанд омӯзбарг бошад. |
| `prompt.step3` | Затем ИИ покажет таблицу записей — проверьте её и напишите исправления. deck.json он даст только после вашего подтверждения. | Then the AI shows a table of the entries — check it and write your corrections. It gives deck.json only after you confirm. | Баъд ҳуши маснӯӣ ҷадвали омӯзбаргҳоро нишон медиҳад — онро санҷед ва ислоҳҳоро нависед. deck.json-ро танҳо пас аз таъйиди шумо медиҳад. |
| `prompt.step4` | Ответ ИИ вставьте в «Ману»: «Вставить текст колоды». Если проверка найдёт ошибки или предупреждения — «Копия для ИИ», вставьте её ИИ и попросите исправить. | Paste the answer of the AI into Mana: “Paste deck text”. If the check finds errors or warnings — “Copy for the AI”, paste it to the AI and ask it to fix them. | Ҷавоби ҳуши маснӯиро дар «Моно» ҷойгузорӣ кунед: «Ҷойгузории матни маҷмӯа». Агар санҷиш хато ё ҳушдор ёбад — «Нусха барои ҳуши маснӯӣ»-ро фишор диҳед, дар гуфтугӯ ҷойгузорӣ кунед ва дархост кунед, ки ислоҳ кунад. |
| `prompt.step5` | Звук необязателен: без него карточки прочитает голос браузера. | Audio is optional: without it the browser voice reads the cards. | Файли садо ихтиёрӣ аст: бе он омӯзбаргҳоро садои мурургар мехонад. |
| `prompt.personal` | За содержание своей колоды отвечаете вы. Если верный ответ засчитан как неверный — исправьте колоду с ИИ. | You are responsible for the content of your deck. If a correct answer is marked wrong, fix the deck with the AI. | Масъули муҳтавои маҷмӯаи худ шумо ҳастед. Агар ҷавоби дуруст нодуруст ҳисоб шавад, маҷмӯаро бо ҳуши маснӯӣ ислоҳ кунед. |
| `prompt.copy` | Копировать инструкцию | Copy the instructions | Нусхаи дастур |
| `voice.title` | Проверка голоса | Voice check | Санҷиши садо |
| `voice.intro` | Карточки без звука колоды читает голос браузера. Нажмите «Слушать» и послушайте. | The browser voice reads cards without deck audio. Tap Play and listen. | Омӯзбаргҳои бе файли садоро садои мурургар мехонад. «Пахш»-ро фишор диҳед ва гӯш диҳед. |
| `voice.heard` | Слышен голос? | Did you hear the voice? | Садоро шунидед? |
| `voice.yes` | Да | Yes | Бале |
| `voice.no` | Нет | No | Не |
| `voice.ok` | Хорошо: на этом устройстве карточки «слушать» без звука колоды будут звучать голосом браузера. | Good: on this device, “listen” cards without deck audio will use the browser voice. | Дар ин дастгоҳ омӯзбаргҳои «гӯш додан» бе файли садо бо садои мурургар дода мешаванд. |
| `voice.none` | Браузер не находит на этом устройстве голоса этого языка. | The browser finds no voice for this language on this device. | Мурургар дар ин дастгоҳ садои ин забонро намеёбад. |
| `voice.howAndroid` | Android — Настройки → Специальные возможности (или Система → Язык и ввод) → Синтез речи → Google → Установить голосовые данные; по-английски — Settings → Accessibility (or System → Languages & input) → Text-to-speech → Google → Install voice data. Выберите язык и скачайте. Названия пунктов зависят от телефона. | Android — Settings → Accessibility (or System → Languages & input) → Text-to-speech → Google → Install voice data; in Russian — Настройки → Специальные возможности (или Система → Язык и ввод) → Синтез речи → Google → Установить голосовые данные. Pick the language and download it. Item names differ between phones. | Android — Settings → Accessibility (ё System → Languages & input) → Text-to-speech → Google → Install voice data; бо русӣ — Настройки → Специальные возможности (ё Система → Язык и ввод) → Синтез речи → Google → Установить голосовые данные. Забонро интихоб ва боргирӣ кунед. Номи бандҳо дар ҳар телефон дигар аст. |
| `voice.howWindows` | Windows — Параметры → Время и язык → Речь → Добавить голоса; по-английски — Settings → Time & language → Speech → Add voices. Выберите язык, затем перезапустите Edge. | Windows — Settings → Time & language → Speech → Add voices; in Russian — Параметры → Время и язык → Речь → Добавить голоса. Pick the language, then restart Edge. | Windows — Settings → Time & language → Speech → Add voices; бо русӣ — Параметры → Время и язык → Речь → Добавить голоса. Забонро интихоб кунед, баъд Edge-ро аз нав кушоед. |
| `voice.howOther` | Установите голос этого языка в настройках устройства (Синтез речи / Text-to-speech). iPhone — позже. | Install a voice for this language in the device settings (Text-to-speech). iPhone comes later. | Садои ин забонро дар танзимоти дастгоҳ (Text-to-speech) насб кунед. iPhone — баъдтар. |
| `voice.rule` | Если голоса этого языка на устройстве нет совсем, карточки «слушать» без звука колоды не выдаются. | If the device has no voice for this language at all, “listen” cards without deck audio are not given. | Агар дар дастгоҳ садои ин забон умуман набошад, омӯзбаргҳои «гӯш додан» бе файли садо дода намешаванд. |
| `voice.state.yes` | Проверено: слышно | Checked: works | Санҷида шуд: садо ҳаст |
| `voice.state.no` | Проверено: не слышно | Checked: not heard | Санҷида шуд: садо нест |
| `voice.state.none` | Не проверено | Not checked | Санҷида нашудааст |
| `settings.voice` | Голос браузера | Browser voice | Садои мурургар |
| `settings.voiceHint` | Для карточек без звука колоды. | For cards without deck audio. | Барои омӯзбаргҳои бе файли садо. |
| `backup.title` | Резервная копия | Backup | Нусхаи пуштибон |
| `backup.hint` | Журнал занятий (весь прогресс) хранится только в этом браузере. Время от времени сохраняйте его в файл. | The study log (all your progress) lives only in this browser. Save it to a file from time to time. | Таърихчаи тамрин (ҳамаи пешрафт) танҳо дар ҳамин мурургар захира мешавад. Гоҳ-гоҳ онро дар файл захира кунед. |
| `backup.save` | Сохранить журнал в файл | Save the study log to a file | Захираи таърихча дар файл |
| `backup.restore` | Восстановить из файла | Restore from a file | Бозёбӣ аз файл |
| `backup.saved` | В файле записей: {n} | Records in the file: {n} | Дар файл сабтҳо: {n} |
| `backup.restored` | Добавлено: {added} · уже было: {skipped} | Added: {added} · already present: {skipped} | Илова шуд: {added} · қаблан буд: {skipped} |
| `backup.error.json` | Это не файл журнала «Маны». | This is not a Mana study log file. | Ин файли таърихчаи «Моно» нест. |
| `backup.error.version` | Файл из более новой версии приложения. Обновите приложение. | The file comes from a newer version of the app. Update the app. | Файл аз нусхаи навтари барнома аст. Барномаро барӯзрасонӣ кунед. |
| `backup.error.records` | Файл повреждён: часть записей не читается. Ничего не добавлено. | The file is damaged: some records cannot be read. Nothing was added. | Файл осеб дидааст: баъзе сабтҳо хонда намешаванд. Ҳеҷ чиз илова нашуд. |
| `backup.error.otherUser` | Файл другого пользователя, а здесь уже есть свои ответы. Объединение появится на этапе синхронизации. | The file belongs to another user, and this browser already has its own answers. Merging comes with sync. | Файл ба корбари дигар тааллуқ дорад, вале дар ин ҷо аз қабл ҷавобҳои худатон ҳаст. Якҷоя кардан дар марҳилаи ҳамгомсозӣ илова мешавад. |
| `restore.confirmOther` | Этот журнал — с другой установки приложения. Добавить его в аккаунт? | This study log comes from another installation of the app. Add it to your account? | Ин таърихчаи насби дигар аст. Ба ҳисоб илова шавад? |
| `restore.confirmOtherHint` | Его ответы появятся на всех ваших устройствах и могут изменить сроки повторений. | Its answers will appear on all your devices and may change review dates. | Ҷавобҳои он дар ҳамаи дастгоҳҳоятон пайдо мешаванд ва метавонанд вақти такрорҳоро тағйир диҳанд. |
| `restore.needsNetwork` | Чтобы добавить журнал другой установки, нужен интернет. Попробуйте позже. | Adding the study log of another installation needs an internet connection. Try again later. | Барои илова кардани таърихчаи насби дигар интернет лозим аст. Баъдтар дубора талош кунед. |
| `restore.otherAccount` | Этот журнал принадлежит другому аккаунту — в этот аккаунт его добавить нельзя. | This study log belongs to another account and can't be added to this one. | Ин таърихча ба ҳисоби дигар тааллуқ дорад ва ба ин ҳисоб илова намешавад. |
| `backup.error.failed` | Ошибка: {error} | Error: {error} | Хато: {error} |
| `migrate.title` | Правила повторений обновлены | Review rules updated | Қоидаҳои такрор барӯз шуданд |
| `migrate.text` | Сроки повторений пересчитаются по новым правилам. Сначала журнал сохранится в файл — на всякий случай; сам журнал не меняется. | Review dates will be recalculated with the new rules. First the study log is saved to a file, just in case; the log itself does not change. | Вақти такрорҳо бо қоидаҳои нав аз нав ҳисоб мешавад. Аввал таърихча дар файл захира мешавад — барои эҳтиёт; худи таърихча тағйир намеёбад. |
| `migrate.go` | Сохранить и продолжить | Save and continue | Захира ва идома |
| `storage.title` | Хранилище | Storage | Захирагоҳ |
| `storage.persisted` | Постоянное: браузер не удалит данные сам. | Persistent: the browser will not clear the data on its own. | Доимӣ: мурургар додаҳоро худ аз худ пок намекунад. |
| `storage.notPersisted` | При нехватке места браузер может удалить данные. Сохраняйте резервную копию. | The browser may clear the data when space runs low. Keep a backup. | Ҳангоми камбуди ҷой мурургар метавонад додаҳоро пок кунад. Нусхаи пуштибон гиред. |
| `storage.unsupported` | Браузер не сообщает, как хранит данные. | The browser does not report how it keeps the data. | Мурургар дар бораи захирагоҳ маълумот намедиҳад. |
| `storage.request` | Запросить постоянное хранилище | Request persistent storage | Дархости захирагоҳи доимӣ |
| `account.title` | Аккаунт | Account | Ҳисоби корбарӣ |
| `account.signedOut` | Вы не вошли в аккаунт. Войдите, чтобы прогресс был на всех ваших устройствах. | You are not signed in. Sign in to have your progress on all your devices. | Шумо ба ҳисоб ворид нашудаед. Бо ҳисоб ворид шавед, то пешрафтатон дар ҳамаи дастгоҳҳоятон дар дастрас бошад. |
| `account.haveCode` | У меня есть код | I have a code | Код дорам |
| `account.signedIn` | Вы вошли в аккаунт. | You are signed in. | Шумо ба ҳисоб ворид шудаед. |
| `account.deviceName` | Имя этого устройства | Name of this device | Номи ин дастгоҳ |
| `account.save` | Сохранить | Save | Захира |
| `account.devices` | Устройства | Devices | Дастгоҳҳо |
| `account.thisDevice` | (это устройство) | (this device) | (ин дастгоҳ) |
| `account.lastSeen` | Последний раз на связи: {date} | Last seen: {date} | Охирин боздид: {date} |
| `account.remove` | Убрать | Remove | Ҳазф |
| `account.removeConfirm` | Убрать «{name}» из аккаунта? Данные на нём останутся, но для нового входа понадобится приглашение или код. | Remove “{name}” from the account? Its data stays on it, but signing in again will need an invitation or a code. | Дастгоҳи «{name}» аз ҳисоб ҳазф шавад? Додаҳояш дар худи он мемонанд, вале барои вуруди дубора даъватнома ё код лозим мешавад. |
| `account.addDevice` | Добавить устройство | Add a device | Иловаи дастгоҳ |
| `account.codeHint` | На новом устройстве: Настройки → «У меня есть код» → введите этот код. Срабатывает один раз; осталось: {time} | On the new device: Settings → “I have a code” → enter this code. Works once; time left: {time} | Дар дастгоҳи нав: Танзимот → «Код дорам» → ин кодро ворид кунед. Код якбормасраф аст; {time} боқӣ мондааст. |
| `account.codeExpired` | Срок кода истёк. | The code has expired. | Код мунқазӣ шуд. |
| `account.newCode` | Новый код | New code | Коди нав |
| `account.signOut` | Выйти | Sign out | Хуруҷ |
| `account.signOutConfirm` | Выйти из аккаунта на этом устройстве? Данные на устройстве останутся. | Sign out on this device? The data on this device stays. | Дар ин дастгоҳ аз ҳисоб хориҷ мешавед? Додаҳо дар ин дастгоҳ мемонанд. |
| `account.signedOutBy` | Это устройство больше не в аккаунте: его убрали из аккаунта с другого устройства или им долго не пользовались. Данные на устройстве на месте. | This device is no longer signed in: it was removed from the account on another device or not used for a long time. The data on this device is still here. | Ин дастгоҳ дигар ба ҳисоб ворид нест: онро бо дастгоҳи дигар аз ҳисоб ҳазф карданд ё муддати зиёд истифода нашуд. Додаҳо дар ин дастгоҳ мемонанд. |
| `account.offline` | Сервер не отвечает. Попробуйте позже. | The server isn't responding. Try again later. | Сервер дар дастрас нест. Баъдтар дубора талош кунед. |
| `account.privacy` | Данные и конфиденциальность | Data and privacy | Додаҳо ва ҳарими хусусӣ |
| `sync.pending` | Ждут отправки: {n} | Waiting to be sent: {n} | Дар интизори ирсол: {n} |
| `sync.rejected` | Не приняты сервером: {n} | Not accepted by the server: {n} | Сервер рад кард: {n} |
| `sync.rejectedHint` | Они остались на этом устройстве и попадут в файл журнала. | They stay on this device and go into the study log file. | Онҳо дар ҳамин дастгоҳ мемонанд ва дар файли таърихчаи тамрин ҳам гунҷонида мешаванд. |
| `sync.last` | Последняя синхронизация: {date} | Last synced: {date} | Охирин ҳамгомсозӣ: {date} |
| `sync.never` | Ещё не синхронизировано | Not synced yet | Ҳанӯз ҳамгомсозӣ нашудааст |
| `update.title` | Нужно обновление | Update needed | Барӯзрасонӣ лозим аст |
| `update.text` | Ваши ответы сохранены. Эта версия приложения старше данных на сервере. Перезагрузите — загрузится новая версия. | Your answers are saved. This version of the app is older than the data on the server. Reload to get the new version. | Ҷавобҳоятон захира шудаанд. Ин нусхаи барнома кӯҳна шудааст. Саҳифаро дубора боргузорӣ кунед, то нусхаи нав кушода шавад. |
| `update.otherTab` | Приложение обновилось в другом окне. Перезагрузите эту страницу. | The app was updated in another window. Reload this page. | Барнома дар равзанаи дигар барӯз шуд. Саҳифаро дубора боргузорӣ кунед. |
| `update.reload` | Перезагрузить | Reload | Боргузории муҷаддад |
| `update.wait` | Новая версия ещё не пришла. Попробуйте через несколько минут. | The new version hasn't arrived yet. Try again in a few minutes. | Нусхаи нав ҳанӯз дар дастрас нест. Баъд аз чанд дақиқа дубора талош кунед. |
| `signin.title` | Вход | Sign in | Вуруд |
| `signin.label` | Ссылка-приглашение или код | Invitation link or code | Даъватнома ё код |
| `signin.hint` | Вставьте ссылку-приглашение из сообщения или введите код из 8 знаков с другого вашего устройства. | Paste the invitation link from the message or enter the 8-character code from your other device. | Даъватномаро аз паём ҷойгузорӣ кунед ё коди 8-нависаиро аз дастгоҳи дигаратон ворид кунед. |
| `signin.submit` | Войти | Sign in | Вуруд |
| `signin.invalid` | Приглашение или код не подходят: неверные, уже использованы или срок истёк. Попросите новые. | The invitation or code doesn't work: it is wrong, already used or expired. Ask for a new one. | Даъватнома ё код кор намекунад: нодуруст аст, аз қабл истифода шудааст ё мунқазӣ шудааст. Навашро дархост кунед. |
| `signin.tooMany` | Слишком много попыток. Попробуйте позже. | Too many attempts. Try again later. | Теъдоди талошҳо аз ҳад зиёд шуд. Баъдтар дубора талош кунед. |
| `transfer.question` | Добавить прогресс с этого устройства в аккаунт? | Add this device's progress to your account? | Пешрафти ин дастгоҳ ба ҳисобатон илова шавад? |
| `transfer.hint` | Ответы этого устройства уйдут в аккаунт и появятся на других ваших устройствах. Перед этим лучше сохранить журнал в файл. | This device's answers will go to your account and appear on your other devices. It's best to save the study log to a file first. | Ҷавобҳои ин дастгоҳ ба ҳисобатон фиристода мешаванд ва дар дастгоҳҳои дигаратон пайдо мешаванд. Беҳтар аст пеш аз ин таърихчаро дар файл захира кунед. |
| `transfer.declined` | Вы не вошли в аккаунт. Прогресс остаётся только на этом устройстве. Войти можно позже — по той же ссылке, пока она действует, или новым кодом. | You are not signed in. Your progress stays on this device only. You can sign in later with the same link while it is valid, or with a new code. | Шумо ба ҳисоб ворид нашудед. Пешрафт танҳо дар ҳамин дастгоҳ мемонад. Баъдтар метавонед ворид шавед — бо ҳамин даъватнома, то мунқазӣ нашудааст, ё бо коди нав. |
| `transfer.saving` | Прогресс добавляется в аккаунт… | Adding your progress to the account… | Пешрафт ба ҳисоб илова мешавад… |
| `transfer.done` | Прогресс этого устройства добавлен в аккаунт. Ответы отправляются — это может занять несколько минут. | This device's progress has been added to the account. The answers are being sent; this may take a few minutes. | Пешрафти ин дастгоҳ ба ҳисоб илова шуд. Ҷавобҳо фиристода мешаванд — ин метавонад чанд дақиқа вақт гирад. |
| `transfer.userTaken` | Прогресс этого устройства уже принадлежит другому аккаунту. Войдите в тот аккаунт — или сохраните журнал в файл и очистите данные сайта на этом устройстве. | This device's progress already belongs to another account. Sign in to that account, or save the study log to a file and clear this site's data on this device. | Пешрафти ин дастгоҳ аз қабл ба ҳисоби дигаре тааллуқ дорад. Ба он ҳисоб ворид шавед — ё таърихчаро дар файл захира кунед ва додаҳоро аз ин дастгоҳ пок кунед. |
| `signin.already` | Вы уже вошли в аккаунт на этом устройстве. | You are already signed in on this device. | Шумо дар ин дастгоҳ аз қабл ба ҳисоб ворид шудаед. |
| `signin.outdated` | Версия приложения устарела: закройте его и откройте снова. | This version of the app is out of date: close it and open it again. | Нусхаи барнома кӯҳна аст: онро бандед ва дубора кушоед. |
| `signin.done` | Вы вошли в аккаунт. | You are signed in. | Шумо ба ҳисоб ворид шудед. |
| `signin.error` | Что-то пошло не так. Попробуйте позже. | Something went wrong. Try again later. | Хатое рух дод. Баъдтар дубора талош кунед. |
| `join.title` | Приглашение | Invitation | Даъватнома |
| `join.agree` | Согласен(на) | I agree | Мувофиқам |
| `join.age` | Вам уже исполнилось 16 лет? | Are you 16 or older? | Шумо 16-сола шудаед? |
| `join.ageHint` | Если нет — нужно согласие родителя или опекуна, на этом же устройстве. | If not, a parent or guardian must agree, on this same device. | Агар не, ризояти яке аз волидайн ё сарпараст лозим аст — дар ҳамин дастгоҳ. |
| `join.parentHint` | Этот экран заполняет родитель или опекун. | A parent or guardian fills in this screen. | Ин саҳифаро яке аз волидайн ё сарпараст пур мекунад. |
| `join.parentMissing` | Напишите своё имя и подтвердите согласие. | Write your name and confirm your consent. | Номатонро нависед ва ризояти худро таъйид кунед. |
| `join.signIn` | Войти | Sign in | Вуруд |
| `join.deviceInvite` | Это приглашение — для входа этого устройства в ваш аккаунт. | This invitation signs this device in to your existing account. | Ин даъватнома барои ворид шудани ин дастгоҳ ба ҳисоби мавҷудаи шумост. |

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
