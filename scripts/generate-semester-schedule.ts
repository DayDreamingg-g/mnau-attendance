import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { DateTime } from "luxon";

import { db } from "../src/lib/db";
import { atKyiv, demoEnabled, ZONE } from "../src/lib/time";

import type { Prisma } from "../src/generated/prisma/client";

type SourceGroup = {
  id: string;
  name: string;
  course: number;
  specialty: string;
  source: unknown;
};

type Weekday =
  | "MON"
  | "TUE"
  | "WED"
  | "THU"
  | "FRI";

type Cell = {
  id: string;
  file: string;
  page: number;
  bbox: number[];
  raw: string;
  groups: string[];
  weekday: Weekday | null;
  pairNumber: number | null;
  splitCell: boolean;
  subject: string | null;
  teacher: string | null;
  building: string | null;
  room: string | null;
  issues: string[];
  usableForSyntheticDemo: boolean;
};

type ScheduleCell = Cell & {
  weekday: Weekday;
  pairNumber: number;
  subject: string;
  building: string;
  room: string;
};

const bellTimes = [
  ["08:30", "09:50"],
  ["10:05", "11:25"],
  ["11:55", "13:15"],
  ["13:30", "14:50"],
  ["15:05", "16:25"],
  ["16:40", "18:00"],
  ["18:10", "19:10"],
  ["19:20", "20:20"],
] as const;

const weekdayNumbers: Record<Weekday, number> = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
};

function stableId(
  prefix: string,
  value: string,
) {
  return `${prefix}-${createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 16)}`;
}

function subjectId(subject: string) {
  return stableId(
    "subject",
    subject.toLocaleLowerCase("uk"),
  );
}

function teacherId(teacher: string) {
  return stableId(
    "teacher",
    teacher,
  );
}

function getArgument(name: string) {
  const prefix = `--${name}=`;

  const item = process.argv
    .slice(2)
    .find((value) => value.startsWith(prefix));

  return item?.slice(prefix.length);
}

function hasFlag(name: string) {
  return process.argv
    .slice(2)
    .includes(`--${name}`);
}

function parseDate(
  value: string,
  label: string,
) {
  const parsed = DateTime.fromISO(
    value,
    {
      zone: ZONE,
    },
  );

  if (
    !parsed.isValid ||
    parsed.toISODate() !== value
  ) {
    throw new Error(
      `${label} must be YYYY-MM-DD. Received: ${value}`,
    );
  }

  return parsed.startOf("day");
}

function chunks<T>(
  items: T[],
  size: number,
) {
  const result: T[][] = [];

  for (
    let index = 0;
    index < items.length;
    index += size
  ) {
    result.push(
      items.slice(
        index,
        index + size,
      ),
    );
  }

  return result;
}

function isScheduleCell(
  cell: Cell,
  knownGroupIds: Set<string>,
): cell is ScheduleCell {
  return Boolean(
    cell.usableForSyntheticDemo &&
      cell.weekday &&
      cell.pairNumber &&
      cell.pairNumber >= 1 &&
      cell.pairNumber <= bellTimes.length &&
      cell.subject &&
      cell.building &&
      cell.room &&
      cell.groups.length > 0 &&
      cell.groups.every(
        (groupId) =>
          knownGroupIds.has(groupId),
      ),
  );
}

async function removeLessonsByPrefix(
  prefix: string,
) {
  await db.$transaction(
    async (tx) => {
      await tx.auditLog.deleteMany({
        where: {
          lessonId: {
            startsWith: prefix,
          },
        },
      });

      await tx.journalSubmission.deleteMany({
        where: {
          lessonId: {
            startsWith: prefix,
          },
        },
      });

      await tx.attendance.deleteMany({
        where: {
          lessonId: {
            startsWith: prefix,
          },
        },
      });

      await tx.lessonStudent.deleteMany({
        where: {
          lessonId: {
            startsWith: prefix,
          },
        },
      });

      await tx.lessonGroup.deleteMany({
        where: {
          lessonId: {
            startsWith: prefix,
          },
        },
      });

      await tx.lesson.deleteMany({
        where: {
          id: {
            startsWith: prefix,
          },
        },
      });
    },
    {
      maxWait: 10_000,
      timeout: 60_000,
    },
  );
}

