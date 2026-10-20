# Публикация на Cloudflare

Сайт — только статические файлы (`dist/`), без кода Worker (Р32). После подключения каждый
`git push` в `main` запускает тесты и сборку; если всё прошло — публикует новую версию
на `https://mana.amisipehr.workers.dev` (Workers Builds). Если тесты упали — публикации нет,
на сайте остаётся прежняя версия.

Пометка **(?)** — точное название кнопки или пункта не проверено: интерфейс Cloudflare часто
меняется. Ищи по смыслу; рядом написано, что там должно быть. Шаги повторяют подключение
Rechenwege — там всё это уже проходили.

## 1. Дать Cloudflare доступ к репозиторию `mana`

GitHub-приложение «Cloudflare Workers and Pages» уже установлено для Rechenwege, но, скорее
всего, только для одного репозитория.

1. Открыть <https://github.com/settings/installations> → **Cloudflare Workers and Pages** →
   **Configure**.
2. **Repository access** → оставить **Only select repositories** → **Select repositories** →
   добавить `abazaryan/mana` (к `rechenwege`) → **Save**.

Если на шаге 2.4 ниже `mana` всё равно не видно — вернуться сюда и проверить, что он в списке.

## 2. Создать Worker `mana`

1. Войти на <https://dash.cloudflare.com> (аккаунт `amisipehr`, бесплатный тариф).
2. Слева: **Compute (Workers)** → **Workers & Pages** **(?)**.
3. **Create application** (или **Create**) **(?)**.
4. Вариант **Workers** (не Pages!) → **Import a repository** **(?)** → GitHub-аккаунт
   `abazaryan` → выбрать `mana`.
5. Параметры (экран «Set up your application» / «Configure» **(?)**):

   | Поле                                                   | Значение                                                                    |
   | ------------------------------------------------------ | --------------------------------------------------------------------------- |
   | Project name / Worker name                             | `mana` — **ровно так**, как `name` в `wrangler.jsonc`, иначе сборка упадёт |
   | Production branch / Git branch                         | `main`                                                                      |
   | Build command                                          | `npm test && npm run build` — **с тестами**; Cloudflare может подставить просто `npm run build`, заменить |
   | Deploy command                                         | `npx wrangler deploy` (обычно уже подставлено)                              |
   | Non-production branch deploy command / Preview command | оставить по умолчанию (см. п. 6)                                            |
   | Root directory (Path)                                  | пусто или `/`                                                               |
   | Build variables                                        | `WRANGLER_SEND_METRICS` = `false` (см. п. 8)                                |
   | API token                                              | не трогать — Cloudflare создаст сам                                         |

6. **Advanced settings** **(?)** → снять галочку **Builds for non-production branches** **(?)**:
   нужен только `main`. Если пропустить — не страшно: превью-адреса в `wrangler.jsonc`
   выключены (`preview_urls: false`).
7. **Deploy** / **Save and Deploy** **(?)**. Первая сборка — 1–3 минуты, лог виден на экране.
   В логе должны быть строки тестов (`Test Files … passed`), затем сборка и в конце
   `Deployed mana` с адресом сайта.
8. Если переменную `WRANGLER_SEND_METRICS` не удалось задать в п. 5: Worker `mana` →
   **Settings** → раздел **Build** → **Variables and secrets** **(?)** (переменные _сборки_, не
   «Variables and Secrets» в разделе **Runtime**) → **+ Add** → Type **Text**, имя
   `WRANGLER_SEND_METRICS`, значение `false` → **Save**. Действует со следующей сборки
   (**Deployments** → **Retry build** **(?)**).

**Не включать:** Web Analytics, Observability / Logs, Rocket Loader, Email obfuscation — это
сторонние скрипты или сбор данных; CSP приложения их всё равно заблокирует.

## 3. Адрес сайта

Worker `mana` → **Settings** → **Domains & Routes** **(?)**: строка `workers.dev` с адресом
`https://mana.amisipehr.workers.dev`. Строку **Preview URLs** не включать.

Если адреса нет («No URLs enabled»): у строки `workers.dev` нажать **Enable** **(?)**. В
`wrangler.jsonc` стоит `"workers_dev": true`, поэтому следующие публикации его не выключат.
Если не помогло — посмотреть лог последней сборки (**Deployments** / **Builds** **(?)**):
сборка могла упасть, тогда публикации не было.

После этого написать мне в чат — дальше я сам проверяю сайт с ноутбука (заголовки,
консоль, импорт, занятие, сохранение и восстановление журнала) и проверяю один раз, что
упавшие тесты не публикуются.

## 4. Как приходят обновления

Ничего делать не нужно. После `git push` в `main` Cloudflare запускает тесты и сборку,
через 1–3 минуты новая версия на сайте. У коммита на GitHub появляется значок проверки
(галочка или крестик); **Details** ведёт к логу сборки.

Если сборка упала: на сайте остаётся прежняя версия. Чаще всего причина — упавший тест или
ошибка сборки (их же покажут `npm test` и `npm run build` локально) или несовпадение имени
Worker и `name` в `wrangler.jsonc`.

Старый сайт `abazaryan.github.io/mana/` до подтверждения переезда тоже обновляется из `main`
(GitHub Actions, `.github/workflows/deploy.yml`).

### Предупреждения в логе сборки

- `npm warn allow-scripts … esbuild, workerd` — в `package.json` записано
  `allowScripts: { "esbuild": false, "workerd": false }`: install-скрипты этих пакетов только
  скачивают или проверяют программы, которые нужны для `wrangler dev`, но не для сборки и
  публикации (так же в Rechenwege, его решение D-8).
- `Some chunks are larger than 500 kB` — предупреждение Vite о размере файла приложения, не
  ошибка; было и на GitHub Pages.

## 5. Установить на телефон (Android, Chrome)

1. Открыть `https://mana.amisipehr.workers.dev` в **Chrome**, коснуться страницы и побыть на
   ней секунд 30 (условие Chrome).
2. Меню **⋮** → **«Установить приложение»** **(?)** → **«Установить»**. Если в меню только
   «Добавить на главный экран» — выбрать его, а в появившемся окне — **«Установить»**, не
   «Создать ярлык».
3. На главном экране и в списке приложений появится «Mana» (буква M). Приложение открывается
   без адресной строки.

Установленное приложение и вкладка Chrome — один и тот же сайт: данные, разрешение микрофона
и хранилище общие. Обновления приходят сами при каждом запуске (с интернетом). Без интернета
приложение пока не работает — покажется страница Chrome «нет подключения» (работа без сети —
этап 7).

Старый адрес `abazaryan.github.io/mana/` установить нельзя — так задумано (Р32 п. 9).

Иконки: исходники `public/icon.svg` и `public/icons/maskable.svg`; PNG пересобирает
`npm run icons` (Edge без окна). Поле `id` в `public/manifest.webmanifest` не менять (Р32 п. 10).

## 6. Данные на новом адресе

IndexedDB привязана к адресу: на `mana.amisipehr.workers.dev` база пустая, разрешение
микрофона и постоянное хранилище браузер спросит заново. Перенос журнала — по чек-листу в
`docs/STATUS.md` (шаг 6.0).

**Не делать:** «Очистить данные сайта» в настройках Chrome для нового адреса — это сотрёт
журнал. До этапа 6а сохранять журнал в файл раз в несколько дней.
