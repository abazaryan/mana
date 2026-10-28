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

**Привязка D1 прав D1 не требует:** первая сборка с привязкой (6а.1, 23.10.2026) прошла с этими
шестью правами.

**Если понадобится добавить право:** правка в My Profile → Edit, затем **Retry build**; если сборка скажет, что токен
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

`tools/lab/check-cloudflare.ts` (лаборатория распознавания, Р23) читал
`CLOUDFLARE_API_TOKEN` и после перехода на `MANA_ADMIN_API_TOKEN` не работал; удалён вместе с лабораторией 23.10.2026.

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
Так и было 23.10.2026; у `/nope` заголовки `_headers` на месте (статика применяет их и к
`env.ASSETS.fetch`). Итоги — `docs/STATUS.md`, шаг 6а.1.

### Откат

- **Быстро:** Worker `mana` → **Deployments** → прежняя версия (до 6а.1 — только статика) →
  **Rollback** **(?)**: без сборки, сразу.
- **Надёжно:** `git revert` коммита и push — сборка снова без Worker.
- Таблицы, добавленные миграциями, при откате кода остаются — они только добавлены и старой
  версии не мешают.

## Вход (этап 6а, шаг 6а.2, Р37)

- **Код** — `worker/auth.ts` (маршруты `/api/auth/*`), `session.ts` (cookie и сессии), `tokens.ts`
  (токены, хэши, HMAC с перцем), `attempts.ts` (счётчики неудачных кодов), `cleanup.ts` (чистка
  по Cron); клиент — `src/platform/api.ts`, `src/core/auth.ts`, экраны `JoinFlow`, `SignInScreen`,
  `AccountSection`, `NoticeView`. Уведомление — `docs/NOTICE.md` (читается при сборке).
