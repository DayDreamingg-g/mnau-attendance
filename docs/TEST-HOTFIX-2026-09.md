# TEST hotfix: 15 September 2026

## Результат и границы проверки

Исправления выполнены в существующем проекте. Railway not changed. Push и deploy не выполнялись; Railway env/config и обычный pre-deploy `npm run db:migrate` не менялись.

Проверки проводились на production-сборке Next 16.3.4 по `http://localhost:3073`, с отдельной копией PostgreSQL на `127.0.0.1:5545`. Штатный интеграционный набор использовал временную PostgreSQL WASM на `127.0.0.1:5543`. Пользователь отдельно разрешил seed/prepare/repair и другие служебные операции **только внутри существующего изолированного тестового набора**. На рабочей БД, Railway и QA-копии эти операции не запускались.

## Причины и исправления

| Дефект | Причина | Изменение |
| --- | --- | --- |
| Поиск прошлых занятий | GET-форма передавала date/q/term, но теряла past и остальной контекст | `TeacherSearch` сохраняет параметры, кроме заменяемых date/q и сбрасываемой страницы. Ссылки сохраняют фильтры; активный режим имеет `aria-current`. Ключ формы обновляет поля после back/forward. |
| Выход после отзыва сеансов | API не удалял cookie. Клиент одновременно вызывал navigation и refresh. Корневой loading/Suspense позволял начать HTML до проверки сеанса | API удаляет cookie при отзыве текущего/всех сеансов и при 401. Завершение авторизации выполняет полную замену документа. Отзыв другого сеанса обновляет текущую страницу. Loading перенесён под защищённый layout. Logout идемпотентен и сохраняет проверку origin. |
| DEMO/beta в именах | Прежняя нормализация учитывала только суффикс ` · beta/DEMO`, некоторые страницы печатали имя напрямую | Единая функция `displayName` для TEST-меток; применяется через teacherIdentity, а также в аудите, отзывах и подписях авторов на странице источников. БД и сырые metadata не переписываются. |
| UTC в System Status | В пользовательском тексте использовался `toISOString()` | Форматирование Luxon в Europe/Kyiv с украинскими названиями месяцев. Сервер, PostgreSQL, импорт, история, отчёт, ошибки и блокировки отображают местное время. READY/PENDING/FAILED имеют подписи. |
| Обрезанная подпись черновика | Raw enum и длинная строка в таблице с nowrap | `JournalRowState`: «Змінено», ниже «Було: Присутній · Онлайн» и другие человеческие статусы. Ограниченная ширина, перенос текста. |
| Неработающие списки admin dialog | CustomSelect выводил listbox в body, снаружи native dialog. Остальная страница становится inert, и z-index не переносит список в top layer | Portal выбирает ближайший dialog. Escape сначала закрывает список, затем диалог. Tab/Shift+Tab замыкаются внутри диалога. Native backdrop и возврат фокуса сохраняются. В форме можно сменить пользователя из текущей выборки, исходный пользователь остаётся выбранным при открытии. RBAC не менялся. |
| Нет удаления отзыва | Отсутствовали состояние удаления и соответствующая административная операция | Добавлен транзакционный soft delete с повторной проверкой актуальных прав, причиной и audit. По умолчанию удалённые записи скрыты; checkbox включает их в список. |
| Непонятный аудит | Заголовок показывал только source/objectType | Маппинг action/source для отзыва сеансов, паролей, ролей, журнала, формата присутствия, создания/статуса/удаления отзыва. Исходные source, objectType и JSON остаются доступными. |

### Admin dialog: что удалось воспроизвести

До исправления action combobox становился expanded, но его menu находился вне dialog и не был доступен пользователю. Поле причины локально работало: все симптомы живого QA одновременно не воспроизведены. Браузерный тест дополнительно выявил уход фокуса с последней кнопки на browser chrome; добавлен явный цикл Tab. После исправления проверены pointer, клавиатура, блокирование фоновой страницы, Escape и возврат фокуса в двух темах. Сохранение ролей не выполнялось.

### React #419: степень уверенности

