-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordChangedAt" TIMESTAMPTZ(3),
ADD COLUMN     "position" TEXT NOT NULL DEFAULT 'UNSPECIFIED',
ADD COLUMN     "workspace" "RoleCode";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "device" TEXT NOT NULL DEFAULT 'Невідомий пристрій',
ADD COLUMN     "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "LoginBucket" ADD COLUMN     "blockedUntil" TIMESTAMPTZ(3),
ADD COLUMN     "strikes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "position" TEXT NOT NULL DEFAULT 'UNSPECIFIED',
ADD COLUMN     "retiredAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "onlineUrl" TEXT,
ADD COLUMN     "termId" TEXT;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "xlsx" BYTEA;

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "rosterConfirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSubject" (
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "TeacherSubject_pkey" PRIMARY KEY ("teacherId","subjectId")
);

-- CreateTable
CREATE TABLE "SourceAsset" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "groupIds" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterSourceRow" (
    "sourceId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "groupId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "provenance" JSONB NOT NULL,

    CONSTRAINT "RosterSourceRow_pkey" PRIMARY KEY ("sourceId","row")
);

-- CreateTable
CREATE TABLE "BackfillBatch" (
    "id" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackfillBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roles" JSONB NOT NULL,
    "workspace" TEXT,
    "page" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicTerm_facultyId_fromDate_toDate_idx" ON "AcademicTerm"("facultyId", "fromDate", "toDate");

-- CreateIndex
CREATE UNIQUE INDEX "SourceAsset_sha256_key" ON "SourceAsset"("sha256");

-- CreateIndex
CREATE INDEX "RosterSourceRow_studentId_idx" ON "RosterSourceRow"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterSourceRow_sourceId_studentId_key" ON "RosterSourceRow"("sourceId", "studentId");

-- CreateIndex
CREATE INDEX "Feedback_state_createdAt_idx" ON "Feedback"("state", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "Lesson_termId_startAt_idx" ON "Lesson"("termId", "startAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BackfillBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubject" ADD CONSTRAINT "TeacherSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterSourceRow" ADD CONSTRAINT "RosterSourceRow_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterSourceRow" ADD CONSTRAINT "RosterSourceRow_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One-time requirement for issued TEST accounts. No password hash is changed.
UPDATE "Teacher" SET source=source || jsonb_build_object('originalDisplayName',"displayName");
UPDATE "User" SET "mustChangePassword" = false;
UPDATE "User" u SET "mustChangePassword" = true WHERE u."active" AND (
  u.email IN ('curator.cs@test.com','developer@test.com','admin@test.com','dean@test.com') OR
  EXISTS (SELECT 1 FROM "Teacher" t JOIN "Lesson" l ON l."teacherId"=t.id JOIN "LessonGroup" lg ON lg."lessonId"=l.id JOIN "Group" g ON g.id=lg."groupId" WHERE t."userId"=u.id AND upper(g.name) IN ('КН 1/1','КН 2/1','КН 3/1','КН 3/2','КН 4/1')) OR
  EXISTS (SELECT 1 FROM "StarostaAssignment" a JOIN "Group" g ON g.id=a."groupId" WHERE a."userId"=u.id AND upper(g.name) IN ('КН 1/1','КН 2/1','КН 3/1','КН 3/2','КН 4/1'))
);

-- Bounds confirmed by the owner on 2026-09-15. January lessons are retained unassigned.
INSERT INTO "AcademicTerm" (id,name,"facultyId","fromDate","toDate","confirmedAt","rosterConfirmedAt")
SELECT DISTINCT 'term-2026-autumn-' || s."facultyId", 'Осінній семестр 2026', s."facultyId", '2026-09-01', '2026-12-31', now(), now()
FROM "Group" g JOIN "Specialty" s ON s.id=g."specialtyId" WHERE upper(g.name)='КН 1/1';
UPDATE "Lesson" l SET "termId"=t.id FROM "AcademicTerm" t
WHERE (l."startAt" AT TIME ZONE 'Europe/Kyiv')::date BETWEEN t."fromDate"::date AND t."toDate"::date
AND EXISTS (SELECT 1 FROM "LessonGroup" lg JOIN "Group" g ON g.id=lg."groupId" JOIN "Specialty" s ON s.id=g."specialtyId" WHERE lg."lessonId"=l.id AND s."facultyId"=t."facultyId")
AND NOT EXISTS (SELECT 1 FROM "LessonGroup" lg JOIN "Group" g ON g.id=lg."groupId" JOIN "Specialty" s ON s.id=g."specialtyId" WHERE lg."lessonId"=l.id AND s."facultyId"<>t."facultyId");

INSERT INTO "AuditLog" (id,"objectType","objectId",source,reason,details)
VALUES ('migration-shared-journal-20260915','System','shared-journal','SCHEMA_MIGRATION',
 'Спільні відмітки: старі ознаки підтвердження та авторство збережено; усі збережені статуси враховуються.',
 jsonb_build_object('legacyDrafts',(SELECT count(*) FROM "Attendance" WHERE NOT confirmed),'termFrom','2026-09-01','termTo','2026-12-31'));

-- Enforce archive immutability even for technical scripts; share locks serialize with closing.
CREATE TABLE "TeacherGroup" (
 "teacherId" TEXT NOT NULL REFERENCES "Teacher"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "groupId" TEXT NOT NULL REFERENCES "Group"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 PRIMARY KEY ("teacherId","groupId")
);
CREATE FUNCTION enforce_term_archive() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE term_key text; lesson_key text; archived timestamptz;
BEGIN
  IF TG_TABLE_NAME='AcademicTerm' THEN
    IF OLD."archivedAt" IS NOT NULL THEN RAISE EXCEPTION 'Archived semester is read-only'; END IF;
    RETURN NEW;
  END IF;
  FOR term_key IN
    SELECT DISTINCT candidate FROM (
      SELECT CASE WHEN TG_TABLE_NAME='Lesson' THEN to_jsonb(OLD)->>'termId'
        ELSE (SELECT "termId" FROM "Lesson" WHERE id=to_jsonb(OLD)->>'lessonId') END AS candidate
      UNION SELECT CASE WHEN TG_TABLE_NAME='Lesson' THEN to_jsonb(NEW)->>'termId'
        ELSE (SELECT "termId" FROM "Lesson" WHERE id=to_jsonb(NEW)->>'lessonId') END
    ) terms WHERE candidate IS NOT NULL
  LOOP
    SELECT "archivedAt" INTO archived FROM "AcademicTerm" WHERE id=term_key FOR SHARE;
    IF archived IS NOT NULL THEN RAISE EXCEPTION 'Archived semester is read-only'; END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_term BEFORE UPDATE OR DELETE ON "AcademicTerm" FOR EACH ROW EXECUTE FUNCTION enforce_term_archive();
CREATE TRIGGER immutable_lesson BEFORE INSERT OR UPDATE OR DELETE ON "Lesson" FOR EACH ROW EXECUTE FUNCTION enforce_term_archive();
CREATE TRIGGER immutable_roster BEFORE INSERT OR UPDATE OR DELETE ON "LessonStudent" FOR EACH ROW EXECUTE FUNCTION enforce_term_archive();
CREATE TRIGGER immutable_attendance BEFORE INSERT OR UPDATE OR DELETE ON "Attendance" FOR EACH ROW EXECUTE FUNCTION enforce_term_archive();
CREATE TRIGGER immutable_lesson_groups BEFORE INSERT OR UPDATE OR DELETE ON "LessonGroup" FOR EACH ROW EXECUTE FUNCTION enforce_term_archive();
CREATE TRIGGER immutable_submission BEFORE INSERT OR UPDATE OR DELETE ON "JournalSubmission" FOR EACH ROW EXECUTE FUNCTION enforce_term_archive();
