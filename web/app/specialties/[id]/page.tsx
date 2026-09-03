import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SpecialtyPage({ params }: PageProps) {
  const { id } = await params;
  const specialtyId = Number(id);

  if (Number.isNaN(specialtyId)) {
    notFound();
  }

  const specialty = await prisma.specialty.findUnique({
    where: {
      id: specialtyId,
    },
    include: {
      faculty: true,
      groups: {
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
        orderBy: {
          name: "asc",
        },
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
      tracked === 0 ? 100 : Math.round((present / tracked) * 100);

    const warningCount = students.filter(
      (student) => student.percentage < 70
    ).length;

    const criticalCount = students.filter(
      (student) => student.percentage < 50
    ).length;

    return {
      id: group.id,
      name: group.name,
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

  const averageAttendance =
    groupStats.length === 0
      ? 100
      : Math.round(
          groupStats.reduce(
            (sum, group) => sum + group.percentage,
            0
          ) / groupStats.length
        );

  const totalWarning = groupStats.reduce(
    (sum, group) => sum + group.warningCount,
    0
  );

  const totalCritical = groupStats.reduce(
    (sum, group) => sum + group.criticalCount,
    0
  );

  return (
    <main className="min-h-screen bg-slate-100 transition-colors dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/"
          className="text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← Факультет менеджменту
        </Link>

        <div className="mt-6">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {specialty.faculty.name}
          </p>

          <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
            {specialty.name}
          </h1>

          {specialty.code && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Код спеціальності: {specialty.code}
            </p>
          )}
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Середня відвідуваність"
            value={`${averageAttendance}%`}
          />

          <StatCard
            title="Студенти"
            value={String(totalStudents)}
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
              Статистика відвідуваності по навчальних групах
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-[1fr_120px_150px_150px_150px] border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              <div>Група</div>
              <div>Студенти</div>
              <div>Відвідуваність</div>
              <div>Нижче 70%</div>
              <div>Нижче 50%</div>
            </div>

            {groupStats.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="grid grid-cols-[1fr_120px_150px_150px_150px] items-center border-b border-slate-100 px-6 py-5 transition hover:bg-slate-50 last:border-b-0 dark:border-slate-800 dark:hover:bg-slate-800/60"
              >
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {group.name}
                </div>

                <div className="text-slate-700 dark:text-slate-300">
                  {group.studentsCount}
                </div>

                <AttendanceBadge percentage={group.percentage} />

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