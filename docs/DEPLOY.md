# Публикация на Cloudflare

Один Worker `mana`: статические файлы сайта (`dist/`, Р32) и API `/api/*` (код — `worker/`,
с шага 6а.1, Р33 п. 2, Р36; раздел «Worker и API» ниже). После подключения каждый
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
   | API token                                              | при подключении — как предложит Cloudflare; с 6а.0 — `mana build token` (раздел «Токены и база D1») |

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

- `npm warn allow-scripts … esbuild` — в `package.json` записано
  `allowScripts: { "esbuild": false, "workerd": true }`. Скрипт `esbuild` только проверяет
  программу; сборке Worker он не нужен (проверено `wrangler deploy --dry-run`, 23.10.2026).
  Скрипт `workerd` разрешён с 6а.1 (Р33 п. 17): он проверяет программу для `wrangler dev`, а
  если пакета для системы нет — скачивает его той же версии с registry.npmjs.org.
- `wrangler types` (часть `npm run build`) пишет «Action required Install @types/node» — не
  нужно: Worker не использует Node.js API.
- `Some chunks are larger than 500 kB` — предупреждение Vite о размере файла приложения, не
  ошибка; было и на GitHub Pages.

## Токены и база D1 (этап 6а, шаг 6а.0)

Значения токенов нигде не записываются — ни здесь, ни в коммитах, ни в чате. Здесь — только
названия, права и сроки.

### Токен сборки «mana build token (Builds)»

Им Workers Builds публикует Worker `mana`. Общий «rechenwege build token» не менять и не
удалять: им публикуется Rechenwege. По документации изменённый или удалённый токен становится
«stale» и ломает сборку
([troubleshoot](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/)); на деле
правка прав токена Маны 22.10.2026 сборку не сломала (см. ниже), но удаление сломает точно.

**Как сделано 22.10.2026 (по факту, так и повторять):**

1. Worker `mana` → **Settings** → **Builds** → **API token** → **Create new token**.
   Токен из **My Profile → API Tokens** в этот список выбрать нельзя: Workers Builds показывает
   только токены, созданные через этот список (вопреки ожиданию по
   [builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)).
2. **Сразу сузить** в **My Profile** → **API Tokens** → этот токен → **Edit**. Автоматический
   токен получает около 27 прав, в том числе **D1 Edit, R2 Edit**, KV Edit, Secrets Store Edit,
   Queues, AI и права на все зоны (Email Routing Rules, Workers Routes, SSL and Certificates),
   без срока. **Без сужения нарушается Р33 п. 3** (токен сборки — без права на D1).
   Оставить шесть прав:

   | Группа  | Право            | Уровень |
   | ------- | ---------------- | ------- |
   | Account | Workers Scripts  | Edit    |
   | Account | Account Settings | Read    |
   | Account | Artifacts        | Edit    |
   | Account | Artifacts        | Read    |
   | User    | User Details     | Read    |
   | User    | Memberships      | Read    |

   **Account Resources:** аккаунт `amisipehr`; зон нет. **TTL:** 22.10.2026 – **31.10.2027**.
   Имя: `mana build token (Builds)`. Нужно ли Artifacts — не проверялось, оставлено.
3. Worker `mana` → **Deployments** → **Retry build** → должно быть **Ready**. 22.10.2026:
   Ready, активна версия `30cc13e7` — правка прав токен не сломала.

Ручной «mana build token» из My Profile (созданный по первому плану) удалён.

**Срок.** После 31.10.2027 публикация перестанет работать (сайт останется на прежней версии,
проверка на GitHub — красная). Заранее: пп. 1–3 заново, затем старый токен удалить.

**Если понадобится добавить право** (например, D1 Read, если сборка с привязкой D1 в 6а.1 упадёт
на доступе): правка в My Profile → Edit, затем **Retry build**; если сборка скажет, что токен
«stale», — выбрать его заново в Settings → Builds → API token.

