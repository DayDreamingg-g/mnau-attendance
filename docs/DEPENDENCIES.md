# Dependency review

Архивный аудит от 06.09.2026, полученный вместе с исходным проектом. В текущем обновлении версии и lockfile сохранены, новый security scan не выполнялся. Аудит сайта и аудит n8n — разные деревья зависимостей. Числа относятся к npm audit, не к сканированию Docker image или полной оценке безопасности.

## Приложение

Итог `npm audit --json`: **0 critical / 0 high / 0 moderate / 0 low**. Снимок — `application-audit.json`. Prisma CLI, Client и adapter-pg имеют одну версию 7.10.0; генерация, миграция через CLI, реальные SQL-запросы, seed, TypeScript, lint, production build и серверные сценарии после изменений выполнены.

Первичный аудит: 5 affected dependency entries (4 high, 1 low). Оценены и исправлены следующие цепочки:

| Зависимость | Риск / контекст | Принятое изменение |
|---|---|---|
| deepmerge-ts внутри @prisma/config | Истощение ресурсов на циклических графах; конфигурация CLI задаётся проектом | Узкий override на 8.0.2; проверены Prisma config, generate и migrate deploy |
| mysql2 в инструментах Prisma | Advisories протокола MySQL; сайт использует PostgreSQL и не открывает MySQL connections | Override 3.24.3, совместимая исправленная ветка; Prisma gates прошли |
| esbuild, пришедший через tsx | Доступ к файлам через dev server на Windows | Обновлён tsx до 4.23.13 с исправленным транзитивным esbuild |

Сведения: [deepmerge-ts advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [mysql2 advisory](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3), [esbuild advisory](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr). `npm audit fix --force` не применялся. Отключений проверок безопасности ради тестов нет.

При установке были предупреждения о завершении поддержки ESLint 9.39.1 и транзитивных пакетах. ESLint пока закреплён в проверенной совместимой ветке eslint-config-next; это не уязвимость из итогового npm audit. Предупреждение среды `Unknown env config "http-proxy"` относится к предоставленной npm-конфигурации среды, не к проектному `.npmrc` (проект его не задаёт).

## n8n 2.37.10

Для проверки установлен настоящий n8n CLI отдельно от приложения. Версия соответствует stable dist-tag на момент выбора, без beta/RC. Его dependency tree не включён в package-lock сайта: в Compose закреплён официальный image n8n этой версии.

Итог отдельного `npm audit --json`: **158 affected dependency entries: 7 critical, 37 high, 112 moderate, 2 low**. Это не 158 независимых exploit: часть записей отражает распространение одних advisories на зависимые пакеты. Полный снимок — `n8n-audit.json`.

Критические цепочки включают `form-data`, `tar`, `fast-xml-parser` и зависимые LangChain/Zep пакеты. Есть также high issues в LangChain, mailparser/nodemailer, protobufjs и других интеграциях. Примеры первичных описаний: [form-data boundary](https://github.com/advisories/GHSA-fjxv-7rqg-78g4), [tar traversal](https://github.com/advisories/GHSA-34x7-hfp2-rc4v), [XML expansion](https://github.com/advisories/GHSA-8gc5-j5rx-235r), [LangChain SSRF](https://github.com/advisories/GHSA-mphv-75cg-56wg).

В текущих workflow используются Manual Trigger, Schedule Trigger, HTTP Request к своему приложению и короткий Code node для проверки ответа READY. AI, XML, почта, загрузка архивов и внешние коннекторы не используются. Это уменьшает используемую поверхность, **но не является доказательством недостижимости всех advisories**. Порт n8n привязан к 127.0.0.1, а машинный токен имеет доступ только к отчётам одного факультета.

Автоматически предложенный npm путь исправления части цепочек — downgrade n8n до 0.167.0 с semver-major изменением. Он отвергнут как несовместимый и не подтверждающий безопасность. Внутренние зависимости официального n8n image не переписывались непроверенными overrides. Эта версия не объявляется безопасной для публичного production-развёртывания.

При установке n8n были upstream peer/deprecation warnings. Во время его миграций PostgreSQL драйвер сообщил: `Calling client.query() when the client is already executing a query is deprecated ... pg@9.0`. Workflow при этом успешно выполнились с закреплённой версией; предупреждение не скрыто. Полный пересмотр n8n dependency graph требует обновления и тестирования отдельной совместимой версии upstream.

## Docker runtime

В полученном Compose уже закреплён PostgreSQL **17.11**: [release notes от 13.08.2026](https://www.postgresql.org/docs/release/17.11/). Используется bookworm image; проект не использует replication, pgcrypto или сторонние extensions. В текущем обновлении версия PostgreSQL не менялась.

Node 24.19.0 — [официальный LTS release](https://nodejs.org/en/blog/release/v24.19.0), совпадающий с реально проверенным runtime. Docker build/pull и image vulnerability scan здесь не выполнены: Docker отсутствует. Нулевой npm audit приложения нельзя распространять на ОС image или n8n.
