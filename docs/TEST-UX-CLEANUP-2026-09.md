# TEST UX cleanup — September 2026

## Scope

This pass updates the existing application UI and fixes a reproduced HTTP compression listener leak. It does not import a roster, backfill attendance, regenerate a schedule, close the working semester, reset accounts, or change Railway configuration. The confirmed working semester remains **2026-09-01 through 2026-12-31**.

Railway not changed. No push or deployment was performed. Keep the existing Railway Start Command and Pre-deploy Command (`npm run db:migrate`). No database migration is required by this pass.

## Interface changes

- Shared `PageHeader`, `SectionCard` and `FilterBar`, consistent TEST badges, wrapping actions and section spacing. The semester selector is compact; reports use their own period controls. Feedback stays in the sticky top bar.
- Sidebar selection uses the most specific route. Student/specialty pages and journals opened by users without a teacher workspace resolve to Groups. Nested admin pages have one active item.
- Reports offer week, month, semester and custom periods. Only custom periods show From/To. The week shortcut selects the current Kyiv calendar week. Existing automation defaults still select the previous complete week/month.
- Students is the default report view. Lessons has a separate table. Student-only filters disappear in Lessons mode. Student rows show total lessons, PRESENT, N, HV, unmarked and percentage, ordered by lowest attendance then Ukrainian name; thresholds have text/icon badges.
- Saved report names include period and view. Old snapshots and stored downloads remain accessible. New student PDF/CSV exports use student rows; lesson exports use lesson rows. XLSX retains both sheets. Calculations come from the same snapshot.
- Legacy snapshots without student rows can still generate an XLSX from their available totals. No historical student rows are invented; existing PDF/CSV bytes are preserved.
- A report names a teacher only when its lessons belong to that teacher. Mixed teacher reports retain their broader scope. The header, cards and PDF use separate name/position labels.
- Semesters have current/archive tabs, status and roster counts, links to reports and roster, and separate create/confirm/close dialogs. Creation requires no reason or confirmation checkbox. Closure retains the warning, required reason and confirmation.
- “Current roster as draft” stores a review snapshot in the existing term-creation audit metadata. It does not confirm or attach students. The separate existing confirmation operation uses current active group membership, as stated in the dialog. Archived term protections are unchanged.
- Admin has Accounts / Teachers / Roles & access tabs. Accounts have search, role/status filters and a detail card with assignments, sessions and administrative actions in a dialog. Teacher creation has four steps and a one-time credential result with copy action.
- Roles/groups/subjects use searchable checkbox lists and removable chips. Native multiple selects were removed. Self-role management is under Profile → Advanced; existing authorization and last-administrator protection remain.
- Profile separates personal data, security and sessions. A successful profile save no longer resets fields to stale defaults. The server refresh immediately updates the top bar, teacher cards and newly generated reports.
- Known teacher title prefixes are removed for presentation and used to infer position only when a stored position is unavailable. The known Parkhomenko variants display as `Пархоменко О.Ю.`. Existing raw source fields, identifiers, lesson links and assignments are unchanged.
- Attendance history groups existing audit entries by request, actor and lesson, showing one common reason and individual Ukrainian before/after badges. It does not rewrite audit records. Feedback inbox rows show status, author, roles and timestamp.

## Reproduced Gzip warning

The installed Next **16.3.4** bundles `compression` with asymmetric event forwarding:

1. Next's `pipeNodeReadableToNodeResponse` pauses its source and calls `res.once('drain', callback)` under backpressure.
2. Compression forwards `res.on('drain', ...)` to its Gzip stream.
3. The Node one-shot wrapper attempts to remove itself from `res`, while it was registered on Gzip. Repeated backpressure cycles therefore leave spent wrappers on Gzip.

The local reproducer produced the exact `11 drain listeners added to [Gzip]` warning on all three requests before the fix. Its stack identifies `ServerResponse.on` in bundled compression, `ServerResponse.once`, and `pipe-readable.js:177`. PDF/CSV/XLSX generation itself creates no Gzip stream.