**Откат:** в Settings → Builds → API token выбрать `rechenwege build token` → **Retry build**.

### Токен администратора «mana admin token»

Им я выполняю `wrangler d1 …` с ноутбука: создание базы, миграции, скрипты администратора.

1. **My Profile** → **API Tokens** → **Create Token** → **Create Custom Token**, имя
   `mana admin token`.
2. Права: **Account → D1 → Edit**; **Account Resources:** Include → `amisipehr`. Больше ничего.
   Право D1 действует на все базы аккаунта — сузить до одной базы нельзя. В 6б понадобится
   R2 — тогда новый токен с D1 Edit и R2 Edit.
3. **TTL:** до **30.04.2027**. IP-фильтр не задавать (домашний адрес меняется).
4. Значение вписать в `tools/.env` (файл вне git) в текстовом редакторе:
   `MANA_ADMIN_API_TOKEN=…` и `CLOUDFLARE_ACCOUNT_ID=…` (Account ID — на странице аккаунта
   или Workers & Pages, обычно справа **(?)**). Образец без значений — `tools/.env.example`.
5. **Замена** (до истечения или при подозрении на утечку): создать новый токен с теми же
   правами → заменить значение в `tools/.env` → `node tools/admin/check-token.ts` → удалить
   старый токен в панели.

Как пользоваться (только имена переменных, значения не печатаются):

- `node tools/admin/check-token.ts` — «есть / статус / срок»;
- `node tools/admin/wrangler.ts <команда wrangler>` — например, `d1 info mana`. Обёртка
  читает `tools/.env` сама, передаёт токен только дочернему `wrangler` как
  `CLOUDFLARE_API_TOKEN` (в своё окружение не копирует), выключает телеметрию, не даёт уровень
  логов `debug` и заменяет значение токена в выводе на `***`.
- Claude Code: `.claude/settings.json` запрещает инструментам чтения открывать `tools/.env`.

`tools/lab/check-cloudflare.ts` (лаборатория распознавания, Р23) читает
`CLOUDFLARE_API_TOKEN` и после перехода на `MANA_ADMIN_API_TOKEN` больше не работает.

### База D1

