# Кириллица в коде: остаток

Снимок 23.10.2026, после части А. Правило — `CLAUDE.md`, «Кириллица в коде»; тест — `tests/no-cyrillic.test.ts`; явный список данных — `DATA_FILES` в `tests/support/cyrillic.ts`; потолок строк по файлам — `tests/support/cyrillic-legacy.ts`.

**Остаток: 101 строка в 12 файлах** (было 1033 строки в 103 файлах). Это только подписи интерфейса страницы-прототипа `#/prototype` (русская, этап 1): им нужны ключи в `strings.ts`, а значит таджикские тексты через чат терминологии — часть Б. Вид 1(б), 1(в), 1(г), виды 2, 3 и 4 закрыты.

## Что сделано в части А

| Вид | Было | Как закрыто |
| --- | --- | --- |
| 1(б) имена тестов | 73 строки | Перевод. Ссылки на решения: `Р25` → `R25` (в документах — кириллическая «Р», в коде — латинская «R»). |
| 1(в) внутренние сообщения | 1 | `glossaryTerms.ts`: ошибка на английском. |
| 1(г) данные | 42 | `src/core/cyrillicData.ts` (идентификаторы правил З1–З9 / Ч / Г, которые пишутся в журнал; регулярка грамматических пометок; заголовок раздела глоссария; подписи форм; тексты французского пакета; примерная колода прототипа; названия языков для инструкции ИИ). |
| 1(д) сообщения проверки колоды и отчёт для ИИ (по Р33 п. 15 русские) | 35 + 113 из вида 4 | `src/core/deckMessages.ts` — только таблица сообщений, без логики; `deckFormat.ts`, `deckContent.ts`, `deckReport.ts`, `deckArchive.ts` вызывают `M.<имя>(…)`. Текст сообщений не менялся (тесты на русские фразы прошли без правок). |
| Лаборатория (Р23) | 55 + 46 | Удалены `RecordLab.tsx`, `tools/lab/*`, маршрут `#/lab/record`, `core/lab.ts`, `lab.test.ts`, `platform/labDb.ts`, `labAudio.ts`. База IndexedDB `mana-lab` удаляется один раз при запуске (`src/platform/legacyCleanup.ts`, тест). |
| 2. Сообщения инструментов | 84 | `scripts/validate-deck.ts`, `glossary-terms.ts`, `i18n-table.ts`, `tools/admin/*` — на английском (метки `ERROR:` / `WARNING:` / `NOTE:` вместо русских; `docs/DECK_FORMAT.md` обновлён). Тексты тестовых колод — в `scripts/data/test-decks.ts` (данные). |
| 3. Комментарии | 342 | Перевод; `Р…` → `R…`, `К1/К2` → `K1/K2`, `В1…` → `V1…`, `З1…` → `Z1…`. |
| 4. Данные | 254 | `deckPrompt.ts` → `src/ui/deckPrompt/{rules,data}.{ru,en}.md` (вывод байт в байт тот же, проверено сравнением со старой версией для 9 сочетаний языков); `deckFormat.ts` → `deckMessages.ts`; `mana-deck.schema.json` — в явный список `DATA_FILES`. |

Откуда числа: в отчёте `STATUS.md` стояло 1037 строк в 107 файлах — это снимок до исправлений 6а.2 (`worker/config.ts`, `wrangler.jsonc`, `MainApp.tsx`, `Root.tsx`: −4 строки, −4 файла); сам `CYRILLIC_DEBT.md` уже говорил 1033. Тест в начале этой части насчитал те же 1033 строки в 103 файлах. Число 1135 из моего плана — ошибка: это длина файла-выгрузки (1033 строки + 103 строки-заголовка файлов), рост долга не было.

## Что осталось: вид 1(а), страница `#/prototype` (101 строка)