`scripts/patch-next-compression.mjs` adds symmetric `off`/`removeListener` forwarding, including listeners queued before headers. On response close it clears pending drain callbacks and destroys the compression stream. There is no listener limit increase or warning suppression.

The patch is limited to the pinned dependency version and checks the original SHA-256 before modifying it. Build, dev and unit-test scripts apply it. The production standalone output was checked for both event-removal and close-cleanup code. Review/remove the patch when upgrading Next to a version with an upstream fix; an unexpected unpatched dependency fails the patch check.

Regression coverage streams 12 successive compressed 2 MiB responses, verifies exact content hashes and one-shot callback behavior, then aborts another response. It waits for response closure and checks that all Gzip streams have zero remaining drain listeners and no MaxListeners warning. The separate three-request reproducer also completed with zero warnings after the fix.

## Verification

Commands: `npm run db:generate`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration`, `npm run build`.

All checks passed: **36 unit tests, 58 integration tests and 18 beta integration tests**. Typecheck, lint, production build and diff whitespace checks passed. The implementation commits are `0089ab0` (compression lifecycle) and `c49b7f9` (UX cleanup and regressions).

Automated coverage includes teacher name/position normalization, mixed teacher report headers, week/year/leap-month boundaries, period/view validation, navigation fallbacks, audit batching, immediate profile refresh and source preservation, no-confirmation term creation, draft metadata, unchanged lesson/attendance counts, overlap rejection, archived writes, report totals/download bytes and RBAC. The integration harness initializes only its guarded, temporary PostgreSQL WASM fixtures; it does not use the working or Railway databases.

Browser checks used a separate local server on port 3073 connected to the existing isolated release clone on loopback port 5545:

- Overview, Reports, Sources, Admin, Feedback, Audit, System, Terms and Profile; light/dark appearance, active navigation, compact semester control, and no horizontal page overflow at the desktop viewport.
- All four report period modes and both tables; a generated teacher student report; worst-attendance ordering and threshold badges.
- Term create/close dialog fields and cancel paths. The working term was never closed.
- Teacher wizard steps 1–4 and searchable multiple-choice controls; actual account creation and credential behavior are covered by integration tests.
- Position update on an isolated admin fixture and a separate teacher fixture, with immediate header/card/report refresh and no logout. The admin fixture's position was restored.
- Teacher lesson/journal/Zoom visibility, curator group navigation, and a past-day correction on a fictitious student. The new history entry persisted after reload alongside the earlier grouped audit entries.
- Developer self-role dialog under Profile and visible TEST labeling. No real account's roles or password were changed.

The report exercise created 12 fixture reports and downloaded all 36 PDF/CSV/XLSX files, then repeated after a fixture correction. Both export modes were parsed and compared: PRESENT 1, N 0, HV 1, unmarked 0, attendance 100%. Both PDFs were rendered and visually inspected. Empty reports return 422; unauthenticated source access returns 401. No Gzip warning appeared in the server trace.

Both pre-existing legacy reports without student rows opened successfully and all six downloads returned 200. Their saved PDF/CSV responses were byte-identical to storage; their XLSX fallback retained the available totals. Evidence: `runtime/ux-artifacts/legacy-checks.json`.

Before/after digests matched for all pre-existing clone students, teachers, user records (including password hashes), lessons, roster, attendance, terms, source assets and user-owned saved report snapshots. Only explicitly named `ux-*` fixtures and their test activity were excluded. This is local preservation evidence, not a claim of remote Railway verification.

Local evidence (ignored, not committed): `runtime/ux-unit-final.log`, `runtime/ux-integration-final.log`, `runtime/ux-build-final.log`, `runtime/ux-typecheck-final.log`, `runtime/ux-lint-final.log`, `runtime/ux-gzip-before.log`, `runtime/ux-gzip-after.log`, `runtime/ux-data-preserved.json`, and `runtime/ux-artifacts/` (requests, exports, format checks and PDF previews).