- Имя `mana`, юрисдикция **`eu`** — задаётся только при создании, изменить нельзя
  ([data location](https://developers.cloudflare.com/d1/configuration/data-location/)).
- Создана 22.10.2026 командой
  `node tools/admin/wrangler.ts d1 create mana --jurisdiction=eu --update-config=false`
  (подтверждена владельцем дословно).
- **`database_id`: `402d25f9-3390-45f4-9177-57621f470661`**. Это идентификатор, не секрет:
  без токена доступа к базе он не даёт; id ресурсов и аккаунта держат в публичном
  `wrangler.jsonc` ([обсуждение workers-sdk #7115](https://github.com/cloudflare/workers-sdk/discussions/7115);
  официальной страницы Cloudflare об этом нет).
- Юрисдикция видна в `node tools/admin/wrangler.ts d1 info mana --json` и `d1 list --json` —
  поле `"jurisdiction": "eu"`; `running_in_region` — `EEUR` (место внутри юрисдикции).
- Привязка в `wrangler.jsonc` — с шага 6а.1: `DB` → `mana`, миграции — папка `migrations/`.
- **Привязки D1 (в 6б — и R2) — только с явным идентификатором ресурса**, созданного с
  юрисдикцией `eu`. wrangler ≥ 4.45 при `deploy` сам создаёт ресурс для привязки без id, и
  такой ресурс будет без юрисдикции
  ([changelog 24.10.2025](https://developers.cloudflare.com/changelog/2025-10-24-automatic-resource-provisioning/)).
  Следит тест `worker/wrangler-config.test.ts`: в нём список ресурсов `eu`; новый ресурс
  вносится туда только после `d1 info` / `r2 bucket info` с `"jurisdiction": "eu"`.

## Worker и API (этап 6а, шаг 6а.1, Р36)

- **Код** — `worker/`: `index.ts` (вход), `api.ts` (маршруты и порядок проверок), `guards.ts`
  (CSRF, JSON, размер тела, версия клиента), `http.ts` (заголовки ответов API), `profile.ts`,
  `health.ts`, `config.ts` (`ORIGIN`, `MIN_CLIENT`, предел тела 4 КБ).
- **Кто отвечает.** Файлы сайта отдаются без Worker. Worker вызывается для `/api/*`
  (`run_worker_first`) и для путей, у которых нет файла: их он возвращает статике
  (`env.ASSETS.fetch`, прежний пустой 404) с меткой `X-Mana-Worker: assets`. Логов нет — по
  заголовкам видно: у `/` нет ни метки, ни заголовков API; у ответов API — `Cache-Control:
  no-store`, CSP `default-src 'none'`, `Cross-Origin-Resource-Policy`, HSTS.
- **Тесты** — `npm test` (Vitest в Node, база — `worker/test/sqlite-d1.ts` на `node:sqlite`).
  **Типы** — `npm run worker:check` (часть `npm run build`): `wrangler types` →
  `worker/worker-configuration.d.ts` (не в git) → `tsc -p worker/tsconfig.json`.
- **Местная проверка:** `npm run build` → `npx wrangler d1 migrations apply mana --local` →
  `npx wrangler dev --port 8787 --ip 127.0.0.1` → `curl.exe -si http://127.0.0.1:8787/api/health`.
  Местная база — `.wrangler/state/` (не в git).

### Миграции D1 — порядок

Миграция — файл `migrations/000N_….sql`; только добавление (новые таблицы, столбцы со
значением по умолчанию, индексы; тест `worker/migrations.test.ts`). Токену сборки права D1 нет:
миграции к настоящей базе применяю я вручную **до** push кода, который их требует.

1. Локально, движок D1: `npx wrangler d1 migrations apply mana --local` (+ `npm test`).
2. Что применится на настоящей базе (только чтение):
   `node tools/admin/wrangler.ts d1 migrations list mana --remote`.
3. **Применение — после подтверждения владельца дословно:**
   `node tools/admin/wrangler.ts d1 migrations apply mana --remote`.
4. Проверка: `migrations list` ещё раз (нечего применять) и при необходимости
   `node tools/admin/wrangler.ts d1 execute mana --remote --json --command "…"` (в `meta` —
   `rows_read`).
5. Push кода.

Ошибочная миграция на пустой таблице исправляется следующей миграцией; восстановление базы
целиком — Time Travel (`wrangler d1 time-travel restore`, 7 дней на Free).

### Проверки после публикации

```
curl.exe -si https://mana.amisipehr.workers.dev/
curl.exe -si https://mana.amisipehr.workers.dev/nope
curl.exe -si https://mana.amisipehr.workers.dev/api/health
curl.exe -si https://mana.amisipehr.workers.dev/api/nope
curl.exe -si -X POST -H "Origin: https://evil.example" https://mana.amisipehr.workers.dev/api/health
```

Ожидается: `/` — 200, CSP из `_headers`, без `X-Mana-Worker`; `/nope` — 404, пустое тело,
`X-Mana-Worker: assets`; `/api/health` — 200 `{"ok":true,"db":true}` и заголовки API;
`/api/nope` — 404 `{"error":"not_found"}`; чужой `Origin` — 403 `{"error":"forbidden"}`.
`/api/health` 503 `{"ok":false,"db":false}` — база не отвечает или миграция не применена.

### Откат

- **Быстро:** Worker `mana` → **Deployments** → прежняя версия (до 6а.1 — только статика) →
  **Rollback** **(?)**: без сборки, сразу.
- **Надёжно:** `git revert` коммита и push — сборка снова без Worker.
- Таблицы, добавленные миграциями, при откате кода остаются — они только добавлены и старой
  версии не мешают.

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
