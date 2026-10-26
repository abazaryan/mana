# План 6а.5 — удаление и выгрузка аккаунта, повторное согласие, стирание данных на устройстве (26.10.2026)

Статус: **подтверждён владельцем 26.10.2026 с поправками а–е и тремя решениями (Р42).** Решения: (1) имя устройства при повторном входе исправить в 6а.5а; (2) `test-transfer-1` удалить скриптом в 6а.5а; (3) согласие той же версии — 200 без новой строки. Оговорки приняты: в файле выгрузки есть `exportedAt` и `deviceId`; прерванное после первого шага удаление доводит Cron.

Метки: [Ф] — проверено по коду; [П] — документация (со ссылкой); [Р] — предложение или вывод. Опись данных на сервере, на которой стоит план, — ответ в чате Проекта 26.10.2026 (вопросы 1–10).

## 0. Разбиение и порядок публикации

Сервер и сайт публикуются одним `wrangler deploy` ([Ф] CLAUDE.md): «сервер раньше клиента» — выпуск, где новые маршруты есть, а экранов к ним нет.

| Часть | Что | Порядок |
|---|---|---|
| **6а.5а — сервер** | миграция 0005; маршруты удаления, выгрузки, согласия; поля `me`; отказ в сессии удаляемому аккаунту; доведение удаления в Cron; имя устройства при повторном входе; скрипты `export-account.ts`, `delete-account.ts`, `minor.ts --clear`; файлы `tools/.out` без метки | код и тесты, `wrangler dev`, замер (раздел 3) → отчёт → **владелец переключает сессию в Manual** → команда миграции 0005 дословно на сверку → `migrations apply --remote` → push → `/api/health` → `export-account.ts` и `delete-account.ts` для `test-transfer-1` (команды дословно на сверку) → проверка следов только на чтение, `rows_written` в STATUS |
| **6а.5б — клиент** | экраны удаления, выгрузки, стирания, выбор при выходе, повторное согласие (на тексте v2), `transfer.declinedLink` / `declinedCode`, новый `transfer.userTaken`, кнопка стирания на экране после 401 | начинать после подтверждения владельца; ru / en (утверждены) → чат терминологии → tg → коммит; push — после утверждения tg. `NOTICE_VERSION` остаётся 2 |
| **6а.5в — v3** | утверждённый `docs/NOTICE.md` v3, `NOTICE_VERSION = 3`, подъём `MIN_CLIENT` — один коммит | до публикации — `recover.ts` для `test-sync-1` и вход в отдельном профиле Edge на сборке 6а.5б (вкладка открыта); push → чек-лист настоящего сервера (раздел 8) → STATUS. Ограничение `test-…` снимается само при v3 ([Ф] `tools/admin/testOnly.ts:16`) |

## 1. Миграция 0005

Пометка — столбцом (исчезает с каскадом строки `users`):

```sql
-- Migration 0005 (stage 6a.5, R42): an account being erased. Set in the first step, together
-- with removing its sessions, codes, invitations and admin rows; the users row goes last
-- (the cascade takes the mark with it). The hourly Cron finishes an erasure left unfinished.
ALTER TABLE users ADD COLUMN deleting_at INTEGER;
```

Проверка «миграции только добавляют» её пропускает (комментарии не читаются, [Ф] `worker/migrations.test.ts:5–14`). Индекс не нужен. На настоящей базе — **до** push 6а.5а: код 6а.5а читает `deleting_at`; старый код новый столбец не замечает [Р]. Применение — только в сессии Manual, команда дословно на сверку.

## 2. Маршруты

Общее: CSRF 403, 404 / 405, 415 / 413 / 400 по телу — как сейчас ([Ф] `worker/api.ts:62–86`); без сессии — 401 со стирающим cookie.