| Файл | Строк |
| --- | --- |
| `src/ui/StartScreen.tsx` | 22 |
| `src/core/trainer.ts` | 18 |
| `src/ui/CardScreen.tsx` | 15 |
| `src/ui/SettingsSheet.tsx` | 13 |
| `src/core/grade.ts` | 10 |
| `src/ui/LogSheet.tsx` | 6 |
| `src/ui/DoneScreen.tsx` | 5 |
| `src/ui/PrototypeApp.tsx` | 4 |
| `src/core/settings.ts` | 3 |
| `src/platform/device.ts` | 3 |
| `src/ui/Sheet.tsx` | 1 |
| `src/core/format.ts` | 1 |

Страница существует только по-русски. На неё ведут ссылки «Экран прототипа» на экране «Колоды» и в Настройках (`settings.prototype`). Журнал и настройки прототипа лежат в `localStorage` (`sluh.settings`, `sluh.log`), отдельно от основной базы IndexedDB, и в неё не переносятся (`STATUS.md`, этап 4.1; «migrate.text» — экран пересчёта правил Р29.7, к прототипу не относится). Решение для части Б: переводить страницу или удалить — см. вопрос в отчёте части А.

## Часть Б: список строк для чата терминологии (если страница остаётся)

Ключ-кандидат — предложение, «есть» — ключ уже в `strings.ts` (его tg-текст утверждён; смысл надо сверить с ситуацией). В таджикском интерфейсе эти строки **не видны**: страница по-русски. Ситуация — где показывается, что пользователь видит и делает.

### Шапка страницы (`PrototypeApp.tsx`)

| Ключ | Ситуация | ru | en |
| --- | --- | --- | --- |
| `nav.decks` (есть) | Ссылка слева вверху: возврат к списку колод основного приложения | ← Колоды | ← Decks |
| `proto.title` | Название страницы рядом со ссылкой; отличает её от основного приложения | Прототип | Prototype |
| `log.title` (есть, ru «Журнал занятий») | Кнопка справа вверху: открывает окно журнала страницы | Журнал | Log |
| `nav.settings` (есть) | Кнопка справа вверху: окно настроек страницы | Настройки | Settings |

### Стартовый экран (`StartScreen.tsx`)

| Ключ | Ситуация | ru | en |
| --- | --- | --- | --- |
| `proto.start.title` | Заголовок до начала серии | Отвечайте вслух | Answer aloud |
| `proto.start.intro` | Абзац под заголовком: что делает страница | Вы видите фразу по-русски и произносите перевод по-французски. Приложение слушает, сверяет ответ с эталоном и предлагает оценку по точности и скорости. | You see a phrase in Russian and say the translation in French. The app listens, compares your answer with the reference and suggests a grade by accuracy and speed. |
| `proto.diag.recognition` (+ `settings.recognition`) | Строка проверки «слово — значение»: умеет ли браузер распознавать речь | Распознавание речи — есть / нет | Speech recognition — yes / no |
| `proto.diag.secure` | Строка проверки: страница по https | Защищённое соединение — да / нет | Secure connection — yes / no |
| `proto.diag.voices` | Строка проверки: сколько французских голосов у браузера | Французские голоса для озвучки — число / не найдены | French voices for speech — number / none found |
| `proto.diag.framed` | Строка проверки: страница открыта внутри чужого окна (frame) | Страница во встроенном окне — да / нет | Page in an embedded window — yes / no |
| `proto.diag.micPolicy` | Строка проверки: разрешает ли встроенное окно микрофон | Микрофон разрешён в этом окне — да / нет | Microphone allowed in this window — yes / no |
| `proto.diag.micPermission` | Строка проверки: состояние разрешения микрофона | Доступ к микрофону — разрешён / запрещён / спросит | Microphone access — allowed / denied / will ask |
| `proto.noRecognition` | Абзац, если браузер не умеет распознавать | Этот браузер не поддерживает распознавание речи. Используйте Chrome или Edge, либо отвечайте текстом. | This browser does not support speech recognition. Use Chrome or Edge, or answer by typing. |
| `proto.embedded` | Абзац рядом со строками проверки, если страница во встроенном окне | Если микрофон не включится, откройте страницу по ссылке в отдельной вкладке браузера: во встроенном окне доступ к микрофону может быть заблокирован. | If the microphone does not start, open the page in a separate browser tab: in an embedded window microphone access may be blocked. |
| `proto.micTest` | Кнопка: пробное включение микрофона | Проверить микрофон | Test the microphone |
| `proto.micTesting` | Сообщение после нажатия, пока идёт проверка | Проверяю… | Checking… |
| `proto.micOk` | Сообщение после успешной проверки | Микрофон работает. Можно начинать. | The microphone works. You can start. |
| `proto.start` | Кнопка начала серии, с числом карточек (русское склонение: карточка / карточки / карточек) | Начать ({n} карточка / карточки / карточек) | Start ({n} cards) |
| `proto.testNote` | Абзац внизу экрана: зачем страница | Это проверочная версия: она нужна, чтобы выяснить, насколько хорошо браузер понимает ваш французский. После серии карточек откройте «Журнал», нажмите «Скопировать всё» и пришлите содержимое — по нему будут подобраны пороги оценок. | This is a test version: it shows how well the browser understands your French. After a series of cards open “Log”, press “Copy all” and send the content — the grade thresholds will be set from it. |

