-- Additive: existing records keep a NULL mode, including archived terms.
CREATE TYPE "AttendanceMode" AS ENUM ('ONLINE', 'OFFLINE');
ALTER TABLE "Attendance" ADD COLUMN "attendanceMode" "AttendanceMode";
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_mode_requires_present"
  CHECK ("attendanceMode" IS NULL OR "statusCode" = 'PRESENT');