| Маршрут | Тело / запрос | Ответ | 426 | 403 без согласия | 401 |
|---|---|---|---|---|---|
| `GET /api/auth/me` (изменён) | — | прежние поля + `minor: boolean`, `needsConsent: boolean`; согласие, прежние номера и `minor` — одним batch | нет | нет | да |
| `POST /api/auth/consent` (новый) | `{consent: {version, by: 'self'}}` или `{consent: {version, by: 'parent', parentName, parentAgreed: true}}` | 200 `{ok: true}`; строка `consents` с `device_id` сессии; если согласие текущей версии уже есть — 200 без новой строки | **да** | нет | да |
| ошибки consent | — | 400 `bad_request` — плохое тело; 400 `consent_required` — версия ≠ `NOTICE_VERSION`, или `minor = 1` и не родитель с именем | | | |
| `GET /api/account/export` (новый) | — | `{account: {id, createdAt, label, minor}, devices: [все, с revokedAt], consents: [все], formerNumbers: [{aliasId, addedAt}], settings: [{key, value, serverRev, updatedAt, deviceId}], adminActions: [{id, at, action, detail}], journalCount}` | нет | **нет** | да |
| `GET /api/account/export/journal?after=&limit=` (новый) | курсор как у pull, ≤ 500 | `{records: [тела как есть], server: [{id, seq, receivedAt, bodyHash}], next, more}`; тела не разбираются | нет | **нет** | да |
| `POST /api/account/delete` (новый) | `{confirm: 'delete'}` | 200 `{finished: boolean}` + стирающий cookie | **да** | **нет** | да |
| сессия (изменена) | — | `getSession` не признаёт аккаунт с `deleting_at` — любой маршрут отвечает обычным 401 | | | |

Шаги удаления (Р42 п. 2): (1) пачка — `deleting_at = now`; удалить `sessions`, `pairing_codes`, `invites`, `admin_actions` аккаунта; вставить `admin_actions ('delete', NULL, {"via":"app"})` — после неё и вызывающее устройство вне аккаунта (повторный вызов — 401); (2) порции `DELETE FROM journal WHERE seq IN (SELECT seq FROM journal WHERE user_id = ? ORDER BY seq LIMIT ?)`, каждая — свой запрос; (3) `DELETE FROM users WHERE id = ?`. Обрыв после (1) — доводит Cron; `ctx.waitUntil` не используется [Р].

**Cron** (раз в час): прежняя очистка, затем аккаунты с `deleting_at` по порядку, шаги 2–3; всего ≤ 50 запросов (поправка д).

## 3. Размер порции и бюджет на Free