### Карточка (`CardScreen.tsx`)

| Ключ | Ситуация | ru | en |
| --- | --- | --- | --- |
| `study.progress` (есть) | Над карточкой: номер и число | {i} из {n} | {i} of {n} |
| `proto.card.repeat` | Кнопка в блоке микрофона после ошибки: запустить распознавание ещё раз | Повторить | Try again |
| `proto.card.dontKnow` | Кнопка под кругом микрофона: сдаться | Не знаю | I don't know |
| `proto.card.byVoice` / `proto.card.byText` | Кнопка переключения способа ответа | Ответить голосом / Ответить текстом | Answer by voice / Answer by typing |
| `proto.card.placeholder` | Подсказка в пустом поле для ответа текстом | Ответ по-французски | Answer in French |
| `proto.card.check` | Кнопка рядом с полем: проверить введённое | Проверить | Check |
| `proto.card.noAnswer` | После результата, если ответа не было | Вы не ответили. | You did not answer. |
| `proto.card.said` | После результата: подпись к тому, что услышал распознаватель | Вы сказали: | You said: |
| `proto.card.accuracy` / `.started` / `.total` | Три строки под результатом: точность, время до начала речи, общее время | Точность / Начало ответа / Всего | Accuracy / Time to start / Total |
| `proto.card.suggested` | Строка с предложенной оценкой и причиной | Предложено: {оценка} — {причина}. | Suggested: {grade} — {reason}. |
| `proto.card.gradesLabel` | Подпись группы четырёх кнопок оценки для экранных дикторов (на экране не видна) | Оценка карточки | Card grade |
| `proto.card.listen` | Кнопка: проиграть эталон | Послушать | Listen |
| `common.next` (есть) | Кнопка перехода к следующей карточке | Дальше | Next |

### Оценки и причины (`grade.ts`)

| Ключ | Ситуация | ru | en |
| --- | --- | --- | --- |
| `proto.grade.1…4` | Четыре кнопки оценки (в основном приложении — `rating.*`, там tg утверждён) | Снова / Трудно / Хорошо / Легко | Again / Hard / Good / Easy |
| `proto.reason.again` | Причина предложенной оценки «Снова» | точность {p}% ниже порога «Снова» | accuracy {p}% is below the “Again” threshold |
| `proto.reason.hard` | Причина оценки «Трудно» | точность {p}% ниже порога «Хорошо», {темп} | accuracy {p}% is below the “Good” threshold, {pace} |
| `proto.reason.speed` | Причина оценок по времени | точность {p}%, начали {темп} ({время}) | accuracy {p}%, started {pace} ({time}) |
| `proto.pace.fast` / `.normal` / `.slow` | Слово «темп» в причине | быстро / в обычном темпе / медленно | quickly / at a normal pace / slowly |
| `proto.unit.sec` | Единица в числах времени (1,2 с) | с | s |