Точный единичный случай на Railway не воспроизведён и его серверный стек недоступен в этом проходе. [Описание React #419](https://react.dev/errors/419) указывает на незавершённую сервером Suspense-границу с переходом к клиентскому рендерингу; само по себе оно не устанавливает первопричину.

Локально воспроизведён поздний redirect: с отозванной, но ещё передаваемой cookie `/profile` возвращал начатый HTTP 200 поток вместо ожидаемого redirect. Новый интеграционный тест падал именно на этой проверке. После переноса loading ниже auth-layout тот же тест проходит с redirect до HTML. Это подтверждает устранение конкретного механизма позднего redirect, но не доказывает идентичность со случаем Railway.

Три полных браузерных цикла curator → Profile → revoke all → login → прямой `/profile` → Back прошли без #419, hydration/Suspense/client fallback errors. Ошибки не подавляются. Проверены также отзыв другого и текущего сеанса, удаление cookie, 401 и параллельные запросы revoke.

## Миграция Feedback

`prisma/migrations/202609150003_feedback_soft_delete/migration.sql`:

- Добавляет nullable `deletedAt TIMESTAMPTZ(3)`, `deletedById TEXT`, `deleteReason TEXT`.
- FK `deletedById → User.id`: `ON DELETE RESTRICT`, `ON UPDATE CASCADE`.
- Existing rows получают NULL; удаления и переписывания строк нет. Связи автора и удалившего пользователя в Prisma имеют отдельные имена.
- ADMIN/DEVELOPER должны передать `confirm: true` и причину 5–500 символов. Сервер повторно читает активного пользователя и роли внутри транзакции.
- Запись сохраняет ID, автора, текст, прежний state и дату создания. Повторное удаление и изменение state удалённого отзыва дают 409.
- Audit сохраняет actor, feedback ID, прежний state, reason, deletedAt и deletedById атомарно с операцией.
- UI показывает автора, время и текст в модалке, требует причину и checkbox, использует красную кнопку. В режиме показа удалённых видны дата, автор и причина удаления; восстановление не добавлялось.

Миграция применена только к изолированной QA-копии и временным тестовым БД. При последующем обычном deployment её применит существующий `npm run db:migrate`. Изменение обратно совместимо с прежними строками; специальный seed/import/backfill не нужен.

## Автоматические проверки

| Команда | Результат |
| --- | --- |
| `npm run db:generate` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | 45 PASS |
| `npm run test:integration` | 69 integration + 19 beta PASS |
| `npm run build` | PASS, Next 16.3.4; source checksums проверены |
| `git diff --check` | PASS |

Новые проверки:

- `tests/hotfix.test.ts`: сохранение query/active mode, TEST labels, Kyiv summer/winter/DST, человеческая подпись черновика, audit mapping, feedback visibility.
- `tests/integration/hotfix.test.ts`: HTTP RBAC для шести ролей, обязательная причина/confirm, сохранность soft-deleted записи и audit, скрытие/показ, stale principal, cookie и session lifecycle, параллельный revoke.
- `tests/beta/beta.test.ts`: реальные защищённые PDF/DOCX bytes, anonymous 401, authenticated 200 и 404 для public-path запросов.
- `tests/browser/hotfix-scenarios.mjs`: исполняемые сценарии CUA для admin dialog и revoke. Они принимают уже открытый tab; запускаются через `cua_repl`, отдельно от npm unit/integration. `adminDialogRegression(tab,{otherUser})` требует открытую карточку fixture account. `revokeAllRegression(tab,{base,email,password})` требует неавторизованный tab и fixture credentials. В модалке назначения никогда не нажимается Save.

Существующие тесты продолжают проверять shared teacher/starosta journal, ON/OFF/null, очистку режима для N/HV, optimistic conflicts, late correction с причиной, историю, отчёты и ограничения семестров.

## Браузер и реальные файлы

- Teacher: `past=1`, date, term, scope и q сохранились; найдено прошлое fixture-занятие. Back/Forward восстановили URL, значение поиска и режим.
- Journal: изменён только локальный черновик fixture-строки, затем возвращён в исходное состояние без сохранения. ON/OFF отключаются при N. На viewport 1280 таблица: clientWidth=scrollWidth=965; подпись не обрезана; страница не имеет horizontal overflow.
- Curator: три успешных цикла revoke, прямой protected route и Back; browser error/warning logs пусты. Late correction и audit проверены интеграционно; сохранённая история fixture отображается в журнале.
- Admin: Accounts, Teachers, Roles & access, dialog в light/dark, безопасная отмена другого dialog изменения дисциплин.
- Feedback: fixture создан в UI, state изменён на IN_PROGRESS, soft delete после проверки HTML validation, hidden by default, доступен с checkbox, audit title и retained metadata проверены в UI.
- System: время сервера/PostgreSQL и операций по Киеву, статус отчёта «Готовий»; действующий семестр 01.09.2026–31.12.2026 остался активным.
- Reports: сохранённый web-report, CSV UTF-8, XLSX через openpyxl и PDF через pdfplumber показывают PRESENT=2, ONLINE=1, OFFLINE=1, 100% для Students и Lessons. PDF дополнительно отрендерен Poppler и просмотрен. Два legacy reports: шесть скачиваний, прежние PDF/CSV побайтно совпали с БД; XLSX fallback открывается.
- Sources на native QA-копии: DOCX 15 454 bytes и PDF 271 245 bytes; anonymous 401, authenticated 200. Проверка касается localhost.
- Compression: marker `mnau-compression-drain-lifecycle` присутствует в standalone build. 36 повторных PDF/CSV/XLSX скачиваний с gzip без MaxListenersExceededWarning. Unit-тест отдельно проверяет drain cleanup/backpressure/abort. Патч сохранён; setMaxListeners и подавление предупреждений не добавлялись.

Локальные артефакты (ignored): `runtime/hotfix-artifacts/` содержит скриншоты admin light/dark, поиска, journal draft, feedback delete, System Status, PDF-render и JSON HTTP/browser результатов. `runtime/mode-artifacts/` содержит реально скачанные файлы и legacy checks. Они не включены в git.

## Сохранность данных

Контрольные хеши исходных строк в QA-копии совпали для Student, Teacher, User, UserRole, Lesson, LessonStudent, Attendance (включая attendanceMode), AcademicTerm, SourceAsset, Report, Feedback и старого AuditLog. При сравнении исключены заранее существовавшие UX fixture-объекты; для аудита сравнивались записи до контрольного снимка, поскольку входы добавляют новые события. Новые nullable колонки Feedback исключены из сравнения прежнего содержимого.

Рабочая и Railway БД не использовались для тестовых изменений. Реальные ID, роли, passwords, attendance и даты семестра не менялись. Семестр не закрывался. Подготовка данных в npm test:integration ограничена явно разрешённой временной БД.

## Изменённые файлы

- Навигация/сеансы: `src/components/teacher-search.tsx`, `src/app/(protected)/teacher/page.tsx`, `src/components/profile-form.tsx`, `src/components/logout-button.tsx`, `src/app/api/profile/route.ts`, `src/app/api/auth/logout/route.ts`, `src/proxy.ts`, перенос `src/app/loading.tsx` в `src/app/(protected)/loading.tsx`.
- Dialog: `src/components/custom-select.tsx`, `src/components/dialog.tsx`, `src/components/admin-form.tsx`, `src/app/(protected)/admin/page.tsx`.
- Подписи: `src/lib/display-name.ts`, `src/lib/teacher-identity.ts`, `src/lib/time.ts`, `src/lib/audit-presentation.ts`, `src/components/journal-row-state.tsx`, `src/components/journal-editor.tsx`, `src/app/ux.css`, страницы `admin/system`, `admin/audit`, `sources`.
- Feedback: `prisma/schema.prisma`, additive migration, `src/lib/admin-release.ts`, `src/lib/feedback.ts`, `src/app/(protected)/admin/feedback/page.tsx`.
- Тесты и данный отчёт перечислены выше.

## Оставшиеся ограничения

Локальных функциональных блокеров в перечисленных сценариях не осталось. Remote deployment, повторное живое QA и remote source-security verification не выполнялись и не объявляются PASS. Точная причинная связь с единичным Railway React #419 остаётся неподтверждённой. После deployment нужен повтор именно живого сценария отзыва сеансов.

Railway not changed.
