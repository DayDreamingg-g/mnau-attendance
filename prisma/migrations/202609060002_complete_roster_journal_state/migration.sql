-- Data repair only: preserve all attendance, source provenance and user history.
-- Partial confirmed rosters were previously labelled CONFIRMED and blocked other groups.
BEGIN;
WITH roster_counts AS (
  SELECT l."id", COUNT(r."studentId") AS expected,
         COUNT(a."studentId") AS marked,
         COUNT(a."studentId") FILTER (WHERE a."confirmed") AS confirmed
  FROM "Lesson" l
  LEFT JOIN "LessonStudent" r ON r."lessonId" = l."id"
  LEFT JOIN "Attendance" a ON a."lessonId" = r."lessonId" AND a."studentId" = r."studentId"
  GROUP BY l."id"
), states AS (
  SELECT "id", expected, marked, confirmed,
    (CASE WHEN marked = 0 THEN 'EMPTY'
          WHEN expected > 0 AND marked = expected AND confirmed = expected THEN 'CONFIRMED'
          ELSE 'DRAFT' END)::"JournalState" AS state
  FROM roster_counts
), repaired AS (
  UPDATE "Lesson" l
  SET "journalState" = s.state, "version" = l."version" + 1, "updatedAt" = CURRENT_TIMESTAMP
  FROM states s
  WHERE l."id" = s."id" AND l."journalState" IS DISTINCT FROM s.state
  RETURNING l."id", s.state, s.expected, s.marked, s.confirmed
)
INSERT INTO "AuditLog" ("id", "lessonId", "objectType", "objectId", "reason", "source", "details", "createdAt")
SELECT 'roster-state-repair:' || "id", "id", 'Lesson', "id",
       'Виправлено стан журналу за повним списком студентів усіх груп',
       'JOURNAL_STATE_REPAIR',
       jsonb_build_object('state', state, 'expectedRoster', expected, 'marked', marked, 'confirmed', confirmed),
       CURRENT_TIMESTAMP
FROM repaired;
COMMIT;
