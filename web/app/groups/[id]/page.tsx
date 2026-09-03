import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function GroupPage({ params }: PageProps) {
  const { id } = await params;
  const groupId = Number(id);

  if (Number.isNaN(groupId)) {
    notFound();
  }

  const group = await prisma.group.findUnique({
    where: {
      id: groupId,
    },
    include: {
      specialty: {
        include: {
          faculty: true,
        },
      },
      students: {
        include: {
          attendances: {
            include: {
              status: true,
              lesson: {
                include: {
                  subject: true,
                },
              },
            },
          },
        },
        orderBy: {
          lastName: "asc",
        },
      },
    },
  });

  if (!group) {
    notFound();
  }

  const studentStats = group.students.map((student) => {
    const counted = student.attendances.filter(
      (attendance) => attendance.status.code !== "HV"
    );

    const presentCount = counted.filter(
      (attendance) => attendance.status.code === "PRESENT"
    ).length;

    const absentCount = student.attendances.filter(
      (attendance) => attendance.status.code === "N"
    ).length;

    const hvCount = student.attendances.filter(
      (attendance) => attendance.status.code === "HV"
    ).length;

    const percentage =
      counted.length === 0
        ? 100
        : Math.round((presentCount / counted.length) * 100);

    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      percentage,
      presentCount,
      absentCount,
      hvCount,
    };
  });

  const averageAttendance =
    studentStats.length === 0
      ? 100
      : Math.round(
          studentStats.reduce(
            (sum, student) => sum + student.percentage,
            0
          ) / studentStats.length
        );

  const warningStudents = studentStats.filter(
    (student) => student.percentage < 70
  );

  const criticalStudents = studentStats.filter(
    (student) => student.percentage < 50
  );

  const lessonsCount =
    group.students.length === 0
      ? 0
      : Math.max(
          ...group.students.map(
            (student) => student.attendances.length
          )
        );

  return (
    <main className="min-h-screen bg-slate-100 transition-colors dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href={`/specialties/${group.specialty.id}`}
          className="text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          ← {group.specialty.name}
        </Link>

        <div className="mt-6">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {group.specialty.faculty.name}
          </p>

          <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
            {group.name}
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {group.specialty.name}, {group.course} курс
          </p>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Середня відвідуваність"
            value={`${averageAttendance}%`}
          />

          <StatCard
            title="Студенти"
            value={String(studentStats.length)}
          />

          <StatCard
            title="Потребують уваги"
            value={String(warningStudents.length)}
            subtitle="Нижче 70%"
          />

          <StatCard
            title="Критичний рівень"
            value={String(criticalStudents.length)}
            subtitle="Нижче 50%"
          />
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
                Студенти
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Індивідуальна статистика відвідуваності
              </p>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Занять за період: {lessonsCount}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-[1fr_150px_120px_100px_100px] border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              <div>Студент</div>
              <div>Відвідуваність</div>
              <div>Присутній</div>
              <div>N</div>
              <div>HV</div>
            </div>

            {studentStats.map((student) => (
              <Link
                key={student.id}
                href={`/students/${student.id}`}
                className="grid grid-cols-[1fr_150px_120px_100px_100px] items-center border-b border-slate-100 px-6 py-5 transition hover:bg-slate-50 last:border-b-0 dark:border-slate-800 dark:hover:bg-slate-800/60"
              >
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {student.lastName} {student.firstName}
                </div>

                <AttendanceBadge
                  percentage={student.percentage}
                />

                <div className="text-slate-700 dark:text-slate-300">
                  {student.presentCount}
                </div>

                <div className="text-slate-700 dark:text-slate-300">
                  {student.absentCount}
                </div>

                <div className="text-slate-700 dark:text-slate-300">
                  {student.hvCount}
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