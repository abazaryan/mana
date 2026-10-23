# Мана

Название приложения: **Mana** (английский) · **Мана** (русский) · **Моно** (таджикский) · **مانا** (персидский). Решение — Р20 в [docs/DECISIONS.md](docs/DECISIONS.md).

Карточки с голосовым ответом: интервальные повторения, где оценка выставляется автоматически по правильности ответа. Время до начала ответа записывается в журнал, но оценку не определяет (решение Р4).

- Решения владельца продукта: [docs/DECISIONS.md](docs/DECISIONS.md)
- Спецификация: [docs/SPEC.md](docs/SPEC.md)
- Состояние проекта: [docs/STATUS.md](docs/STATUS.md)
- Модель данных (IndexedDB): [docs/DATA_MODEL.md](docs/DATA_MODEL.md); таджикские строки интерфейса на проверку: [docs/I18N_TG.md](docs/I18N_TG.md)
- Формат колоды: [docs/DECK_FORMAT.md](docs/DECK_FORMAT.md); инструкция для ИИ, который готовит колоды: [docs/DECK_PROMPT.md](docs/DECK_PROMPT.md)
- Глоссарий таджикских терминов интерфейса: [docs/GLOSSARY_TG.md](docs/GLOSSARY_TG.md)
- Эксперимент по выбору распознавателя речи (результаты, правило выбора): [docs/RECOGNITION_EXPERIMENT.md](docs/RECOGNITION_EXPERIMENT.md)
- Прототип (исторический, под прежним названием «Слух»): [prototype/sluh.html](prototype/sluh.html)

## Команды

```bash
npm install
npm run dev     # локальный сервер
npm test        # юнит-тесты (Vitest)
npm run build   # проверка типов и сборка в dist/
npm run deck:check -- колода.zip   # проверить колоду до загрузки
npm run i18n:table   # обновить docs/I18N_TG.md после правки строк интерфейса
npm run glossary:terms   # обновить список отклонённых слов для проверки колоды после правки GLOSSARY_TG.md
npm run deck:test-speak  # собрать тестовую колоду decks/test-speak.zip
npm run icons   # пересобрать PNG-иконки из public/icon.svg и public/icons/maskable.svg
```

## Структура

- `src/core/` — чистая логика: сверка ответа (по звучанию и письменная), оценка, состав порции, формат колоды, валидатор и проверки содержания (Р28), импорт колоды, модель данных, пересчёт FSRS из журнала, резервная копия.
- `src/platform/` — браузерные API: IndexedDB (Dexie), распознавание и синтез речи, аудио, микрофон.
- `src/ui/` — интерфейс на React (tg/ru/en).
- `scripts/` — инструменты вне приложения: проверка колоды, конвертер урока 1 из Anki, сборка тестовой колоды, таблицы для глоссария и переводов.

Приложение: **https://mana.amisipehr.workers.dev** — Cloudflare Workers, только статические файлы (Р32). Публикация — Workers Builds при каждом push в `main`: `npm test && npm run build`, затем `npx wrangler deploy`; при упавших тестах публикации нет. Настройки — [wrangler.jsonc](wrangler.jsonc), заголовки и CSP — [public/_headers](public/_headers), подключение в панели Cloudflare и установка на телефон — [docs/DEPLOY.md](docs/DEPLOY.md).

Старый адрес https://abazaryan.github.io/mana/ — только страница «переехала» со ссылкой ([pages-moved/index.html](pages-moved/index.html), `.github/workflows/deploy.yml`).
