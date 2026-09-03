import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StudentPage({ params }: PageProps) {
  const { id } = await params;
  const studentId = Number(id);

  if (Number.isNaN(studentId)) {
    notFound();
  }

  const student = await prisma.student.findUnique({
    where: {
      id: studentId,
    },
    include: {
      group: {
        include: {
          specialty: {
            include: {
              faculty: true,
            },
          },
        },
      },
      attendances: {
        include: {
          status: true,
          lesson: {
            include: {
              subject: true,
              teacher: true,
              building: true,
            },
          },
        },
        orderBy: {
          lesson: {
            date: "desc",
          },
        },
      },
    },
  });

  if (!student) {
    notFound();
  }

  const presentCount = student.attendances.filter(
    (attendance) => attendance.status.code === "PRESENT"
  ).length;

  const absentCount = student.attendances.filter(
    (attendance) => attendance.status.code === "N"
  ).length;

  const hvCount = student.attendances.filter(
    (attendance) => attendance.status.code === "HV"
  ).length;

  const trackedCount = presentCount + absentCount;

  const attendancePercentage =
    trackedCount === 0
      ? 100
      : Math.round((presentCount / trackedCount) * 100);

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href={`/groups/${student.group.id}`}
          className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          ← {student.group.name}
        </Link>

        <div className="mt-6">
          <p className="text-sm font-medium text-slate-500">
            {student.group.specialty.faculty.name}
          </p>

          <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-950">
            {student.lastName} {student.firstName}
          </h1>

          <div className="mt-3 space-y-1 text-sm text-slate-500">
            <p>
              {student.group.specialty.name}, {student.group.name},{" "}
              {student.group.course} курс
            </p>

            <p>
              Телефон: {student.phone ?? "Не вказано"}
            </p>
          </div>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Відвідуваність"
            value={`${attendancePercentage}%`}
          />

          <StatCard
            title="Присутній"
            value={String(presentCount)}
          />

          <StatCard
            title="N"
            value={String(absentCount)}
            subtitle="Пропуски без поважної причини"
          />

          <StatCard
            title="HV"
            value={String(hvCount)}
            subtitle="Поважна причина"
          />
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-slate-950">
              Історія відвідування
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Усі заняття студента за поточний демо-період
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[140px_90px_1fr_180px_120px_120px] border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm font-medium text-slate-500">
              <div>Дата</div>
              <div>Пара</div>
              <div>Предмет</div>
              <div>Викладач</div>
              <div>Аудиторія</div>
              <div>Статус</div>
            </div>

            {student.attendances.map((attendance) => (
              <div
                key={attendance.id}
                className="grid grid-cols-[140px_90px_1fr_180px_120px_120px] items-center border-b border-slate-100 px-6 py-5 last:border-b-0"
              >
                <div className="text-slate-700">
                  {attendance.lesson.date.toLocaleDateString("uk-UA")}
                </div>

                <div className="text-slate-700">
                  {attendance.lesson.lessonNumber}
                </div>

                <div className="font-medium text-slate-900">
                  {attendance.lesson.subject.name}
                </div>

                <div className="text-slate-700">
                  {attendance.lesson.teacher.lastName}{" "}
                  {attendance.lesson.teacher.firstName}
                </div>

                <div className="text-slate-700">
                  {attendance.lesson.building.code}{" "}
                  {attendance.lesson.room}
                </div>

                <StatusBadge code={attendance.status.code} />
              </div>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
        {value}
      </p>

      {subtitle && (
        <p className="mt-2 text-xs text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function StatusBadge({
  code,
}: {
  code: string;
}) {
  let styles = "bg-emerald-50 text-emerald-700";
  let label = "•";

  if (code === "N") {
    styles = "bg-red-50 text-red-700";
    label = "N";
  }

  if (code === "HV") {
    styles = "bg-blue-50 text-blue-700";
    label = "HV";
  }

  return (
    <div>
      <span
        className={`inline-flex min-w-14 justify-center rounded-full px-3 py-1 text-sm font-semibold ${styles}`}
      >
        {label}
      </span>
    </div>
  );
}