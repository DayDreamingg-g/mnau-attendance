# Обновление MNAU Attendance: Windows / PowerShell

Команды выполняются в **текущем проекте**, например `E:\Repo\mnau-attendance`. Нужны Docker Desktop с Linux containers и Node.js версии `>=22.12.0 <25`; Dockerfile закрепляет Node.js `24.19.0`.

## Сохранить текущую конфигурацию

При обновлении исходников сохраните существующие `.env`, `.env.compose` и Git metadata. Не заменяйте рабочие env-файлы примерами и не запускайте `setup:env` для уже настроенного проекта. Существующий `N8N_ENCRYPTION_KEY` нужен для расшифровки credentials n8n.

ZIP обновления не содержит секретов, `node_modules` и `.next`; исходные PDF, нормализованные данные и provenance входят в исходники. История изменений в ZIP предназначена для проверки commits; она не должна вручную заменять `.git` уже существующего репозитория.

```powershell
Set-Location E:\Repo\mnau-attendance
Test-Path .env
Test-Path .env.compose
docker compose version
node --version
```

Обе проверки env должны вернуть `True`. Compose читает `.env.compose` через `--env-file`; локальные Next.js/Prisma/scripts читают `.env`. Пароли, токены и ключи не нужно выводить в терминал или добавлять в Git.

## Пересобрать и запустить обновлённую версию

```powershell
docker compose --env-file .env.compose build web migrate seed
docker compose --env-file .env.compose up -d postgres
docker compose --env-file .env.compose run --rm migrate
docker compose --env-file .env.compose up -d web n8n
docker compose --env-file .env.compose ps
Invoke-RestMethod http://localhost:3000/api/health
```

Переходите к следующей команде только после успешного завершения предыдущей. `migrate` применяет миграции приложения к существующей базе; `seed` и demo-генератор не запускаются автоматически. Отдельная сборка `migrate` и `seed` нужна, чтобы вспомогательные контейнеры получили актуальные scripts и миграции.

- Сайт: [localhost:3000](http://localhost:3000).
- n8n: [localhost:5678](http://localhost:5678).
- SQL healthcheck приложения: [localhost:3000/api/health](http://localhost:3000/api/health).

Если в существующем `.env.compose` указаны другие `WEB_PORT` или `N8N_PORT`, используйте их; `APP_ORIGIN` должен совпадать с адресом сайта. PostgreSQL по умолчанию не публикует порт на Windows. Все команды работы с основной БД ниже выполняются внутри Compose.

## Migration, seed и demo attendance отдельно

```powershell
# Применить все ещё не применённые миграции
docker compose --env-file .env.compose run --rm migrate

# При необходимости добавить отсутствующие demo-данные
docker compose --env-file .env.compose run --rm seed

# Заполнить только отсутствующие demo-отметки
docker compose --env-file .env.compose run --rm migrate npm run demo:attendance

# Проверить подключение, структуру данных и конфликты занятий
docker compose --env-file .env.compose run --rm migrate npm run db:check
docker compose --env-file .env.compose run --rm migrate npm run check:conflicts
```

В Linux-контейнере команда называется `npm`; на Windows используйте `npm.cmd`. Demo seed/генератор требуют явно включённого demo-режима: `APP_ENV=demo`, `DEMO_MODE=true`. Генератор сохраняет существующие teacher/starosta marks и пропускает будущие и отменённые занятия. Повторный seed не сбрасывает пароли, сессии и существующие назначения.

Сохраните текущую demo-дату, если она уже настроена: смена часов не переносит исторические занятия. В production используется настоящее время Europe/Kyiv, demo-режим должен быть отключён.

## Проверки на Windows

Для локальной проверки зависимостей используйте lockfile из обновлённого проекта:

```powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:integration
```

`test:integration` запускайте **после build**. Стенд создаёт временную БД PostgreSQL в WASM (PGlite), применяет все миграции и seed, запускает production-сборку приложения и последовательно проверяет все integration-файлы. Он не использует рабочую БД из `.env`. Для стенда должны быть свободны порты **3001** и **5543**. Журнал выполнения сохраняется в `test-results/server.log`.

Успешная проверка этого стенда не подтверждает Docker build, restart или запуск штатного PostgreSQL-контейнера. В среде подготовки Docker недоступен; эти проверки выполняются командами Docker из этой инструкции на вашем компьютере.

## Перезапуски с сохранением данных

```powershell
# Перезапустить web и n8n
docker compose --env-file .env.compose restart web n8n

# Отдельно проверить перезапуск PostgreSQL
docker compose --env-file .env.compose restart postgres
docker compose --env-file .env.compose ps
```

После перехода PostgreSQL в `healthy` проверьте приложение:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
docker compose --env-file .env.compose logs --tail 100 web postgres n8n
```

Обновите страницу журнала: сохранённые отметки и история должны остаться. Обычный повторный запуск:

```powershell
docker compose --env-file .env.compose up -d
```

Для этих действий не нужны `down -v`, удаление volumes или `db:reset-demo`.

## Подключить шесть workflows n8n

Откройте [n8n](http://localhost:5678). Сохраните существующий owner account и credentials. Через **Import from File** загрузите отсутствующие workflows из каталога `n8n`:

| Файл | Назначение |
|---|---|
| `daily-attendance.json` | Ежедневная сводка |
| `weekly-curator-summary.json` | Недельная сводка кураторов |
| `attendance-alert70.json` | Студенты с показателем ниже 70% |
| `attendance-alert50.json` | Критический показатель ниже 50% |
| `monthly-attendance.json` | Месячная аттестация |
| `report-generation.json` | Ручная оркестрация PDF/CSV-отчёта |

Повторный импорт workflow создаёт лишнюю копию автоматизации; существующий workflow обновляйте в его редакторе. Дедупликация отчётов приложения не удаляет дубли workflows в n8n.

Для **первого импорта отсутствующих** workflows доступна и CLI-команда:

```powershell
$attendanceWorkflows = @(
  'daily-attendance.json',
  'weekly-curator-summary.json',
  'attendance-alert70.json',
  'attendance-alert50.json',
  'monthly-attendance.json',
  'report-generation.json'
)
foreach ($workflowFile in $attendanceWorkflows) {
  docker compose --env-file .env.compose exec -T n8n n8n import:workflow "--input=/workflows/$workflowFile"
  if ($LASTEXITCODE -ne 0) { throw "Не удалось импортировать $workflowFile" }
}
```

В каждом workflow выберите credential **Header Auth** с именем `MNAU report machine` в node `Create and persist report`: header `Authorization`, значение `Bearer ` плюс существующий `REPORT_MACHINE_TOKEN` из `.env.compose`. Сам токен вводится только в credential, не в workflow JSON. В Compose URL node: `http://web:3000/api/machine/reports`.

Сохраните workflow, выполните **Execute Workflow**, проверьте успешный `Verify persisted result` и готовый отчёт в разделе «Звіти» сайта. Затем публикуйте нужные расписания в n8n. Экспорты изначально неактивны. Сводки и alerts сохраняются внутри приложения; workflows не отправляют внешние сообщения. Расписания n8n используют настоящие часы Europe/Kyiv, независимо от demo clock сайта.

Подробности областей доступа, retries, дедупликации и failed executions описаны в [n8n/README.md](../n8n/README.md).