### Состояние микрофона и ошибки распознавания (`trainer.ts`, `device.ts`)

| Ключ | Ситуация | ru | en |
| --- | --- | --- | --- |
| `proto.mic.starting` | Под кругом микрофона после нажатия | Включаю микрофон… | Starting the microphone… |
| `proto.mic.listening` | Пока слушает | Говорите | Speak |
| `proto.mic.heard` | Когда распознавание вернуло результат | Услышал | Heard |
| `proto.mic.typedMode` | Когда ответ переключён на текст | Режим ввода текстом | Typing mode |
| `proto.mic.unsupported` | Браузер не умеет распознавать | Распознавание речи не поддерживается. Отвечайте текстом. | Speech recognition is not supported. Answer by typing. |
| `proto.mic.startFailed` / `.micFailed` | Не удалось запустить / включить микрофон (второе — с подсказкой нажать «Повторить») | Не удалось запустить распознавание. / Не удалось включить микрофон. Нажмите «Повторить». | Could not start recognition. / Could not turn the microphone on. Press “Try again”. |
| `proto.mic.watchdog` | Микрофон не включился за 5 секунд | Микрофон не включился за 5 секунд. Скорее всего, браузер блокирует его в этом окне. Можно ответить текстом. | The microphone did not start in 5 seconds. The browser most likely blocks it in this window. You can answer by typing. |
| `proto.mic.err.*` (6 кодов: нет доступа, служба не разрешена, нет микрофона, сеть, нет речи, язык не поддерживается) | Сообщение под кругом после ошибки распознавателя | Нет доступа к микрофону. Разрешите его для этого сайта или откройте страницу в отдельной вкладке. / Браузер не разрешил службу распознавания. Откройте страницу в отдельной вкладке. / Микрофон не найден или занят другим приложением. / Нет связи со службой распознавания. Она работает только при подключении к интернету. / Речь не обнаружена. / Выбранный язык не поддерживается этим браузером. | (en — как в `mic.err.*`) |
| `proto.mic.err.other` / `.noResult` / `.stopped` | Другая ошибка с кодом / речь не распознана / остановлено | Ошибка распознавания: {code} / Речь не распознана. / Остановлено. | Recognition error: {code} / Speech was not recognised. / Stopped. |
| `proto.reason.dontKnow` | Причина оценки после «Не знаю» | вы отметили «Не знаю» | you pressed “I don't know” |
| `proto.mic.noAccess` | Проверка микрофона на стартовом экране: страница без доступа | На этой странице браузер не даёт доступа к микрофону. | The browser gives this page no access to the microphone. |
| `proto.mic.unavailable` | Проверка микрофона: ошибка с именем | Микрофон недоступен: {имя ошибки} ({текст}) | The microphone is unavailable: {error name} ({text}) |
| `proto.mic.errorWord` | Если у ошибки нет имени | ошибка | error |

### Конец серии (`DoneScreen.tsx`)

| Ключ | Ситуация | ru | en |
| --- | --- | --- | --- |
| `proto.done.title` | Заголовок после последней карточки | Серия окончена | Series finished |
| `proto.done.summary` | Абзац с итогами; `{p}` — средняя точность, `{t}` — среднее время до начала ответа | Средняя точность — {p}%, среднее время до начала ответа — {t}. Откройте журнал, скопируйте его и пришлите. | Average accuracy — {p}%, average time to start — {t}. Open the log, copy it and send it. |
| `proto.done.nodata` | Вместо итогов, если ответов не было | Нет данных. | No data. |
| `proto.done.again` | Кнопка: начать серию заново | Ещё раз | Once more |
| `proto.done.openLog` | Кнопка: открыть окно журнала | Открыть журнал | Open the log |