export async function generateSemesterSchedule() {
  if (
    !demoEnabled() ||
    process.env.APP_ENV === "production"
  ) {
    throw new Error(
      "Semester schedule generation is allowed only in demo mode.",
    );
  }

  const database =
    await db.$queryRaw<
      { name: string }[]
    >`
      SELECT current_database() AS name
    `;

  if (
    database[0]?.name !==
    "mnau_attendance"
  ) {
    throw new Error(
      `Wrong database "${
        database[0]?.name ??
        "unknown"
      }". Generation blocked.`,
    );
  }

  /*
   * PDF confirms the semester/year,
   * but not an exact academic calendar.
   *
   * These are DEMO defaults and can
   * always be overridden from CLI.
   */
  const from = parseDate(
    getArgument("from") ??
      "2026-09-01",
    "--from",
  );

  const to = parseDate(
    getArgument("to") ??
      "2027-01-31",
    "--to",
  );

  const replace =
    hasFlag("replace");

  if (
    from.toMillis() >
    to.toMillis()
  ) {
    throw new Error(
      "--from must not be later than --to.",
    );
  }

  if (
    to.diff(from, "days").days >
    220
  ) {
    throw new Error(
      "Schedule range is too large. Use 220 days or less.",
    );
  }

  const groups = JSON.parse(
    await readFile(
      "source-data/groups.json",
      "utf8",
    ),
  ) as SourceGroup[];

  const cells = JSON.parse(
    await readFile(
      "source-data/schedule-cells.json",
      "utf8",
    ),
  ) as Cell[];

  const knownGroupIds =
    new Set(
      groups.map(
        (group) => group.id,
      ),
    );

  const scheduleCells =
    cells.filter(
      (
        cell,
      ): cell is ScheduleCell =>
        isScheduleCell(
          cell,
          knownGroupIds,
        ),
    );

  if (!scheduleCells.length) {
    throw new Error(
      "No usable weekly schedule cells were found.",
    );
  }

  const databaseGroups =
    await db.group.findMany({
      where: {
        id: {
          in: [
            ...knownGroupIds,
          ],
        },
      },
      select: {
        id: true,
      },
    });

  const databaseGroupIds =
    new Set(
      databaseGroups.map(
        (group) => group.id,
      ),
    );

  const missingGroups = [
    ...knownGroupIds,
  ].filter(
    (groupId) =>
      !databaseGroupIds.has(
        groupId,
      ),
  );

  if (missingGroups.length) {
    throw new Error(
      `Run db:seed first. Missing groups: ${missingGroups.join(
        ", ",
      )}`,
    );
  }

  /*
   * Ensure every subject and teacher
   * used by the semester schedule exists.
   *
   * Teacher is nullable in Lesson,
   * therefore source cells without a
   * confirmed teacher stay nullable.
   */
  for (
    const cell of scheduleCells
  ) {
    await db.subject.upsert({
      where: {
        id: subjectId(
          cell.subject,
        ),
      },
      create: {
        id: subjectId(
          cell.subject,
        ),
        name: cell.subject,
        source: {
          sourceId: cell.id,
          file: cell.file,
          page: cell.page,
          raw: cell.raw,
        },
      },
      update: {},
    });

    if (cell.teacher) {
      await db.teacher.upsert({
        where: {
          id: teacherId(
            cell.teacher,
          ),
        },
        create: {
          id: teacherId(
            cell.teacher,
          ),
          displayName:
            cell.teacher,
          source: {
            sourceId: cell.id,
            file: cell.file,
            page: cell.page,
            raw: cell.raw,
          },
        },
        update: {},
      });
    }
  }

  const students =
    await db.student.findMany({
      where: {
        groupId: {
          in: [
            ...knownGroupIds,
          ],
        },
      },
      select: {
        id: true,
        groupId: true,
      },
      orderBy: {
        id: "asc",
      },
    });

  const studentsByGroup =
    new Map<
      string,
      string[]
    >();

  for (
    const student of students
  ) {
    const list =
      studentsByGroup.get(
        student.groupId,
      ) ?? [];

    list.push(
      student.id,
    );

    studentsByGroup.set(
      student.groupId,
      list,
    );
  }

  /*
   * Delete the old fake schedule:
   *
   * demo-history-*
   * demo-live-*
   * demo-future-*
   * demo-cancelled-*
   * demo-joint-*
   *
   * Other application data,
   * users, roles and groups stay intact.
   */
  await removeLessonsByPrefix(
    "demo-",
  );

  /*
   * --replace additionally recreates
   * schedule-* lessons.
   *
   * Without it the command is idempotent
   * and preserves existing attendance.
   */
  if (replace) {
    await removeLessonsByPrefix(
      "schedule-",
    );
  }

  const lessons:
    Prisma.LessonCreateManyInput[] =
      [];

  const lessonGroups:
    Prisma.LessonGroupCreateManyInput[] =
      [];

  const roster:
    Prisma.LessonStudentCreateManyInput[] =
      [];

  let cursor = from;

  while (
    cursor.toMillis() <=
    to.toMillis()
  ) {
    if (
      cursor.weekday >= 1 &&
      cursor.weekday <= 5
    ) {
      const isoDate =
        cursor.toISODate()!;

      for (
        const cell of scheduleCells
      ) {
        if (
          weekdayNumbers[
            cell.weekday
          ] !== cursor.weekday
        ) {
          continue;
        }

        const pairNumber =
          cell.pairNumber;

        const [
          startTime,
          endTime,
        ] =
          bellTimes[
            pairNumber - 1
          ];

        const lessonId =
          `schedule-${isoDate}-${cell.id}`;

        const groupIds = [
          ...new Set(
            cell.groups,
          ),
        ].sort();

        const studentIds = [
          ...new Set(
            groupIds.flatMap(
              (groupId) =>
                studentsByGroup.get(
                  groupId,
                ) ?? [],
            ),
          ),
        ];

        lessons.push({
          id: lessonId,

          startAt: atKyiv(
            isoDate,
            startTime,
          ),

          endAt: atKyiv(
            isoDate,
            endTime,
          ),

          pairNumber,

          subjectId:
            subjectId(
              cell.subject,
            ),

          teacherId:
            cell.teacher
              ? teacherId(
                  cell.teacher,
                )
              : null,

          buildingId:
            cell.building,

          room:
            cell.room,

          bellId:
            `bell-${pairNumber}`,

          sourceId:
            cell.id,

          synthetic:
            true,

          cancelled:
            false,

          starostaAllowed:
            true,

          kind:
            groupIds.length > 1
              ? "Спільне заняття за розкладом"
              : "Заняття за розкладом",

          subgroup:
            null,

          weekPattern:
            cell.splitCell
              ? "Поділ клітинки у PDF; точний шаблон тижнів не підтверджено"
              : "Щотижня за PDF-розкладом",

          journalState:
            "EMPTY",

          version:
            0,
        });

        for (
          const groupId of groupIds
        ) {
          lessonGroups.push({
            lessonId,
            groupId,
          });
        }

        for (
          const studentId of studentIds
        ) {
          roster.push({
            lessonId,
            studentId,
          });
        }
      }
    }

    cursor =
      cursor.plus({
        days: 1,
      });
  }

  /*
   * Insert in chunks so a full semester
   * does not hit PostgreSQL parameter limits.
   */
  for (
    const batch of chunks(
      lessons,
      400,
    )
  ) {
    await db.lesson.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  for (
    const batch of chunks(
      lessonGroups,
      1_500,
    )
  ) {
    await db.lessonGroup.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  for (
    const batch of chunks(
      roster,
      2_000,
    )
  ) {
    await db.lessonStudent.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  const scheduleLessonsInRange =
    await db.lesson.count({
      where: {
        id: {
          startsWith:
            "schedule-",
        },

        startAt: {
          gte:
            from.toJSDate(),

          lte:
            to
              .endOf("day")
              .toJSDate(),
        },
      },
    });

  const groupsCovered =
    new Set(
      scheduleCells.flatMap(
        (cell) =>
          cell.groups,
      ),
    );

  const sharedCells =
    scheduleCells.filter(
      (cell) =>
        cell.groups.length > 1,
    ).length;

  const splitCells =
    scheduleCells.filter(
      (cell) =>
        cell.splitCell,
    ).length;

  console.log("");
  console.log(
    "========================================",
  );
  console.log(
    "SEMESTER SCHEDULE GENERATION COMPLETED",
  );
  console.log(
    "========================================",
  );
  console.log("");

  console.log(
    `Range: ${from.toISODate()} -> ${to.toISODate()}`,
  );

  console.log(
    `Weekly source cells: ${scheduleCells.length}`,
  );

  console.log(
    `Groups covered: ${groupsCovered.size}`,
  );

  console.log(
    `Schedule lessons in range: ${scheduleLessonsInRange}`,
  );

  console.log(
    `Roster rows prepared: ${roster.length}`,
  );

  console.log(
    `Shared source cells per week: ${sharedCells}`,
  );

  console.log(
    `Split PDF cells per week: ${splitCells}`,
  );

  console.log("");
  console.log(
    "Old demo-* lessons were removed.",
  );

  console.log(
    replace
      ? "Existing schedule-* lessons were replaced."
      : "Existing schedule-* lessons were preserved.",
  );

  console.log(
    "Attendance was not generated.",
  );

  console.log(
    "Run npm run demo:attendance afterwards if needed.",
  );

  return {
    from:
      from.toISODate(),

    to:
      to.toISODate(),

    weeklyCells:
      scheduleCells.length,

    groupsCovered:
      groupsCovered.size,

    scheduleLessonsInRange,

    rosterRows:
      roster.length,

    sharedCells,

    splitCells,
  };
}

if (
  process.argv[1] &&
  import.meta.url ===
    pathToFileURL(
      process.argv[1],
    ).href
) {
  generateSemesterSchedule()
    .catch((error) => {
      console.error(
        "Semester schedule generation failed:",
        error,
      );

      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}