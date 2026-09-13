import "dotenv/config";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { journalStateForRoster } from "../src/lib/journal-state";
import { db } from "../src/lib/db";
import { demoEnabled, effectiveNow } from "../src/lib/time";
import type { StatusCode } from "../src/generated/prisma/client";

function hashPercent(value: string): number {
  const hash = createHash("sha256").update(value).digest();

  return hash.readUInt32BE(0) / 0xffffffff;
}

function getStudentRisk(studentId: string): "NORMAL" | "WARNING" | "CRITICAL" {
  const value = hashPercent(`risk:${studentId}`);

  if (value < 0.1) {
    return "CRITICAL";
  }

  if (value < 0.25) {
    return "WARNING";
  }

  return "NORMAL";
}

function generateStatus(
  studentId: string,
  lessonId: string,
): StatusCode {
  const risk = getStudentRisk(studentId);
  const value = hashPercent(`attendance:${studentId}:${lessonId}`);

  if (risk === "CRITICAL") {
    if (value < 0.4) {
      return "PRESENT";
    }

    if (value < 0.92) {
      return "N";
    }

    return "HV";
  }

  if (risk === "WARNING") {
    if (value < 0.65) {
      return "PRESENT";
    }

    if (value < 0.93) {
      return "N";
    }

    return "HV";
  }

  if (value < 0.85) {
    return "PRESENT";
  }

  if (value < 0.96) {
    return "N";
  }

  return "HV";
}

export async function generateDemoAttendance() {
  if (!demoEnabled() || process.env.APP_ENV === "production") {
    throw new Error(
      "Demo attendance generation is allowed only in demo mode.",
    );
  }

  const currentDatabase = await db.$queryRaw<{ name: string }[]>`
    SELECT current_database() AS name
  `;

  if (currentDatabase[0]?.name !== "mnau_attendance") {
    throw new Error(
      `Wrong database "${currentDatabase[0]?.name ?? "unknown"}". Generation blocked.`,
    );
  }

  const now = effectiveNow().toJSDate();

  const lessons = await db.lesson.findMany({
    where: {
      synthetic: true,
      cancelled: false,
      startAt: {
        lte: now,
      },
    },
    select: { id: true },
    orderBy: {
      startAt: "asc",
    },
  });

  let processedLessons = 0;
  let completedLessons = 0;
  let skippedLessons = 0;

  let createdAttendance = 0;
  let preservedAttendance = 0;

  let presentCount = 0;
  let nCount = 0;
  let hvCount = 0;

  for (const candidate of lessons) {
    const result = await db.$transaction(async (tx) => {
      // Serialize with saveJournal before reading missing rows. Recheck cancellation
      // and time eligibility under the lock; never overwrite a concurrent manual mark.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Lesson"
        WHERE "id" = ${candidate.id} AND "synthetic" = true
          AND "cancelled" = false AND "startAt" <= ${now}
        FOR UPDATE
      `;
      if (!locked.length) return null;
      const lesson = await tx.lesson.findUniqueOrThrow({
        where: { id: candidate.id },
        include: { roster: { include: { attendance: true, student: {select: {isSynthetic: true}} } } },
      });
      const existing = lesson.roster.flatMap((row) => row.attendance ? [row.attendance] : []);
      const missing = lesson.roster.filter((row) => row.attendance === null && row.student.isSynthetic);
      if (!missing.length) return { generated: [], preserved: existing.length, completed: false };
      const generated = missing.map((row) => ({
        studentId: row.studentId,
        lessonId: lesson.id,
        statusCode: generateStatus(row.studentId, lesson.id),
        confirmed: true,
        isDemo: true,
      }));
      await tx.attendance.createMany({ data: generated });
      await tx.auditLog.createMany({
        data: generated.map((attendance) => ({
          actorId: null,
          lessonId: lesson.id,
          studentId: attendance.studentId,
          objectType: "Attendance",
          objectId: `${lesson.id}:${attendance.studentId}`,
          oldStatus: null,
          newStatus: attendance.statusCode,
          reason: "Автоматично згенерована демонстраційна відвідуваність",
          source: "DEMO_RANDOM_ATTENDANCE",
          details: { generator: "demo-attendance", preservedExistingAttendance: true },
        })),
      });
      const state = journalStateForRoster(lesson.roster.length, [...existing, ...generated]);
      await tx.lesson.update({
        where: { id: lesson.id },
        data: { journalState: state, version: { increment: 1 } },
      });
      return { generated, preserved: existing.length, completed: state === "CONFIRMED" };
    }, { maxWait: 5000, timeout: 15000 });
    if (!result) continue;
    preservedAttendance += result.preserved;
    if (!result.generated.length) { skippedLessons += 1; continue; }
    processedLessons += 1;
    createdAttendance += result.generated.length;
    if (result.completed) completedLessons += 1;
    for (const row of result.generated) {
      if (row.statusCode === "PRESENT") presentCount += 1;
      else if (row.statusCode === "N") nCount += 1;
      else hvCount += 1;
    }
  }

  const totalGenerated = presentCount + nCount + hvCount;

  const generatedAttendancePercent =
    totalGenerated === 0
      ? 0
      : (presentCount / totalGenerated) * 100;

  console.log("");
  console.log("========================================");
  console.log("DEMO ATTENDANCE GENERATION COMPLETED");
  console.log("========================================");
  console.log("");
  console.log(`Eligible lessons: ${lessons.length}`);
  console.log(`Lessons changed: ${processedLessons}`);
  console.log(`Lessons confirmed: ${completedLessons}`);
  console.log(`Already complete: ${skippedLessons}`);
  console.log("");
  console.log(`Existing marks preserved: ${preservedAttendance}`);
  console.log(`New marks created: ${createdAttendance}`);
  console.log("");
  console.log(`PRESENT: ${presentCount}`);
  console.log(`N: ${nCount}`);
  console.log(`HV: ${hvCount}`);
  console.log(
    `Generated attendance rate: ${generatedAttendancePercent.toFixed(1)}%`,
  );
  console.log("");
  console.log("Existing teacher/starosta marks were not overwritten.");
  console.log("Future and cancelled lessons were not modified.");
  return { processedLessons, completedLessons, skippedLessons, createdAttendance, preservedAttendance };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateDemoAttendance()
    .catch((error) => {
      console.error("Demo attendance generation failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => { await db.$disconnect(); });
}
