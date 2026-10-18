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
```

## Структура

- `src/core/` — чистая логика: сверка ответа (по звучанию и письменная), оценка, состав порции, формат колоды, валидатор и проверки содержания (Р28), импорт колоды, модель данных, пересчёт FSRS из журнала, резервная копия, ход серии карточек прототипа.
- `src/platform/` — браузерные API: IndexedDB (Dexie), распознавание и синтез речи, аудио, localStorage прототипа, микрофон, буфер обмена.
- `src/ui/` — интерфейс на React (tg/ru/en); экран прототипа — `#/prototype`.
- `scripts/` — инструменты вне приложения: проверка колоды, конвертер урока 1 из Anki, сборка тестовой колоды, таблицы для глоссария и переводов.

Публикация — GitHub Pages через `.github/workflows/deploy.yml` при каждом push в `main`.
