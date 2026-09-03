import Link from "next/link";
import { redirect } from "next/navigation";

import ThemeToggle from "@/components/ThemeToggle";
import { logoutAction } from "@/app/logout/actions";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type HomePageProps = {
  searchParams: Promise<{
    course?: string;
  }>;
};

export default async function Home({
  searchParams,
}: HomePageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { course } = await searchParams;

  const parsedCourse = Number(course);

  const selectedCourse =
    course &&
    !Number.isNaN(parsedCourse) &&
    parsedCourse >= 1 &&
    parsedCourse <= 4
      ? parsedCourse
      : null;

  const specialties = await prisma.specialty.findMany({
    include: {
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
    orderBy: {
      name: "asc",
    },
  });

  const visibleSpecialties = specialties.filter(
    (specialty) => specialty.groups.length > 0
  );

  const allStudents = visibleSpecialties.flatMap((specialty) =>
    specialty.groups.flatMap((group) => group.students)
  );

  let totalPresent = 0;
  let totalTracked = 0;

  const studentStats = allStudents.map((student) => {
    const counted = student.attendances.filter(
      (attendance) => attendance.status.code !== "HV"
    );

    const present = counted.filter(
      (attendance) => attendance.status.code === "PRESENT"
    ).length;

    const percentage =
      counted.length === 0
        ? 100
        : Math.round((present / counted.length) * 100);

    totalPresent += present;
    totalTracked += counted.length;

    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      percentage,
    };
  });

  const averageAttendance =
    totalTracked === 0
      ? 100
      : Math.round((totalPresent / totalTracked) * 100);

  const warningStudents = studentStats.filter(
    (student) => student.percentage < 70
  );

  const criticalStudents = studentStats.filter(
    (student) => student.percentage < 50
  );

  const specialtyStats = visibleSpecialties.map((specialty) => {
    let present = 0;
    let tracked = 0;

    for (const group of specialty.groups) {
      for (const student of group.students) {
        for (const attendance of student.attendances) {
          if (attendance.status.code === "HV") {
            continue;
          }

          tracked++;

          if (attendance.status.code === "PRESENT") {
            present++;
          }
        }
      }
    }

    const percentage =
      tracked === 0
        ? 100
        : Math.round((present / tracked) * 100);

    return {
      id: specialty.id,
      name: specialty.name,
      code: specialty.code,
      percentage,
      groupsCount: specialty.groups.length,
      studentsCount: specialty.groups.reduce(
        (sum, group) => sum + group.students.length,
        0
      ),
    };
  });

  const courseLabel = selectedCourse
    ? `${selectedCourse} курс`
    : "Усі курси";

  return (
    <main className="min-h-screen bg-slate-100 transition-colors dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10 flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Миколаївський національний аграрний університет
            </p>

            <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
              Факультет менеджменту
            </h1>

            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Аналітика відвідуваності студентів
            </p>

            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {user.firstName} {user.lastName} · {user.role.name}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Вийти
              </button>
            </form>
          </div>
        </div>

        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Курс
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Оберіть курс для фільтрації аналітики
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <CourseButton
              href="/"
              label="Усі"
              active={selectedCourse === null}
            />

            {[1, 2, 3, 4].map((courseNumber) => (
              <CourseButton
                key={courseNumber}
                href={`/?course=${courseNumber}`}
                label={`${courseNumber} курс`}
                active={selectedCourse === courseNumber}
              />
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Середня відвідуваність"
            value={`${averageAttendance}%`}
            subtitle={courseLabel}
          />

          <StatCard
            title="Студенти"
            value={String(allStudents.length)}
            subtitle={courseLabel}
          />

          <StatCard
            title="Потребують уваги"
            value={String(warningStudents.length)}
            subtitle="Відвідуваність нижче 70%"
          />

          <StatCard
            title="Критичний рівень"
            value={String(criticalStudents.length)}
            subtitle="Відвідуваність нижче 50%"
          />
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
              Спеціальності
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Поточна статистика · {courseLabel}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-[1fr_110px_110px_150px] border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              <div>Спеціальність</div>
              <div>Групи</div>
              <div>Студенти</div>
              <div>Відвідуваність</div>
            </div>

            {specialtyStats.map((specialty) => (
              <Link
                key={specialty.id}
                href={`/specialties/${specialty.id}${
                  selectedCourse
                    ? `?course=${selectedCourse}`
                    : ""
                }`}
                className="grid grid-cols-[1fr_110px_110px_150px] items-center border-b border-slate-100 px-6 py-5 transition hover:bg-slate-50 last:border-b-0 dark:border-slate-800 dark:hover:bg-slate-800/60"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {specialty.name}
                  </p>

                  {specialty.code && (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {specialty.code}
                    </p>
                  )}
                </div>

                <div className="text-slate-700 dark:text-slate-300">
                  {specialty.groupsCount}
                </div>

                <div className="text-slate-700 dark:text-slate-300">
                  {specialty.studentsCount}
                </div>

                <AttendanceBadge
                  percentage={specialty.percentage}
                />
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              Критичні студенти
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Відвідуваність нижче 50% · {courseLabel}
            </p>

            <div className="mt-5 space-y-3">
              {criticalStudents.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Критичних студентів немає.
                </p>
              )}

              {criticalStudents.slice(0, 8).map((student) => (
                <Link
                  key={student.id}
                  href={`/students/${student.id}`}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 transition hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {student.lastName} {student.firstName}
                  </span>

                  <AttendanceBadge
                    percentage={student.percentage}
                  />
                </Link>
              ))}

              {criticalStudents.length > 8 && (
                <p className="pt-1 text-xs text-slate-400 dark:text-slate-500">
                  Показано 8 із {criticalStudents.length}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              Огляд факультету
            </h2>

            <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <p>
                Поточний фільтр:{" "}
                <strong className="font-semibold text-slate-900 dark:text-slate-100">
                  {courseLabel}
                </strong>
                .
              </p>

              <p>
                У вибірці {specialtyStats.length} спеціальностей та{" "}
                {allStudents.length} студентів.
              </p>

              <p>
                Статистика автоматично перераховується за даними
                відвідуваності.
              </p>

              <p>
                HV не враховується як звичайний прогул при розрахунку
                відсотка відвідуваності.
              </p>
            </div>
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