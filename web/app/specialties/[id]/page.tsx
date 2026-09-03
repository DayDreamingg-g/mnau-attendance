import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    course?: string;
  }>;
};

export default async function SpecialtyPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { course } = await searchParams;

  const specialtyId = Number(id);

  if (Number.isNaN(specialtyId)) {
    notFound();
  }

  const parsedCourse = Number(course);

  const selectedCourse =
    course &&
    !Number.isNaN(parsedCourse) &&
    parsedCourse >= 1 &&
    parsedCourse <= 4
      ? parsedCourse
      : null;

  const specialty = await prisma.specialty.findUnique({
    where: {
      id: specialtyId,
    },
    include: {
      faculty: true,
      groups: {
        where: selectedCourse
          ? {
              course: selectedCourse,
            }
          : undefined,
        include: {
          students: {
            include: {
              attendances: {
                include: {
                  status: true,
                },
              },
            },
          },
        },
        orderBy: [
          {
            course: "asc",
          },
          {
            name: "asc",
          },
        ],
      },
    },
  });

  if (!specialty) {
    notFound();
  }

  const groupStats = specialty.groups.map((group) => {
    let present = 0;
    let tracked = 0;

    const students = group.students.map((student) => {
      const counted = student.attendances.filter(
        (attendance) => attendance.status.code !== "HV"
      );

      const studentPresent = counted.filter(
        (attendance) => attendance.status.code === "PRESENT"
      ).length;

      const percentage =
        counted.length === 0
          ? 100
          : Math.round((studentPresent / counted.length) * 100);

      present += studentPresent;
      tracked += counted.length;

      return {
        id: student.id,
        name: `${student.lastName} ${student.firstName}`,
        percentage,
      };
    });

    const percentage =
      tracked === 0
        ? 100
        : Math.round((present / tracked) * 100);

    const warningCount = students.filter(
      (student) => student.percentage < 70
    ).length;

    const criticalCount = students.filter(
      (student) => student.percentage < 50
    ).length;

    return {
      id: group.id,
      name: group.name,
      course: group.course,
      studentsCount: group.students.length,
      percentage,
      warningCount,
      criticalCount,
    };
  });

  const totalStudents = groupStats.reduce(
    (sum, group) => sum + group.studentsCount,
    0
  );

  let totalPresent = 0;
  let totalTracked = 0;

  for (const group of specialty.groups) {
    for (const student of group.students) {
      for (const attendance of student.attendances) {
        if (attendance.status.code === "HV") {
          continue;
        }

        totalTracked++;

        if (attendance.status.code === "PRESENT") {
          totalPresent++;
        }
      }
    }
  }

  const averageAttendance =
    totalTracked === 0
      ? 100
      : Math.round((totalPresent / totalTracked) * 100);

  const totalWarning = groupStats.reduce(
    (sum, group) => sum + group.warningCount,
    0
  );

  const totalCritical = groupStats.reduce(
    (sum, group) => sum + group.criticalCount,
    0
  );

  const courseLabel = selectedCourse
    ? `${selectedCourse} курс`
    : "Усі курси";

  const backHref = selectedCourse
    ? `/?course=${selectedCourse}`
    : "/";

  return (
    <main className="min-h-screen bg-slate-100 transition-colors dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href={backHref}
          className="text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Факультет менеджменту
          {selectedCourse ? ` · ${selectedCourse} курс` : ""}
        </Link>

        <div className="mt-6">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {specialty.faculty.name}
          </p>

          <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
            {specialty.name}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            {specialty.code && (
              <span>
                Код спеціальності: {specialty.code}
              </span>
            )}

            <span>
              {courseLabel}
            </span>
          </div>
        </div>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Курс
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Оберіть курс для цієї спеціальності
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <CourseButton
              href={`/specialties/${specialty.id}`}
              label="Усі"
              active={selectedCourse === null}
            />

            {[1, 2, 3, 4].map((courseNumber) => (
              <CourseButton
                key={courseNumber}
                href={`/specialties/${specialty.id}?course=${courseNumber}`}
                label={`${courseNumber} курс`}
                active={selectedCourse === courseNumber}
              />
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Середня відвідуваність"
            value={`${averageAttendance}%`}
            subtitle={courseLabel}
          />

          <StatCard
            title="Студенти"
            value={String(totalStudents)}
            subtitle={courseLabel}
          />

          <StatCard
            title="Потребують уваги"
            value={String(totalWarning)}
            subtitle="Нижче 70%"
          />

          <StatCard
            title="Критичний рівень"
            value={String(totalCritical)}
            subtitle="Нижче 50%"
          />
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
              Групи
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Статистика відвідуваності · {courseLabel}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-[1fr_110px_120px_150px_150px_150px] border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              <div>Група</div>
              <div>Курс</div>
              <div>Студенти</div>
              <div>Відвідуваність</div>
              <div>Нижче 70%</div>
              <div>Нижче 50%</div>
            </div>

            {groupStats.length === 0 && (
              <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                На цьому курсі немає груп цієї спеціальності.
              </div>
            )}

            {groupStats.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="grid grid-cols-[1fr_110px_120px_150px_150px_150px] items-center border-b border-slate-100 px-6 py-5 transition hover:bg-slate-50 last:border-b-0 dark:border-slate-800 dark:hover:bg-slate-800/60"
              >
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {group.name}
                </div>

                <div className="text-slate-700 dark:text-slate-300">
                  {group.course}
                </div>

                <div className="text-slate-700 dark:text-slate-300">
                  {group.studentsCount}
                </div>

                <AttendanceBadge
                  percentage={group.percentage}
                />

                <div className="text-slate-700 dark:text-slate-300">
                  {group.warningCount}
                </div>

                <div className="text-slate-700 dark:text-slate-300">
                  {group.criticalCount}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function CourseButton({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition dark:bg-white dark:text-slate-950"
          : "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      }
    >
      {label}
    </Link>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {title}
      </p>

      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
        {value}
      </p>

      {subtitle && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function AttendanceBadge({
  percentage,
}: {
  percentage: number;
}) {
  let styles =
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";

  if (percentage < 70) {
    styles =
      "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
  }

  if (percentage < 50) {
    styles =
      "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300";
  }

  return (
    <div>
      <span
        className={`inline-flex min-w-16 justify-center rounded-full px-3 py-1 text-sm font-semibold ${styles}`}
      >
        {percentage}%
      </span>
    </div>
  );
}