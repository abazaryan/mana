# Кириллица в коде: долг закрыт

Закрыт 23.10.2026 (часть А — 23.10.2026, часть Б — в тот же день). Правило — `CLAUDE.md`, «Кириллица в коде»; тест — `tests/no-cyrillic.test.ts`; явный список файлов-данных — `DATA_FILES` в `tests/support/cyrillic.ts`; `LEGACY_LINES` в `tests/support/cyrillic-legacy.ts` **пуст**. Вне `DATA_FILES` кириллицы в `.ts`, `.tsx`, `.js`, `.json`, `.jsonc`, `.html`, `.css`, `.py`, `.webmanifest` нет (в тестах разрешены только строки и регулярные выражения с тестовыми данными, но не имена тестов и не комментарии).

Динамика: 1037 строк в 107 файлах (снимок до 6а.2; в `STATUS.md` стояло это число) → 1033 в 103 (начало части А) → 101 в 12 (конец части А, только страница `#/prototype`) → 0.

## Что сделано

| Вид | Было | Как закрыто |
| --- | --- | --- |
| 1(б) имена тестов | 73 | Перевод. Ссылки на решения: `Р25` → `R25` (в документах — кириллическая «Р», в коде — латинская «R»); К1/К2 → K1/K2, В1… → V1…, З1… → Z1…. |
| 1(в) внутренние сообщения | 1 | `glossaryTerms.ts`: ошибка на английском. |
| 1(г) данные | 42 | `src/core/cyrillicData.ts`: идентификаторы правил З1–З9 / Ч / Г (пишутся в журнал, не менялись), регулярка грамматических пометок, заголовок раздела глоссария, подписи форм, тексты французского пакета, названия языков для инструкции ИИ. |
| 1(д) сообщения проверки колоды и отчёт для ИИ (русские по Р33 п. 15) | 35 + 113 | `src/core/deckMessages.ts` — только таблица сообщений, без логики; текст не менялся. |
| 1(а) подписи страницы-прототипа | 101 | Страница удалена (Р38) вместе с кодом: строки исчезли, а не переведены. |
| Лаборатория (Р23) | 101 | Удалены `RecordLab.tsx`, `tools/lab/*`, маршрут, `core/lab.ts`, `labDb.ts`, `labAudio.ts`. База `mana-lab` удаляется один раз при запуске (`src/platform/legacyCleanup.ts`) и на странице старого адреса (`pages-moved/index.html`). |
| 2. Сообщения инструментов | 84 | На английском (`deck:check` печатает `ERROR:` / `WARNING:` / `NOTE:`). Тексты тестовых колод — `scripts/data/test-decks.ts`. |
| 3. Комментарии | 342 | Перевод. |
| 4. Данные | 254 | `src/ui/deckPrompt/*.md` (инструкция для ИИ, Р34), `deckMessages.ts`, `mana-deck.schema.json` — в `DATA_FILES`. |
| `index.html` | 1 | `<title>Mana</title>`, `<meta name="description" content="Mana">`. |
| `scripts/convert_apkg.py` | 18 | Сообщения и docstring на английском; кириллические данные урока 1 — `scripts/data/lesson1_apkg.py`. Результат на `apkg/fr_lesson_01.apkg` совпадает байт в байт с прежним. |
| `styles.css` | 4 | Комментарии на английском. |

## `DATA_FILES` (причины записаны в `tests/support/cyrillic.ts`)

`src/ui/strings.ts`, `src/core/tgDeckTerms.ts`, `src/core/cyrillicData.ts`, `src/core/deckMessages.ts`, `scripts/data/test-decks.ts`, `src/core/mana-deck.schema.json`, `scripts/data/lesson1_apkg.py`, `pages-moved/index.html`, `prototype/sluh.html`. Не сканируются документы (`*.md`, в т. ч. `src/ui/deckPrompt/*.md`).
