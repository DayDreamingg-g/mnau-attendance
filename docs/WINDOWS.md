# MNAU Attendance: Windows / Docker beta

Команды выполняются в PowerShell внутри проекта. Для чистой машины нужны Node.js >=22.12 <25, npm и Docker Desktop с работающим Linux Engine. Для локальной установки без Docker нужен PostgreSQL с отдельной БД mnau_attendance.

## Чистая машина: Docker

Распакуйте ZIP в папку проекта, затем:

```powershell
Set-Location E:\Repo\mnau-attendance
npm.cmd ci
npm.cmd run setup:env
npm.cmd run beta:realtime
npm.cmd run db:generate
docker compose --env-file .env.compose build web migrate seed
docker compose --env-file .env.compose up -d postgres
docker compose --env-file .env.compose run --rm migrate
docker compose --env-file .env.compose run --rm seed
docker compose --env-file .env.compose run --rm seed npm run beta:prepare-cs
docker compose --env-file .env.compose run --rm seed npm run beta:repair-cs
docker compose --env-file .env.compose up -d web
docker compose --env-file .env.compose ps
Invoke-RestMethod http://localhost:3000/api/health
```

Переходите к следующей команде только после успеха предыдущей. setup:env создаёт независимые случайные секреты в .env и .env.compose и отказывается перезаписывать существующие файлы. Для beta нужны APP_ENV=demo, DEMO_MODE=true, пустая DEMO_DATE. APP_ORIGIN должен совпадать с адресом браузера; для опубликованного HTTPS адреса включите COOKIE_SECURE=true.

Генератор перед первой Lesson печатает базу 14.09.2026 lower/DENOMINATOR → 21.09.2026 upper/NUMERATOR. Диапазон можно изменить через --from/--to; каникулы и праздничные исключения источниками не заданы.

Последняя команда подготовки должна сообщить 17 / 0 / 20 / 21 / 0 активных студентов на чистом beta roster, 19 Teacher accounts, 5 Starosta accounts, общий curator и developer. Summary также записывается в runtime/beta-summary.json внутри tools-контейнера; список аккаунтов включён в [CS-BETA-ACCOUNTS.md](CS-BETA-ACCOUNTS.md).

Сайт: http://localhost:3000. При необходимости сохранённого n8n: `docker compose --env-file .env.compose up -d n8n`. База mnau_n8n и encryption key не меняются; инструкции workflows находятся в [n8n/README.md](../n8n/README.md).

## Обновление существующей рабочей копии

Сохраните существующие .env, .env.compose, Git history и volumes. Для уже подготовленной CS beta не запускайте setup:env, beta:realtime, normal seed или повторную beta preparation. Сначала сделайте backup, затем примените целевой repair:

```powershell
npm.cmd ci
npm.cmd run db:generate
docker compose --env-file .env.compose build web migrate seed
docker compose --env-file .env.compose up -d postgres
New-Item -ItemType Directory -Force runtime/backups
docker compose --env-file .env.compose exec -T postgres pg_dump -U postgres -d mnau_attendance -Fc -f /tmp/mnau-cs-before-repair.dump
docker compose --env-file .env.compose cp postgres:/tmp/mnau-cs-before-repair.dump runtime/backups/mnau-cs-before-repair.dump
docker compose --env-file .env.compose run --rm migrate
docker compose --env-file .env.compose run --rm seed npm run beta:repair-cs
docker compose --env-file .env.compose run --rm seed npm run beta:verify-cs
docker compose --env-file .env.compose up -d --force-recreate web
docker compose --env-file .env.compose ps
Invoke-RestMethod http://localhost:3000/api/health
```

При следующем repair выберите новое имя dump, чтобы сохранить предыдущую точку восстановления. `runtime/` исключён из Git. `beta:verify-cs` проверяет исходные 58 студентов; после законных переводов/добавлений его фиксированные roster counts могут отличаться. Repair не откатывает такие изменения, но восстанавливает согласованный beta-пароль и назначения. Не используйте его как регулярную фоновую задачу.

beta:prepare-cs является явной destructive командой для synthetic студентов пяти КН-групп. Она не удаляет Lessons, реальных студентов, другие специальности или n8n. Повторный запуск сохраняет ручные данные, архивирование, переводы и настройки аккаунтов. Normal seed не является reset. Не используйте db:reset-demo для перехода к beta.

Для переноса файлов из ZIP не заменяйте .git работающего репозитория. Архив не содержит .env, node_modules, .next или секретов. Отдельный Git bundle позволяет просмотреть подготовленные commits; удалённые репозитории не менялись.

## Локальный Node.js с PostgreSQL из Docker

Настройте env, как выше. Дополнительный Compose-файл публикует PostgreSQL только на localhost:

```powershell
docker compose --env-file .env.compose -f compose.yaml -f compose.local-db.yaml up -d postgres
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run beta:prepare-cs
npm.cmd run beta:repair-cs
npm.cmd run build
npm.cmd start
```

.env должен указывать на опубликованный PG_LOCAL_PORT, пароль совпадает с APP_DB_PASSWORD в .env.compose. setup:env согласует их при первой настройке.

## Проверки

```powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:integration
docker build --target web --tag mnau-attendance:cs-beta .
```

Integration использует отдельные временные PostgreSQL WASM базы, применяет Prisma migrations и запускает production-сборку. Порты 3001/5543 должны быть свободны. Два набора: прежние integration и CS beta. Отдельный beta запуск: npm.cmd run test:beta. Логи: test-results/server.log и beta-server.log. Изолированный визуальный preview:

```powershell
$env:MNAU_PREVIEW_TEST_DATABASE='true'
$env:MNAU_PREVIEW_CS_BETA='true'
npm.cmd run dev
```

Preview: http://localhost:4173. Он использует тестовые часы 14.09.2026 21:00 только в отдельной БД; рабочие env не меняются. Остановите Ctrl+C. Для beta в рабочей среде эти preview-переменные не нужны.

Во втором pass 14.09.2026 прошли typecheck, lint, 30 unit-тестов, production build, 49 integration и 18 beta tests. Docker build, migrations, целевой repair и повторный repair выполнены на настоящем PostgreSQL; web проверен через браузер. Подробности и ограничения: [CS-BETA-PASS2.md](CS-BETA-PASS2.md).

## Ежедневная работа

Куратор: курс → группа → «Склад групи». Староста: собственная группа → «+ Додати студента». Телефон необязателен. Перевод и архив сохраняют прошлую историю. Учитель: выбрать дату → пару → draft/отметки → сохранить. До начала занятия журнал read-only; после дня занятия исправление с причиной доступно уполномоченным ролям.

Перезапуск: docker compose --env-file .env.compose up -d. Сохранённые данные находятся в PostgreSQL volume; down -v не нужен.
