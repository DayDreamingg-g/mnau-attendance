# Attendance modes and tabular reports

Implementation commit: `b44c404` (`Add attendance modes and tabular attendance reports`).

## Behavior

- The existing shared Attendance row now has nullable `attendanceMode`: `ONLINE`, `OFFLINE`, or null. `statusCode` and its enum are unchanged. PRESENT remains the sole presence status.
- Teacher and starosta use the same journal endpoint and row. ON/OFF buttons are mutually exclusive, and clicking the selected button clears the format. Null is explicitly shown as `Формат не вказано` for PRESENT.
- Buttons provide Ukrainian hover/focus tooltips, accessible names, pressed states and a visible keyboard focus outline in both themes. N/HV/unmarked disable the controls and clear the draft mode.
- Explicit non-null modes with N/HV/unmarked are rejected with HTTP 400. A status-only request leaving PRESENT clears an existing mode. Older clients omitting the field while retaining PRESENT preserve its existing mode; explicit null clears it.
- Mode-only changes participate in dirty state, conflict reconciliation, optimistic lesson versions, request replay, the save transaction and AuditLog. Audit details retain `oldAttendanceMode` and `newAttendanceMode`; journal/admin history displays Ukrainian labels for actual changes.
- Current permissions, shared-state semantics, late-correction reasons and archive locks remain in force.

## Schema and migration

`prisma/migrations/202609150002_attendance_mode/migration.sql` creates the separate AttendanceMode enum, adds a nullable Attendance column, and adds a database CHECK requiring PRESENT whenever mode is non-null. There is no default, data rewrite, new index, identity change or additional Attendance record. Existing rows, including archived terms, receive null.

The migration was applied to the existing isolated PostgreSQL 17.11 release clone on loopback port 5545. Before/after digests matched for existing Student, Teacher, User (including password hashes), Lesson, LessonStudent, Attendance, AcademicTerm, SourceAsset and user-owned Report contents. The new nullable field and explicitly named `ux-*` test fixtures were excluded from the data comparison. The working database and Railway database were not migrated during this task.

## Reports and pages

Affected UI: the shared lesson journal at `/teacher/lessons/[id]`, its history, `/admin/audit`, report previews at `/reports`, and saved report details at `/reports/[id]`. Shared analytics now also supplies mode counters wherever its metrics are used.

Student and lesson tables include `Онлайн` and `Офлайн`. The student table shows name, group, total lessons, PRESENT/N/HV, both formats, unmarked and percentage. The lesson table shows date, pair, subject, group, roster count and the same counters; the existing online meeting link remains in the subject cell. Summary cards and tighter spacing keep the table prominent.

`PRESENT / (PRESENT + N) × 100` is unchanged. Formats are counted once as refinements of PRESENT; null modes add to PRESENT only. Legacy snapshots lacking the new counters display zero known online/offline records and count those presences as unspecified.

New PDFs use landscape tables, wrapped cells, repeated table headers, compact summary cards, totals and page numbers. Both CSV views and both XLSX sheets carry the same mode counts. The existing lesson CSV heading `Студент × заняття` is retained for compatibility. XLSX keeps explicit text cells and CSV keeps formula-injection escaping.

Stored PDF/CSV downloads remain byte-preserving reads. Legacy XLSX fallback supports snapshots without student rows or mode counters. Creating/refreshing a report uses a versioned content fingerprint; simply opening an old report does not regenerate its stored files.

Analytics reads scoped marks by lesson and matches them to scoped roster rows. This avoids the large composite-key nested lookup that produced an unnamed prepared-statement parameter mismatch in PostgreSQL WASM. The same access predicates apply to both reads. The broad native PostgreSQL check retained its original 12,121 student-lesson total and all status counts.

## Verification

All requested checks passed on the final implementation:

| Command | Result |
| --- | --- |
| `npm run db:generate` | Passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | 39 passed |
| `npm run test:integration` | 63 general + 18 beta passed |
| `npm run build` | Passed, production standalone |
| `git diff --check` | Passed |

The existing integration harness initializes and exercises its guarded temporary PostgreSQL WASM fixtures on loopback 5543, including its existing seed/backfill regression cases. No standalone seed, import, backfill, reset or destructive operation was run against the working database or the release clone.

New regressions cover ONLINE/OFFLINE persistence, invalid combinations, automatic clearing, legacy omitted/null fields, teacher/starosta API reads, mode-only audit and replay, stale versions, database CHECK enforcement, curator reason/time restrictions, exact report counts and all downloads, legacy fallback and archived mode writes. Existing RBAC and reporting tests continue to pass.

Browser QA used port 3073 and only existing fictitious `ux-*` records in the release clone. Its process-local clock was frozen to 14 September for the teacher's current-day journal; no saved calendar or term dates were changed. Checks included:

- Teacher saves ON and OFF, reloads, and sees the exact selection; curator sees those same marks and the teacher's history entry.
- Choosing OFF clears ON; clicking OFF again clears the format; choosing N clears and disables both; returning to PRESENT allows a fresh choice.
- Keyboard Tab exposes the Ukrainian tooltip and focus ring. Light/dark journal and both report views were visually inspected.
- Student and lesson report pages match the saved snapshot and parsed PDF, CSV and XLSX: PRESENT 2, ONLINE 1, OFFLINE 1, expected 2, percentage 100%.
- Two pre-existing legacy report pages and all six downloads pass; saved PDF/CSV are byte-identical and XLSX fallback includes totals.
- Separate 65-row export fixtures exercise long Ukrainian names/subjects and pagination: five student pages and seven lesson pages, with repeated headers, page numbers and CSV/XLSX totals checked. Representative rendered PDF pages were inspected for clipping and readability.

Local evidence is ignored rather than committed: `runtime/mode-{build,typecheck,lint,unit,integration,migrate}.log`, `runtime/mode-data-preserved.json` and `runtime/mode-artifacts/`. Screenshots include `journal-dark-keyboard.png`, `report-students-light.png`, `report-students-dark.png` and `report-lessons-dark.png`. Fixtures and local downloads contain no changes to real students' marks.

## Railway deployment notes

No push, remote configuration change or deployment was performed. Keep the existing stack, dependency versions, Docker targets, Railway Start Command, port, environment and ordinary pre-deploy command `npm run db:migrate`. This release requires that migration to complete before the new application serves journal/report requests. Existing source roster, IDs, passwords, attendance statuses and official semester dates (2026-09-01 through 2026-12-31) are preserved.

Do not add seed/import/backfill to deployment. After the operator deploys, verify a permitted test journal, both report views and all formats, plus an old saved report. Do not fabricate marks for real students during acceptance.

The additive schema can remain installed during a code rollback. However, code predating this feature cannot clear a non-null mode when changing PRESENT to N/HV; the CHECK will reject that write. Use a compatible application version or a forward fix after modes have been recorded. Do not drop the column or constraint as a routine rollback step.