Лимиты [П]: 50 запросов на вызов, `db.batch()` — один ([D1 limits](https://developers.cloudflare.com/d1/platform/limits/)); 30 с на запрос и на весь batch; CPU 10 мс на HTTP и Cron, ожидание базы не входит, Cron до 15 мин ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/)); 100 000 записанных строк в сутки, индексы добавляют записи ([D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)).

Предложение [Р]: порция `n = 1000`; маршрут — до 30 порций и не начинать новую после 20 с (сессия 1–2 + пачка 1 + 30 + финал 1 ≈ 34); Cron — до 40 порций + очистка ≤ 50. 20 000 записей — 20 порций. Записанных строк ≈ 3 на запись журнала (таблица + `UNIQUE(user_id, id)` + `journal_user_seq`) → ≈ 60 000 на 20 000. Норма общая для всех (поправка г): большое удаление может остановить отправку у всех до 00:00 UTC — риск принят, открытый вопрос в STATUS.

**Замер на ноутбуке** (`wrangler dev`, местная D1): `migrations apply --local`; аккаунт `test-load` (`invite.ts --local`, вход в профиле Edge); 20 000 синтетических записей ≈ 1 КБ (SQL в scratchpad, `d1 execute --local --file`); удаление `delete-account.ts --local` (по каждой порции `meta.duration`, `meta.rows_written` — [П] [D1Result.meta](https://developers.cloudflare.com/d1/worker-api/return-object/); сообщает ли местная D1 `rows_written` — проверить; если нет — оценка формулой и удаление `test-transfer-1` на настоящей базе); то же кнопкой (время в панели сети). **Обрыв:** Ctrl+C у скрипта посреди порций → повтор доводит; закрыть вкладку посреди удаления (порция 200) → Cron вручную (`wrangler dev --test-scheduled`, `/__scheduled`, [П] [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)). После каждого — проверка «следов нет». На настоящей базе 20 000 не грузим: вставка + удаление ≈ 120 000 записанных строк > нормы Free.

## 4. Скрипты администратора

- `export-account.ts --user <id> [--local]` — тот же файл, что в приложении (общая сборка `src/core/accountExport.ts`), страницами по 500, в `tools/.out/export-<время>.json`; `deviceId` — `"admin"` (если формат `deviceId` где-то проверяется — UUID; поправка е). Файлы `tools/.out/` старше 48 ч стираются при следующем запуске любого скрипта ([Ф] `tools/admin/d1.ts:111–114`) — копию отправить человеку за двое суток.
- `delete-account.ts --user <id> [--local]` — сначала выгрузка, затем шаги 1–3 с `{"via":"admin"}`; порции — отдельными `d1 execute`, пока журнал не пуст; повторный запуск доводит; вывод — время и `rows_written` по шагам. Проверка `test-…` не применяется (удалять можно всегда).
- `minor.ts --user <id> --clear` — `UPDATE users SET minor = 0`, строка `admin_actions ('minor-clear', user_id)`. Прежнее согласие родителя остаётся действительным ([Ф] `worker/aliases.ts:28`).
- `recover.ts`, `revoke.ts`, `minor.ts` отказывают аккаунту с `deleting_at`. Имена файлов: `invite-<время>.txt`, `recover-<время>.txt`.

## 5. Клиент (6а.5б) — экраны и обрывы

**Удаление** (Настройки → Аккаунт → «Удалить аккаунт»):
1. Экран 1: что удаляется. Сначала отправляется очередь; не вышло — число неотправленных и «Сохранить журнал в файл» (их нет в копии аккаунта). Кнопки: «Сохранить копию данных аккаунта», «Дальше», «Отмена».
2. Экран 2: «Удалить навсегда?» → синхронизация останавливается, `meta.pendingDeletion`, `POST delete` (глобальная реакция на 401 для него выключена).
3. 200 или 401 при `pendingDeletion` → на устройстве убрать `account`, `sync`, `formerUserIds`, `pendingDeletion`, очистить `outbox` → «Ҳисоб ҳазф шуд»: «Сохранить журнал в файл», «Стереть данные на этом устройстве», «К колодам». Нет сети / 5xx → экран 2 с ошибкой и «Повторить», пометка остаётся. 426 → экран обновления.
4. Запуск с `pendingDeletion`: `me` (тихий 401) → 401 — «Ҳисоб ҳазф шуд»; **200 — пометка снимается, в разделе Аккаунт — `account.deleteNotDone`, кнопка удаления на месте** (поправка в). [Р] Если сессия кончилась по другой причине ровно в это время, приложение ошибочно скажет «удалён» — сервер следов не хранит.

**Выгрузка:** страницы в память; обрыв — «Не удалось» + «Повторить» с последнего курсора; файл — только целиком; закрытая вкладка — заново.

**Стирание:** (1) со входом — отправить очередь; не вышло — число неотправленных, «Сохранить журнал в файл», «Всё равно стереть»; (2) выход: 200 / 401 — дальше, нет сети / 5xx — отказ (`device.wipeNeedsNetwork`); (3) `mana.wipePending` в localStorage + сигнал другим вкладкам (BroadcastChannel `mana-wipe`); (4) удалить базу `mana` (держит другое окно — `device.wipeBlocked`); (5) `mana-lab` и ключи `mana.*`, `sluh.*` в localStorage и sessionStorage (`sluh.settings`, `sluh.log` — [Ф] `prototype/sluh.html:262, 554`); (6) снять `wipePending`, открыть `#/`. Закрыли между 3 и 6 — при запуске `wipePending` доводит стирание до `ensureDevice`. Без входа — без 1–2; на экране после 401 и «Ҳисоб ҳазф шуд» выход не нужен. Другие вкладки: по сигналу — закрыть базу, `device.wipedElsewhere`; по «готово» — перезагрузка; сигнал не дошёл — `versionchange` с `newVersion = null` ([П] [MDN](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/versionchange_event)) — тот же текст, не `update.otherTab`. Выход — выбор «Выйти, данные останутся» / «Выйти и стереть данные».

**Повторное согласие:** при запуске `me` → `needsConsent` → экран: «текст изменился», текст уведомления текущей версии, «Мувофиқам» (для «до 16» — экран родителя), «Позже»; строка «нужно согласие» с кнопкой в разделе Аккаунт; 403 от синхронизации — та же отметка; после 200 — пометка снимается, синхронизация идёт; обрыв — «Повторить».

Чистая логика — `src/core/accountExport.ts` (сборка файла, общая с скриптом), `src/core/accountDelete.ts` (ответ → шаг), `src/core/wipe.ts` (ключи и порядок).

## 6. Новые строки

ru / en утверждены владельцем 26.10.2026; tg — после чата терминологии.

| Ключ | Где и в какой ситуации; с чем не спутать | ru | en |
|---|---|---|---|
| `account.delete` | Настройки → Аккаунт, внизу, со входом; не «Убрать» (устройство) и не стирание на устройстве | Удалить аккаунт | Delete account |
| `account.deleteTitle` | заголовок экранов удаления | Удаление аккаунта | Deleting your account |
| `account.deleteText` | экран 1 | Будут удалены аккаунт и всё, что о вас хранится на сервере: журнал занятий, настройки, список устройств, записи о согласии. Вход на всех устройствах прекратится сразу. Данные на этом устройстве останутся — их можно стереть отдельно. Отменить удаление нельзя. | Your account and everything stored about you on the server will be deleted: study log, settings, list of devices, consent records. All devices will be signed out at once. The data on this device stays — you can clear it separately. This can't be undone. |
| `account.exportAll` | кнопка экрана 1; не `backup.save` (журнал этого устройства) | Сохранить копию данных аккаунта | Save a copy of your account data |
| `account.exportProgress` | пока собираются страницы | Собираем копию: записей — {n}… | Collecting the copy: {n} records… |
| `account.exportDone` | файл скачан | Копия сохранена в файл. | The copy has been saved to a file. |
| `account.exportFailed` | обрыв сети при выгрузке | Копию собрать не удалось: сервер не отвечает. Попробуйте ещё раз. | Couldn't collect the copy: the server isn't responding. Try again. |
| `account.deleteUnsent` | экран 1, очередь не ушла | Не отправлено на сервер записей: {n}. Их нет в копии аккаунта — сохраните журнал этого устройства в файл. | {n} records haven't reached the server. They aren't in the account copy — save this device's study log to a file. |
| `account.deleteConfirm` | экран 2 | Удалить аккаунт навсегда? Это нельзя отменить. | Delete your account for good? This can't be undone. |
| `account.deleteYes` | кнопка экрана 2 | Да, удалить аккаунт | Yes, delete my account |
| `account.deleting` | ожидание ответа | Удаляем аккаунт… | Deleting your account… |
| `account.deleteFailed` | нет сети / 5xx | Не удалось связаться с сервером. Попробуйте ещё раз. | Couldn't reach the server. Try again. |
| `account.deleteNotDone` | раздел Аккаунт после запуска с незаконченным удалением, `me` — 200 | Аккаунт не удалён: запрос не дошёл до сервера. Если хотите удалить его, попробуйте ещё раз. | Your account wasn't deleted: the request didn't reach the server. If you want to delete it, try again. |
| `account.deletedTitle` | экран после удаления (утверждено: «Ҳисоб ҳазф шуд») | Аккаунт удалён | Account deleted |
| `account.deletedText` | там же | Вход на всех устройствах прекращён. Данные на сервере стираются в течение суток. На этом устройстве данные остались: их можно сохранить в файл или стереть. | All devices have been signed out. The data on the server is erased within a day. The data on this device is still here: you can save it to a file or clear it. |
| `common.retry` | кнопка повтора | Повторить | Try again |
| `device.wipe` | Настройки, выбор при выходе, «Ҳисоб ҳазф шуд», экран после 401 (утверждено: «Пок кардани додаҳо аз ин дастгоҳ»); не удаление аккаунта | Стереть данные на этом устройстве | Clear data on this device |
| `device.wipeConfirm` | подтверждение без входа | Стереть с этого устройства журнал, настройки и колоды «Маны»? Без файла журнала прогресс на этом устройстве не вернуть, а колоды, в том числе личные, придётся установить заново из их файлов. | Clear Mana's study log, settings and decks from this device? Without a study log file, the progress on this device can't be brought back, and decks, including your own, will have to be installed again from their files. |
| `device.wipeConfirmSignedIn` | подтверждение со входом | Сначала отправим неотправленные ответы и выйдем из аккаунта, затем сотрём данные на этом устройстве. Журнал и настройки останутся в аккаунте; колоды, в том числе личные, придётся установить заново из их файлов. | We'll send any unsent answers and sign out first, then clear the data on this device. Your study log and settings stay in your account; decks, including your own, will have to be installed again from their files. |
| `device.wipeUnsent` | очередь не ушла | Не удалось отправить записей: {n}. Сохраните журнал в файл, иначе они пропадут. | {n} records couldn't be sent. Save the study log to a file, or they'll be lost. |
| `device.wipeAnyway` | кнопка рядом | Всё равно стереть | Clear anyway |
| `device.wipeNeedsNetwork` | выход не прошёл | Чтобы стереть данные, сначала нужно выйти из аккаунта, а для этого нужна связь с сервером. Попробуйте позже. | To clear the data, you need to sign out first, and that needs a connection to the server. Try again later. |
| `device.wiping` | идёт стирание | Стираем данные… | Clearing the data… |
| `device.wipeBlocked` | база занята другим окном | Закройте другие окна «Маны» на этом устройстве — стирание закончится, когда они закроются. | Close Mana's other windows on this device — clearing will finish once they're closed. |
| `device.wipedElsewhere` | другая вкладка; не `update.otherTab` | Данные «Маны» на этом устройстве стираются в другом окне. Когда это закончится, страница откроется заново. | Mana's data on this device is being cleared in another window. The page will reopen when it's done. |
| `account.signOutAsk` | заменяет `account.signOutConfirm` | Выйти из аккаунта на этом устройстве? | Sign out on this device? |
| `account.signOutKeep` | кнопка выбора | Выйти, данные останутся | Sign out, keep the data |
| `account.signOutWipe` | кнопка выбора | Выйти и стереть данные | Sign out and clear the data |
| `consent.needed` | строка в разделе Аккаунт | Текст о данных изменился. Пока вы не согласитесь с новым текстом, синхронизация остановлена; на этом устройстве всё работает. | The data notice has changed. Until you agree to the new text, syncing is paused; everything on this device still works. |
| `consent.read` | кнопка у строки | Прочитать и согласиться | Read and agree |
| `consent.changed` | над текстом на экране согласия | Текст изменился с тех пор, как вы дали согласие. | The text has changed since you gave your consent. |
| `consent.later` | «не сейчас» | Позже | Later |
| `consent.done` | после 200 | Спасибо. Синхронизация продолжается. | Thank you. Syncing continues. |
| `transfer.declinedLink` / `transfer.declinedCode` | вместо `transfer.declined` (утверждены, `TG_STRINGS_REVIEW.md`) | — | — |
| `transfer.userTaken` | новый текст | Прогресс этого устройства принадлежит другому аккаунту. Войдите в тот аккаунт или сохраните журнал в файл и сотрите данные: Настройки → «Стереть данные на этом устройстве». | This device's progress belongs to another account. Sign in to that account, or save the study log to a file and clear the data: Settings → “Clear data on this device”. |

## 7. Тесты

- **Worker:** миграция 0005; удаление (шаги, другое устройство — 401, без согласия, 426 / 401 / 403); **следов нет** — все таблицы и текстовые столбцы (в том числе `admin_actions.detail`, `journal.body`) без `user_id` и id устройств аккаунта; строка `delete` с `user_id NULL`; обрывы (после шага 1 — Cron, повтор — 401; посреди порций — Cron; запись push во время удаления — каскад); порция удаляет ровно `n` старейших; **бюджет ≤ 50 запросов — маршрут и Cron** (поправка д). Выгрузка: разделы, без хэшей сессий / приглашений / кодов, страницы дают весь журнал, без согласия. Согласие: self / parent, 400, без дубля, push после согласия, `me` (`minor`, `needsConsent`). Имя устройства при повторном входе.
- **Core:** `accountExport` → `parseBackup`, `planRestore`, `planAccountRestore`; файл скрипта (`deviceId "admin"`) — тоже (поправка е).
- **Скрипты:** SQL `delete-account`, `minor --clear`; имена файлов без метки.
- **6а.5б:** `accountDelete`, `wipe`; fake-indexeddb — `restoreJournal` из файла выгрузки, стирание и доведение по `wipePending`, состояние устройства после удаления.

## 8. Чек-листы

**Ноутбук** (`wrangler dev`, профили Edge): замер из раздела 3; повторное согласие (местное согласие v1; взрослый и «до 16»); выгрузка → восстановление в чистом профиле; удаление кнопкой при двух профилях (второй — 401 и экран со стиранием); стирание (со входом, без входа, с неотправленными, при второй вкладке); выбор при выходе; `transfer.declinedLink` / `declinedCode`.

**Настоящий сервер** (сессия Manual; запись в базу — после подтверждения владельца):
- 6а.5а: миграция 0005; push; `/api/health`; `export-account.ts` и `delete-account.ts` для `test-transfer-1`; проверка следов только на чтение; `rows_written` в STATUS.
- **До публикации 6а.5в** (поправка а): `recover.ts` для `test-sync-1`, вход в отдельном профиле Edge на сборке 6а.5б, вкладку оставить открытой.
- **После публикации 6а.5в:** вкладка `test-sync-1` — 426 → экран обновления → «текст изменился» → «Мувофиқам» → синхронизация идёт; в `consents` — строки v2 и v3 (только чтение). `test-edge-minor` — `recover.ts` и вход только сейчас (экран родителя с текстом v3) → строка `parent` с v3. Один из них удалить кнопкой (перед этим выгрузка и проверка файла) → проверка следов только на чтение. `test-edge-1`, `test-transfer-2`…`4` — `delete-account.ts` с выгрузкой, после каждого — проверка следов. Телефон, Opera: стирание данных, `transfer.userTaken`.

## 9. Имя устройства при повторном входе

[Ф] клиент шлёт имя по умолчанию при каждом входе (`src/ui/signIn.ts:62`), сервер пишет его поверх (`worker/auth.ts:97`). Исправление (решение 1): при конфликте имя не менять, вернуть клиенту сохранённое — клиент уже берёт имя из ответа (`src/ui/signIn.ts:73–74`). Только сервер, совместимо со старым клиентом, — в 6а.5а.
