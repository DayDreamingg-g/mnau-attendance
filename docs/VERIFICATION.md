# Проверка обновления MNAU Attendance

Дата: 06.09.2026. Обновлена копия полученного `mnau-attendance.zip`; исходный стек сохранён. Работающая база и Docker пользователя недоступны из этой среды и не изменялись. Проверки использовали отдельную временную PGlite БД и настоящий production standalone Next.js.

## Выполненные проверки

| Проверка | Результат и граница |
|---|---|
| Gates каждого этапа | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` проходят; этапы оформлены отдельными commits |
| Unit tests | 26/26, без пропусков: метрики, сортировка/фильтры, SSR dropdown, journal submission/state, реальная SQL repair migration, cookie policy, demo clock, отчётные периоды, контракт шести workflows |
| Integration tests | 48/48, без пропусков; все файлы `tests/integration/*.test.ts` запускаются последовательно |
| Чистая установка | Реальный `npm ci` с lifecycle scripts в пустом каталоге: 534 пакета, версии сверены, lockfile не изменён |
| Production build/runtime | `prisma generate && next build --webpack`; HTTP-запросы к `.next/standalone/server.js` |
| Миграции | Обе миграции применены через Prisma CLI по PostgreSQL wire protocol; новая ремонтирует агрегатные состояния, повышает версии и создаёт аудит |
| Seed и SQL | На чистом seed 28 групп, 420 синтетических студентов, 288 занятий; `db:check` и `check:conflicts` успешны |
| Повторный seed | Сохраняет исправленные отметки, версии, password hashes и сессии |
| Demo attendance | Реальный генератор дополняет отсутствующие строки; второй запуск создаёт 0; ручные отметки, draft, будущие/отменённые занятия проверены регрессией |
| n8n CLI 2.37.10 | Импортированы шесть exports, каждый выполнен дважды через машинный HTTP API: READY, при повторе reused=true |
| Разделение БД n8n | 131 внутренняя таблица, Attendance нет; native PostgreSQL users/CONNECT этим не проверяются |
| Независимость журнала | После завершения n8n CLI и остановки его тестовой БД HTTP-save успешен; отметка и AuditLog прочитаны обратно |
| PDF/CSV | Настоящие скачивания, BOM/строки CSV и PDF; PDF отрендерен Poppler и осмотрен, украинский текст читается |
| Source provenance | Все 8 исходных PDF/JSON побайтно совпадают с архивом; Prisma schema и initial migration сохранены; реальные env-файлы не менялись |

Протоколы: [verification-build.log](verification-build.log), [verification-server.log](verification-server.log), [verification-n8n.log](verification-n8n.log). Пример: [sample-report.pdf](sample-report.pdf). Машинная сводка: [verification-results.json](verification-results.json). Все данные студентов синтетические.

## Существенные серверные сценарии

- Защищённые URL без сессии перенаправляют на login; случайная, отозванная и просроченная cookie не авторизует. Проверены недоступные страницы, API 401/403/404 и валидация.
- Реальный `application/x-www-form-urlencoded` POST login создаёт сессию, возвращает 303 и HttpOnly/SameSite cookie; запрос с ней открывает защищённую страницу. Проверены одинаковые ошибки неизвестного email/пароля, отсутствие credentials в URL, общий rate limit HTML/JSON, Origin, дубли form fields, malformed JSON и Secure policy HTTPS. Это настоящий form submit, а не проверка атрибута method.
- Учитель не читает/меняет чужую пару, староста — чужую группу и подтверждённые строки. Пустые назначения не дают общего доступа. Совмещённые TEACHER/CURATOR/STAROSTA scopes связаны с конкретной парой и группой и не открывают чужой сегмент общей пары.
- Админ симметрично выдаёт/снимает роли, teacher/starosta profiles, curator groups и dean faculties. Удаление сохраняет User/Profile/history, требует актуального ADMIN; отзыв виден существующей сессии. Проверены ownership conflicts, self-admin protection, audit и повторы.
- Журнал сохраняет draft, teacher confirmation и corrections. Прошлый день требует назначенной области и причины. Проверены конкурентный 409, повтор requestId без повторного аудита, concurrent replay, отзыв прав и невозможность обойти snapshot подставленной будущей версией.
- Общая пара: подтверждение группы A оставляет группе B возможность заполнения. CONFIRMED требует полного expected roster; clearing/draft меняют агрегат. Миграция проверена настоящим SQL с сохранением отметок/аудита и повторным выполнением.
- Drill-down сохраняет даты/filters; пустая выборка возвращает no data. Метрики и пороги считаются из подтверждённых raw counts, HV исключён из знаменателя.
- Preview не пишет Report; цепочка факультет/специальность/группа/студент валидируется. Проверены отдельный студент, агрегаты, concurrent dedup, обновление CSV после переименования и защита PDF/CSV по роли/факультету.
- Weekly использует действующие curator assignments. Alerts 70/50 имеют разные устойчивые ключи; повторы не создают лишние отчёты. PENDING с requireReady возвращает retriable503; workflows требуют READY, имеют retries и сохраняют failed executions.

## Непроверенное и оставшиеся ограничения

- **Docker build/start/restart, native PostgreSQL/n8n containers и volumes:** Docker отсутствует. Команда `docker compose --env-file .env.compose build web migrate seed` завершилась кодом127: `docker: command not found`. PGlite не проверяет Docker images, SCRAM, CONNECT отдельных пользователей и восстановление соединений после restart. Команды приёмки — в [WINDOWS.md](WINDOWS.md).
- **Desktop/mobile, Chrome/Edge/Windows и visual dark/light QA:** браузер отклонил открытие приложения/preview с `ERR_BLOCKED_BY_CLIENT`. Интерактивные dropdown, hover/focus, loading/offline UX и полная browser-цепочка login → journal → save → reload не объявляются проверенными. HTTP/SSR проверки выполнены отдельно.
- **n8n schedules:** импорт и Manual/CLI execution проверены; ожидание реальных календарных триггеров не проводилось. Exports неактивны; credential назначается после импорта, расписания включаются локально.
- **Доставка alerts:** сохраняются summary/PDF/CSV и alertKey (`STORED_ONLY`); внешние сообщения не отправляются. Weekly summaries доступны ADMIN/DEAN_OFFICE; прямой доступ CURATOR к reports не расширялся.
- **Границы UI:** сортировка reports относится к последним 100 записям, audit к последним 200; пределы указаны в UI. Несохранённый журнал хранится в форме и не переживает закрытие вкладки; beforeunload не заменяет постоянное хранение черновика.
- **Зависимости:** исходный [DEPENDENCIES.md](DEPENDENCIES.md) содержит нерешённые upstream advisories n8n. Новый security scan не проводился; версии не менялись. В тестовом n8n остаётся предупреждение pg о параллельном client.query; workflows выполнились успешно. Docker image scan, load test и публичный deployment не выполнялись.

## Повторить серверные проверки

В настроенном проекте с сохранёнными env-файлами:

```powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:integration
```

`test:integration` и `verify:server` используют одинаковый изолированный стенд: пустая БД в памяти, собственные env-параметры, все миграции. Рабочая БД из `.env` не используется. Нужны свободные порты 3001 и 5543 и готовый standalone build.

Для настоящего n8n на Linux установите CLI отдельно от зависимостей сайта:

```bash
mkdir -p /tmp/mnau-attendance-n8n-check
npm install --prefix /tmp/mnau-attendance-n8n-check --save-exact n8n@2.37.10
N8N_TEST_BIN=/tmp/mnau-attendance-n8n-check/node_modules/n8n/bin/n8n npm run verify:server
```

Нужен Python3 как `python`. Проверка использует временную БД на 5544 и anonymous memory file для временного credential. Открытые credentials не записываются в exports. В Compose credential выбирается через UI n8n.

## Локальная визуальная приёмка

Проверьте приложение на desktop и ширине 390px в обеих темах:

1. Dropdown: стрелки, Home/End, украинский поиск вводом, Enter, Escape, Tab, outside click, длинный список, disabled/required; после GET сохраняются даты, threshold, sort/order.
2. Заголовки меняют asc/desc и индикатор; переходы факультет → пара и назад сохраняют период. Пустая выборка/no data понятны.
3. Teacher/starosta: массовое PRESENT, N/HV/unmarked, подтверждение, loading, offline error с сохранённой формой; две вкладки дают конфликт версий.
4. Общая пара: подтвердить только одну группу, заполнить оставшуюся её старостой. Проверить read-only подтверждённых строк и историю.
5. No-JS login, ошибки credentials/rate limit, недоступные страницы, logout и прямой защищённый URL.
6. Preview отчёта, смена типа/области, PDF/CSV, повтор workflow; перезапуски из WINDOWS.md и сохранность отметок/сессий/credentials.

Для отдельной проверки настоящих компонентов есть необязательный синтетический fixture:

```powershell
$env:MNAU_COMPONENT_PREVIEW="true"
node scripts/preview-components.mjs
```

Откройте [component preview](http://localhost:4175/fixture) или [390px preview](http://localhost:4175/mobile). Это отдельный стенд без авторизации и БД; save намеренно возвращает503 для проверки сохранности формы. `?mode=starosta` показывает неподтверждённые строки старосты, `?reason=true` — поле причины. В production fixture заблокирован.
