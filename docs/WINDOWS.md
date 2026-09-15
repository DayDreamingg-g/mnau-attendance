# Windows / Docker: обновление существующего TEST

Команды выполняются в PowerShell, `E:\Repo\mnau-attendance`. Нужны Node.js >=22.12 <25 и Docker Desktop Linux Engine. Используйте существующие `.env` / `.env.compose`; не меняйте секреты, volumes или n8n. Это обновление уже подготовленной базы, не установка новой пустой базы.

## Сборка и одноразовые операции

Выполняйте по порядку, переходя дальше только после успеха. В dry-run проверьте нужную БД, пять групп и сопоставление 58 прежних ID. Для исходного состава ожидается добавление 70; законные ручные изменения сохраняются.

```powershell
Set-Location E:\Repo\mnau-attendance
npm.cmd ci
npm.cmd run db:generate
docker compose --env-file .env.compose build web migrate seed
docker compose --env-file .env.compose run --rm migrate
docker compose --env-file .env.compose run --rm seed npm run beta:import-complete-cs-roster -- --dry-run
docker compose --env-file .env.compose run --rm seed npm run beta:import-complete-cs-roster -- --apply
docker compose --env-file .env.compose run --rm seed npm run beta:backfill-cs-history -- --dry-run
docker compose --env-file .env.compose run --rm seed npm run beta:backfill-cs-history -- --apply
docker compose --env-file .env.compose run --rm seed npm run beta:verify-cs
docker compose --env-file .env.compose up -d --no-deps web
docker compose --env-file .env.compose ps
Invoke-RestMethod http://localhost:3000/api/health
```

Здесь `seed` — существующее имя **tools-сервиса Compose**; каждая команда явно заменяет его default-команду. Не запускайте `run --rm seed` без команды. Legacy db:seed/prepare/repair/reset заблокированы вне изолированных тестов. Backfill никогда не заполняет дни с 15.09.2026; серверные часы не замораживаются.

При последующих обновлениях нужны сборка, `run --rm migrate` и `up -d --no-deps web`. Одноразовые команды не добавляются в startup. В архиве посещаемость не редактируется даже разработчиком.

## Локальный Node.js

Если `.env` уже указывает на нужный локальный PostgreSQL, используйте те же команды через `npm.cmd run`, начиная с `db:migrate`. Для доступа к PostgreSQL из Docker используется существующий `compose.local-db.yaml` и сохранённый PG_LOCAL_PORT. `npm.cmd run build` и `npm.cmd start` запускают локальный web. Не запускайте setup:env и старую подготовку.

## Проверки

```powershell
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:integration
```

Integration запускает отдельную временную PostgreSQL WASM БД и production web на 5543/3001. Он не пишет в рабочий DATABASE_URL. `test:beta` отдельно запускает набор КН. Логи находятся в игнорируемом `test-results/`.

Первый вход после миграции требует сменить прежний пароль один раз. Если пароль забыт, администратор выдаёт случайный временный через интерфейс. Профиль показывает сеансы; смена собственного пароля отзывает другие сеансы. Пароль и логин не печатаются в технических итогах.

Railway-команды, результаты проверки и ограничения: [инструкция релиза](TEST-RELEASE-2026-09.md). Конфигурация/данные Railway не следуют автоматически из локального успеха. Push без согласованного развёртывания не выполняется.
