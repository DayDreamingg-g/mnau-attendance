CREATE TABLE "StarostaAssignment" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "groupId" TEXT NOT NULL REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY ("userId", "groupId")
);
INSERT INTO "StarostaAssignment" ("userId", "groupId")
SELECT s."userId", s."groupId" FROM "Student" s
JOIN "UserRole" r ON r."userId" = s."userId" AND r."roleId" = 'STAROSTA'
ON CONFLICT DO NOTHING;
ALTER TABLE "Student"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "archivedAt" TIMESTAMPTZ(3),
  ADD COLUMN "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "source" JSONB,
  ADD COLUMN "importKey" TEXT;
CREATE UNIQUE INDEX "Student_importKey_key" ON "Student"("importKey");
ALTER TABLE "LessonStudent" ADD COLUMN "groupId" TEXT REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
UPDATE "LessonStudent" r SET "groupId" = s."groupId" FROM "Student" s WHERE s."id" = r."studentId";
CREATE INDEX "LessonStudent_groupId_lessonId_idx" ON "LessonStudent"("groupId", "lessonId");
-- Legacy importers may omit groupId; capture it once on INSERT, never on transfer.
CREATE FUNCTION capture_roster_group() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."groupId" IS NULL THEN
    SELECT "groupId" INTO NEW."groupId" FROM "Student" WHERE "id" = NEW."studentId";
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER capture_roster_group BEFORE INSERT ON "LessonStudent"
FOR EACH ROW EXECUTE FUNCTION capture_roster_group();
ALTER TABLE "Attendance" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Attendance" a SET "isDemo" = true WHERE EXISTS (
  SELECT 1 FROM "AuditLog" l WHERE l."lessonId" = a."lessonId" AND l."studentId" = a."studentId"
  AND l."source" IN ('DEMO_SEED','DEMO_ATTENDANCE','DEMO_GENERATOR','DEMO_RANDOM_ATTENDANCE')
);
ALTER TABLE "AuditLog" ADD COLUMN "groupId" TEXT;
CREATE TABLE "SystemState" ("id" TEXT PRIMARY KEY, "value" JSONB NOT NULL, "updatedAt" TIMESTAMPTZ(3) NOT NULL);
