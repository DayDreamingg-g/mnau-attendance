import Link from "next/link";
import { redirect } from "next/navigation";

import ThemeToggle from "@/components/ThemeToggle";
import { logoutAction } from "@/app/logout/actions";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TeacherPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role.name !== "TEACHER") {
    redirect("/");
  }

  if (!user.teacherProfile) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-10 transition-colors dark:bg-slate-950">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-slate-900">
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">
              Профіль викладача не знайдено
            </h1>

            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Обліковий запис існує, але він не прив'язаний до профілю
              викладача.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const lessons = await prisma.lesson.findMany({
    where: {
      teacherId: user.teacherProfile.id,
    },
    include: {
      group: {
        include: {
          specialty: true,
        },
      },
      subject: true,
      building: true,
      attendances: {
        include: {
          status: true,
        },
      },
    },
    orderBy: [
      {
        date: "desc",
      },
      {
        lessonNumber: "asc",
      },
    ],
  });

  return (
    <main className="min-h-screen bg-slate-100 transition-colors dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              MNAU Attendance
            </p>

            <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
              Мої заняття
            </h1>

            <p className="mt-2 text-slate-600 dark:text-slate-300">
              {user.lastName} {user.firstName}
            </p>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {user.email}
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

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
              Заняття
            </h2>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Пари, прив'язані до вашого профілю
            </p>
          </div>

          {lessons.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              Для цього викладача занять не знайдено.
            </div>
          )}

          <div className="space-y-4">
            {lessons.map((lesson) => {
              const presentCount = lesson.attendances.filter(
                (attendance) => attendance.status.code === "PRESENT"
              ).length;

              const absentCount = lesson.attendances.filter(
                (attendance) => attendance.status.code === "N"
              ).length;

              const hvCount = lesson.attendances.filter(
                (attendance) => attendance.status.code === "HV"
              ).length;

              return (
                <Link
                  key={lesson.id}
                  href={`/teacher/lessons/${lesson.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-6 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                >
                  <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {lesson.date.toLocaleDateString("uk-UA")}
                        </span>

                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {lesson.lessonNumber} пара
                        </span>
                      </div>

                      <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">
                        {lesson.subject.name}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {lesson.group.name} · {lesson.group.specialty.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {lesson.building.code} {lesson.room}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <SmallStat
                        label="Присутні"
                        value={presentCount}
                      />

                      <SmallStat
                        label="N"
                        value={absentCount}
                      />

                      <SmallStat
                        label="HV"
                        value={hvCount}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-24 rounded-xl bg-slate-50 px-4 py-3 text-center dark:bg-slate-950">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}