- **Миграция `0002_auth.sql`** — таблицы входа; применяется по порядку выше (раздел «Миграции D1»).
- **Cron Trigger** `17 * * * *` (`wrangler.jsonc`, `triggers.crons`) — раз в час удаляет строки
  счётчиков с хэшем IP, окно которых кончилось (обещание уведомления: не дольше суток), истёкшие
  сессии, коды и приглашения. На Free — 5 Cron Triggers на аккаунт
  ([limits](https://developers.cloudflare.com/workers/platform/limits/)). Есть ли он — Worker `mana` →
  **Settings** → **Trigger events** **(?)**. Если сборка упадёт на расписании (права токена) — текст
  ошибки владельцу; Cron молча не убирать.

### Секрет AUTH_PEPPER (добавляет владелец)

Ключ HMAC для кодов привязки и IP-адресов. Токену администратора доступна только D1, поэтому
секрет добавляется в панели. Значение нигде не выводится и не хранится; потеря не страшна —
создать новое (пропадут только действующие коды, 10 минут, и счётчики, ≤ 1 часа).

1. Я: `node tools/admin/pepper.ts` — значение в буфере обмена, на экран не выводится.
2. Владелец: **Workers & Pages** → `mana` → **Settings** → **Variables and Secrets** → **Add** →
   Type **Secret**, Variable name `AUTH_PEPPER`, Value — вставить (Ctrl+V) → **Deploy**
   ([secrets](https://developers.cloudflare.com/workers/configuration/secrets/)). После сохранения
   значение не видно ни в панели, ни в wrangler.
3. Я: `node tools/admin/pepper.ts --clear` — буфер пуст. Если включён журнал буфера обмена Windows
   (Win+V; Параметры → Система → Буфер обмена) — там «Очистить всё».
4. Проверка после push: неверный код → `400 {"error":"invalid"}`. `500 {"error":"internal"}` на
   `/api/auth/pair` значит, что секрета нет (вход по приглашению при этом работает).

Для `wrangler dev` — своё значение: `node tools/admin/pepper.ts --dev` (файл `.dev.vars`, вне git).

### Скрипты администратора (`tools/admin/`)

Через обёртку токена (`wrangler.ts`); запись — временным `.sql` (удаляется), в SQL только хэши.
Каждое действие пишет `admin_actions`. До 6а.5 — только тестовые аккаунты: метка начинается с
`test-`, иначе скрипты отказывают. `--local` — та же работа с базой `wrangler dev` (ссылка на
`http://127.0.0.1:8787`, только в файл, буфер не трогается).

- `node tools/admin/invite.ts --label "test-…" [--minor]` — приглашение на 48 ч, одно использование.
  Ссылка — в буфер обмена и в `tools/.out/` (вне git; файлы старше 48 ч удаляются), в терминал не
  выводится. `--minor` — «до 16»: приложение попросит согласие родителя.
- `node tools/admin/recover.ts --user <id> [--revoke-all]` — ссылка для существующего аккаунта (новое
  устройство без кода, потерянные устройства); `--revoke-all` сначала выводит все его устройства.
- `node tools/admin/revoke.ts --device <id>` / `--user <id>` — выход устройства (или всех устройств
  аккаунта): сессии удаляются, следующий запрос — 401.
- `node tools/admin/users.ts` — аккаунты: id, метка, «до 16», согласие (кто, версия), устройства с
  последним входом. Без содержания занятий и без имени родителя.

Любая другая запись в настоящую базу (`d1 execute` с DELETE / UPDATE) — сначала владельцу.

### Проверки после публикации (6а.2)

```
curl.exe -si https://mana.amisipehr.workers.dev/api/auth/me
curl.exe -si -X POST -H "Origin: https://evil.example" https://mana.amisipehr.workers.dev/api/auth/pair
curl.exe -si -X POST -H "Sec-Fetch-Site: same-origin" -H "X-Mana-Version: 202610210000" -H "Content-Type: application/json" -d "{}" https://mana.amisipehr.workers.dev/api/auth/pair
curl.exe -si -X POST -H "Sec-Fetch-Site: same-origin" -H "X-Mana-Version: <номер сборки>" -H "Content-Type: application/json" -d "{\"code\":\"0000-0000\",\"device\":{\"id\":\"00000000-0000-4000-8000-000000000000\",\"name\":\"curl\"}}" https://mana.amisipehr.workers.dev/api/auth/pair
```

Ожидается: `401 {"error":"unauthorized"}` и стирающий `Set-Cookie`; `403 {"error":"forbidden"}`;
**`426 {"error":"upgrade_required"}` — тело и статус без изменений** (проверка, что 426 проходит через
Cloudflare); `400 {"error":"invalid"}` (перец на месте). Затем: два временных профиля Edge
(приглашение, код привязки, отзыв), путь «до 16», `users.ts`, через час — строки IP в
`auth_attempts` удалены (`d1 execute … --command "SELECT count(*) …"`, только чтение).

### Откат 6а.2

Как выше (Rollback к версии 6а.1 или `git revert`). Таблицы 0002 и секрет остаются и старой версии не
мешают. Если в старой версии нет обработчика Cron, его вызовы будут падать без вреда; оставшиеся
строки IP — удалить одной командой `d1 execute` (с согласия владельца).

## Синхронизация (этап 6а, шаг 6а.3, Р39)

Маршруты `POST /api/sync/push` и `GET /api/sync/pull` (код — `worker/sync.ts`), таблицы `journal` и
`user_settings` — миграция `migrations/0003_sync.sql`. Новых секретов и привязок нет.

### Миграция 0003 — порядок

1. Местный D1 в `wrangler`: `node tools/admin/wrangler.ts d1 migrations apply mana --local` → `0003_sync.sql ✅`
   (сделано 23.10.2026: 4 команды; обе таблицы STRICT — вставка BLOB в TEXT отклонена).
2. Что применится (только чтение): `node tools/admin/wrangler.ts d1 migrations list mana --remote` —
   должна быть только `0003_sync.sql`.
3. **Применение — только после «Подтверждаю: <команда>» владельца:**
   `node tools/admin/wrangler.ts d1 migrations apply mana --remote`.
4. Проверка: `migrations list` (нечего применять), `d1 info` (`"jurisdiction": "eu"`, таблиц на 2 больше).
5. Push кода — только после утверждения таджикских строк 6а.3 и выгрузки журнала телефона в файл
   (порядок владельца 23.10.2026, Р39).

### Проверки после публикации (6а.3)

```
curl.exe -si -H "X-Mana-Version: <номер сборки>" https://mana.amisipehr.workers.dev/api/sync/pull
curl.exe -si -H "X-Mana-Version: 202610210000" https://mana.amisipehr.workers.dev/api/sync/pull
curl.exe -si -X POST -H "Origin: https://evil.example" https://mana.amisipehr.workers.dev/api/sync/push
curl.exe -si -X POST -H "Sec-Fetch-Site: same-origin" -H "X-Mana-Version: 202610210000" -H "Content-Type: application/json" -d "{}" https://mana.amisipehr.workers.dev/api/sync/push
curl.exe -si -X POST -H "Sec-Fetch-Site: same-origin" -H "X-Mana-Version: <номер сборки>" -H "Content-Type: text/plain" -d "{}" https://mana.amisipehr.workers.dev/api/sync/push
```

Ожидается: `401 {"error":"unauthorized"}`; `426 {"error":"upgrade_required"}` (и на GET, Р39 п. 5; `MIN_CLIENT` с 6а.3 — `202610241450`, сборка 6а.2 тоже получает 426);
`403 {"error":"forbidden"}`; `426`; `415`. 413 — тело больше 1 МиБ (файлом, `-d @file`). Везде семь
заголовков API. Аккаунт без согласия текущей версии уведомления (v2) получает на push и pull `403 {"error":"consent_required"}` (Р39 п. 18). Отправка записей на настоящий сервер — с новым тестовым аккаунтом, согласие v2 (Р39 п. 17):
два временных профиля Edge с новым тестовым аккаунтом, затем Opera на телефоне. Нагрузка: график CPU
Worker в панели; `rows_read` получения — запрос только на чтение по тестовому аккаунту.

### Откат 6а.3

Rollback к версии 6а.2 или `git revert`. Таблицы 0003 остаются и старой версии не мешают. На устройствах
уже есть таблица `outbox` (схема Dexie 2): старая сборка с ней открывается (проверено на fake-indexeddb,
`src/platform/db.test.ts`), очередь просто не отправляется.

## Перенос ответов в аккаунт (этап 6а, шаг 6а.4, Р40)

Новые необязательные поля `localUserId` (приглашение `account`) и `formerUserId` (приглашение `device`,
код привязки) в `POST /api/auth/redeem` и `POST /api/auth/pair`; новый маршрут `POST /api/auth/alias`;
`/api/auth/me` отдаёт `formerUserIds`. Таблица `user_aliases` — миграция `migrations/0004_user_aliases.sql`.
Новых секретов и привязок нет. `MIN_CLIENT` не меняется: тело запроса сборки 6а.3 сервер обрабатывает
как раньше (тест). Скрипты `invite.ts` / `recover.ts` принимают метки без `test-…` только при
`NOTICE_VERSION ≥ 3` (`tools/admin/testOnly.ts`); `users.ts` показывает число прежних номеров.

### Миграция 0004 — порядок

1. Местный D1 в `wrangler`: `npx wrangler d1 migrations apply mana --local` → `0004_user_aliases.sql ✅`
   (сделано 25.10.2026: 2 команды).
2. Что применится (только чтение): `node tools/admin/wrangler.ts d1 migrations list mana --remote` —
   должна быть только `0004_user_aliases.sql`.
3. **Применение — только после «Подтверждаю: <команда>» владельца:**
   `node tools/admin/wrangler.ts d1 migrations apply mana --remote`.
4. Проверка: `migrations list` (нечего применять), `d1 info` (`"jurisdiction": "eu"`, таблиц на 1 больше),
   `sqlite_schema` — `user_aliases` `) STRICT`.
5. Push кода — только после утверждения таджикских строк 6а.4 и применения 0004.

### Проверки после публикации (6а.4)

```
curl.exe -si -X POST -H "Sec-Fetch-Site: same-origin" -H "X-Mana-Version: <номер сборки>" -H "Content-Type: application/json" -d "{\"aliasId\":\"00000000-0000-4000-8000-000000000000\"}" https://mana.amisipehr.workers.dev/api/auth/alias
curl.exe -si -X POST -H "Sec-Fetch-Site: same-origin" -H "X-Mana-Version: 202610241449" -H "Content-Type: application/json" -d "{}" https://mana.amisipehr.workers.dev/api/auth/alias
curl.exe -si -X POST -H "Origin: https://evil.example" https://mana.amisipehr.workers.dev/api/auth/alias
```

Ожидается: `401 {"error":"unauthorized"}`; `426 {"error":"upgrade_required"}`; `403 {"error":"forbidden"}`.
Перенос с отправкой на настоящий сервер — только тестовые аккаунты `test-…` и синтетические ответы
(правила 6а).

### Откат 6а.4

Rollback к версии 6а.3 или `git revert`. Таблица `user_aliases` остаётся и старой версии не мешает.
На устройствах после переноса записи уже с `userId` аккаунта, в `meta` — поля `formerUserIds`,
`pendingTransfer`, `sync.pullFirst`: старая сборка их не читает; отметка `pullFirst` ей не мешает (она
отправляет очередь как обычно, сервер ответит `duplicate`).

## Переход на Workers Paid (Р43 п. 1)

**Когда:** любое **Exceeded CPU Time Limits > 0** в Metrics Worker `mana` во время 6а.6 или в первые две
недели настоящих пользователей — переход в тот же день (решение владельца 27.10.2026). Подготовлено
28.10.2026 по документации Cloudflare; кнопки с **(?)** не проверены — «сверить в панели».

**Что даёт [П]** ([limits](https://developers.cloudflare.com/workers/platform/limits/),
[pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)):

| | Free | Paid |
| --- | --- | --- |
| Цена | 0 | от $5 в месяц (+ налог, см. шаг 2) |
| CPU на запрос | 10 мс | до 5 мин, по умолчанию 30 с |
| CPU на Cron (у нас раз в час) | 10 мс | 15 мин (интервал ≥ 1 ч) |
| Запросы к Worker | 100 000 в сутки, сверх — отказ | 10 млн в месяц включено, сверх — $0,30 за млн |
| D1: строк записи | 100 000 в сутки, сверх — отказ до 00:00 UTC | 50 млн в месяц включено, сверх — $1 за млн |
| D1: строк чтения | 5 млн в сутки | 25 млрд в месяц включено |
| D1: запросов на вызов Worker | 50 | 1000 |
| D1: размер базы | 500 МБ | 10 ГБ (5 ГБ включено) |
| D1 Time Travel | 7 дней | 30 дней |

Месячные объёмы Paid обнуляются в день подписки. Ограничения D1 Free снимаются «обычно в течение
минут» после покупки. У изолята есть запас на редкие превышения CPU; при постоянных — Error 1102
(«Worker exceeded resource limits»), в панели — **Metrics → Errors → Invocation Statuses** →
Exceeded CPU Time Limits.

### Заранее, до 6а.6 (≈ 10 минут, владелец)

1. <https://dash.cloudflare.com> → **Manage Account** → **Billing** **(?)** → **Subscriptions** →
   панель **Payment methods** → **Add Payment Method**
   ([update billing info](https://developers.cloudflare.com/billing/get-started/update-billing-info/)).
   Карта из ЕС проходит 3D Secure — подтверждение в приложении банка, телефон под рукой.
   Можно ли добавить способ оплаты без подписки, документация не говорит: если панель не даёт —
   шаг пропустить, карта вводится при покупке.
2. Там же — **Billing address** (Люксембург): по адресу считается налог.
3. Ничего не покупать.

### В день перехода — только покупка и проверки (≈ 20–30 минут, владелец)

Кода в этот день не публикуем: на Paid без `cpu_ms` в конфиге действует 30 с по умолчанию.

1. Записать время, когда Exceeded CPU стало > 0, и что в это время делали (вход, перенос, обычное
   занятие).
2. **Workers & Pages** → блок с тарифом справа (**Plan: Workers Free** **(?)**) → **Upgrade** /
   **Change** **(?)** → **Workers Paid** → **Purchase** **(?)**. До подтверждения посмотреть
   **итог с налогом** на экране покупки (НДС по адресу из профиля; документация суммы не называет —
   сверить в панели). Подтвердить, пройти 3D Secure.
3. **Проверка тарифа:** **Billing** → **Subscriptions** — строка «Workers Paid», статус **Active**,
   дата следующего платежа. Счёт — **Billing** → **Invoices** **(?)**.
4. **Worker `mana`** → **Settings** → **CPU Limits** **(?)** — **только посмотреть** (ожидается
   30 000 мс), в панели не менять: значение задаёт `wrangler.jsonc` (ниже, «Предохранитель
   `cpu_ms`»).
5. **Логи остались выключены:** **Worker `mana`** → **Settings** → **Observability** **(?)** —
   Workers Logs выключены (в конфиге `"observability": { "enabled": false }`; смена тарифа новую
   версию Worker не публикует). Заданий Logpush нет: **Analytics & Logs** → **Logpush** **(?)** —
   список пуст. Если что-то включено — не трогать, написать мне.
6. **Предупреждение о расходах:** **Manage Account** → **Billing** → **Billable Usage** → **Create
   budget alert** → порог **$1**, получатель — почта аккаунта
   ([budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/)). Только
   сообщает и **ничего не останавливает**; считает только оплату по использованию (не $5 подписки);
   письмо — на следующий день после превышения, не сразу. Если Cloudflare уже создал своё на $10 —
   оставить и добавить своё на $1.
7. Написать мне в чат: время покупки, что показывает **Subscriptions**, что видно в п. 4 и 5. Я
   обновляю `STATUS.md` и `DECISIONS.md` (Р33 п. 3, Р42 п. 4, Р43 п. 1).

### Предохранитель `cpu_ms` — с ближайшей плановой публикацией

- В `wrangler.jsonc` — `"limits": { "cpu_ms": 100 }`: ни один запрос не потратит больше 100 мс CPU
  (защита от счёта при ошибке в коде). Замер (`docs/STATUS.md`, шаг «CPU маршрутов входа»): push 25
  в первом запросе — до ≈ 44 мс на сервере, push 100 от старых сборок — до ≈ 86 мс, вход по коду с
  прежним номером — до ≈ 42 мс, страница получения 200 — до ≈ 15 мс, Cron — ≈ 6 мс (workerd × 1,4).
  При превышении push сам делит пачку, вход один раз повторяется.
- **Только после покупки Paid.** Что будет при публикации `cpu_ms` на Free, документация не говорит:
  сборка может упасть. Проверка — тест `worker/wrangler-config.test.ts` (добавляется тем же коммитом).
- **Это публикация клиента:** перед push — журнал телефона в файл. Поэтому коммит с `cpu_ms`
  уходит с ближайшей плановой публикацией, а не в день покупки.
- **Источник правды — конфиг.** Какое значение главнее после публикации — конфиг или панель, —
  документация не говорит; Cloudflare советует держать настройки в конфиге
  ([configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)). Панель —
  только посмотреть: после сборки **Settings** → **CPU Limits** **(?)** должно показать 100 мс.
- Действует ли `cpu_ms` на Cron, документация не говорит; Cron тратит ≈ 6 мс — неважно.

### После перехода — что смотреть

- **Worker `mana`** → **Metrics**: **CPU time** P50 / P999 (ожидается до 15–30 мс при входе);
  **Exceeded CPU Time Limits** — теперь значит «больше `cpu_ms`» (до коммита — больше 30 с) и должно
  быть 0: не 0 — ошибка в коде, сказать мне; **Errors**; **Requests** в сутки.
- **Billing** → **Billable Usage** — расходы сверх подписки (ожидается $0).
- **D1** → `mana` → **Metrics** — строки чтения и записи (дневных отказов больше нет).

### Что меняется в рисках

- Дневная норма записи D1 (Р42 п. 4) и 100 000 запросов в сутки (шторм, Р39 п. 7) — на Paid вместо
  отказа счёт; защита от шторма остаётся на клиенте, budget alert сообщит.
- Бюджет удаления — 50 запросов на вызов (Р42 п. 3) — не меняется: работает на обоих тарифах.
- Уведомление о данных не меняется: «из резервных копий — не позже 30 дней» верно и при 7 днях
  Time Travel (Free), и при 30 (Paid).

### Возврат на Free

**Billing** → **Subscriptions** → **Change** → **Free** **(?)** — действует с конца оплаченного
периода, деньги за него не возвращаются
([cancel](https://developers.cloudflare.com/billing/cancel-subscription/)). **Перед этим** —
коммит без `cpu_ms` и публикация. Снова: 10 мс CPU, дневные нормы D1, база до 500 МБ, Time Travel
7 дней (с уведомлением не расходится).

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