### Окно журнала (`LogSheet.tsx`)

| Ключ | Ситуация | ru | en |
| --- | --- | --- | --- |
| `log.title` (есть) | Заголовок окна | Журнал | Log |
| `proto.log.copied` | После нажатия «Скопировать всё», если копирование удалось | Скопировано: {n} записей. | Copied: {n} entries. |
| `proto.log.copyManual` | Если браузер не дал скопировать | Выделите текст ниже и скопируйте его вручную. | Select the text below and copy it by hand. |
| `proto.log.count` | Строка состояния, если записи есть | Записей: {n} | Entries: {n} |
| `proto.log.empty` | Строка состояния, если записей нет | Пока пусто. Пройдите хотя бы несколько карточек. | Empty so far. Go through a few cards first. |
| `proto.log.copyAll` | Кнопка | Скопировать всё | Copy all |
| `proto.log.clear` | Кнопка (стирает журнал страницы в браузере) | Очистить | Clear |
| `proto.log.noAnswer` | В строке записи, если ответа не было | без ответа | no answer |

### Окно настроек (`SettingsSheet.tsx`, `settings.ts`, `Sheet.tsx`)

| Ключ | Ситуация | ru | en |
| --- | --- | --- | --- |
| `nav.settings` (есть) | Заголовок окна | Настройки | Settings |
| `proto.set.lang` + 3 значения | Выбор языка распознавания и синтеза: французский (Франция / Бельгия / Канада) | Язык распознавания: Французский (Франция) / (Бельгия) / (Канада) | Recognition language: French (France) / (Belgium) / (Canada) |
| `proto.set.easy` / `.good` / `.again` / `.hard` | Четыре числовых поля порогов | «Легко», если начали за (с) / «Хорошо», если начали за (с) / «Снова», если точность ниже (%) / Не выше «Трудно», если ниже (%) | “Easy” if started within (s) / “Good” if started within (s) / “Again” if accuracy is below (%) / No higher than “Hard” if below (%) |
| `proto.set.thresholdsNote` | Абзац под порогами | Пороги времени заданы для фразы из 4 слов; на каждое слово сверх этого добавляется 0,3 с. Начальные значения — предположение, их нужно подобрать по вашему журналу. | Time thresholds are for a 4-word phrase; each extra word adds 0.3 s. The initial values are an assumption, to be tuned from your log. |
| `proto.set.lenient` | Флажок | Не различать é / è / ê и другие акценты при сверке | Ignore é / è / ê and other accents when comparing |
| `proto.set.autoSpeak` | Флажок | Проигрывать эталон после ответа | Play the reference after the answer |
| `proto.set.deck` | Подпись поля колоды страницы (одна карточка на строку) | Колода: по строке на карточку, «по-русски \| по-французски» | Deck: one card per line, “Russian \| French” |
| `proto.set.reset` / `proto.set.save` | Кнопки: вернуть примерную колоду / сохранить | Вернуть примеры / Сохранить | Restore the samples / Save |
| `common.close` (есть) | Кнопка закрытия окон; сейчас в `Sheet.tsx` значение по умолчанию «Закрыть» (в основном приложении всегда передаётся `common.close`) | Закрыть | Close |

## Вне проверки (не `.ts` / `.tsx` / `.js` / `.json`)

- `index.html`: `<title>` «Mana — отвечайте на карточки голосом» — название вкладки браузера, видно пользователю (одна строка; часть Б: нужен tg-вариант или нейтральное «Mana»).
- `scripts/convert_apkg.py` — разовый конвертер урока 1, 18 строк кириллицы; тест `.py` не смотрит.
- `README.md`, `docs/*.md`, `prototype/sluh.html`, `pages-moved/index.html` — документы и данные.
