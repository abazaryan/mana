# Слух

Карточки с голосовым ответом: интервальные повторения, где оценка выставляется автоматически по правильности ответа. Время до начала ответа записывается в журнал, но оценку не определяет (решение Р4).

- Решения владельца продукта: [docs/DECISIONS.md](docs/DECISIONS.md)
- Спецификация: [docs/SPEC.md](docs/SPEC.md)
- Состояние проекта: [docs/STATUS.md](docs/STATUS.md)
- Формат колоды: [docs/DECK_FORMAT.md](docs/DECK_FORMAT.md); инструкция для ИИ, который готовит колоды: [docs/DECK_PROMPT.md](docs/DECK_PROMPT.md)
- Прототип: [prototype/sluh.html](prototype/sluh.html)

## Команды

```bash
npm install
npm run dev     # локальный сервер
npm test        # юнит-тесты (Vitest)
npm run build   # проверка типов и сборка в dist/
npm run deck:check -- колода.zip   # проверить колоду до загрузки
```

## Структура

- `src/core/` — чистая логика: сверка ответа, оценка, формат колоды и валидатор, настройки, журнал, ход серии карточек.
- `src/platform/` — браузерные API: распознавание и синтез речи, localStorage, микрофон, буфер обмена.
- `src/ui/` — интерфейс на React.
- `scripts/` — инструменты вне приложения: проверка колоды, разовый конвертер урока из Anki.

Публикация — GitHub Pages через `.github/workflows/deploy.yml` при каждом push в `main`.
