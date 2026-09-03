import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL!;

const adapter = new PrismaPg(
  {
    connectionString,
  },
  {
    schema: "attendance",
  }
);

const prisma = new PrismaClient({ adapter });

// --------------------------------------------------
// DEMO STUDENTS
// --------------------------------------------------

const firstNames = [
  "Олександр",
  "Максим",
  "Дмитро",
  "Артем",
  "Владислав",
  "Андрій",
  "Богдан",
  "Михайло",
  "Марія",
  "Софія",
  "Анна",
  "Ірина",
  "Катерина",
  "Вікторія",
  "Аліна",
];

const lastNames = [
  "Коваленко",
  "Шевченко",
  "Мельник",
  "Бондаренко",
  "Ткаченко",
  "Кравченко",
  "Савченко",
  "Мороз",
  "Левченко",
  "Романенко",
  "Петренко",
  "Іваненко",
  "Бойко",
  "Марченко",
  "Поліщук",
];

// --------------------------------------------------
// REAL MNAU TEACHERS FROM THE SCHEDULE
//
// Emails below are DEMO identifiers only.
// They are not real university emails.
// --------------------------------------------------

const teachers = [
  {
    firstName: "А.М.",
    lastName: "Коломієць",
    email: "kolomiets.am@demo.mnau.local",
  },
  {
    firstName: "С.І.",
    lastName: "Ємельянов",
    email: "yemelianov.si@demo.mnau.local",
  },
  {
    firstName: "О.Ю.",
    lastName: "Пархоменко",
    email: "parkhomenko.oyu@demo.mnau.local",
  },
  {
    firstName: "С.І.",
    lastName: "Павлюк",
    email: "pavliuk.si@demo.mnau.local",
  },
  {
    firstName: "А.С.",
    lastName: "Полторак",
    email: "poltorak.as@demo.mnau.local",
  },
  {
    firstName: "А.І.",
    lastName: "Бурковська",
    email: "burkovska.ai@demo.mnau.local",
  },
  {
    firstName: "Н.І.",
    lastName: "Галунець",
    email: "halunets.ni@demo.mnau.local",
  },
  {
    firstName: "В.М.",
    lastName: "Стамат",
    email: "stamat.vm@demo.mnau.local",
  },
  {
    firstName: "Ю.Ю.",
    lastName: "Чебан",
    email: "cheban.yuyu@demo.mnau.local",
  },
  {
    firstName: "К.А.",
    lastName: "Мікуляк",
    email: "mikuliak.ka@demo.mnau.local",
  },
  {
    firstName: "І.О.",
    lastName: "Піюренко",
    email: "piurenko.io@demo.mnau.local",
  },
  {
    firstName: "А.В.",
    lastName: "Ключник",
    email: "kliuchnyk.av@demo.mnau.local",
  },
  {
    firstName: "Л.Ю.",
    lastName: "Прогонюк",
    email: "prohoniuk.lyu@demo.mnau.local",
  },
];

// --------------------------------------------------
// REAL SUBJECT -> TEACHER MAPPINGS
// --------------------------------------------------

const subjectCatalog = [
  {
    name: "Прикладне програмування",
    teacherEmail: "kolomiets.am@demo.mnau.local",
  },
  {
    name: "Об'єктно-орієнтоване програмування",
    teacherEmail: "kolomiets.am@demo.mnau.local",
  },
  {
    name: "Фреймворки JavaScript",
    teacherEmail: "kolomiets.am@demo.mnau.local",
  },
  {
    name: "Основи ІТ-підприємництва",
    teacherEmail: "yemelianov.si@demo.mnau.local",
  },
  {
    name: "ІС і технології в управлінні",
    teacherEmail: "pavliuk.si@demo.mnau.local",
  },
  {
    name: "Інтелектуальний аналіз даних",
    teacherEmail: "parkhomenko.oyu@demo.mnau.local",
  },
  {
    name: "Основи наукових досліджень",
    teacherEmail: "poltorak.as@demo.mnau.local",
  },
  {
    name: "Менеджмент",
    teacherEmail: "burkovska.ai@demo.mnau.local",
  },
  {
    name: "Теорія організацій",
    teacherEmail: "burkovska.ai@demo.mnau.local",
  },
  {
    name: "Публічне управління та адміністрування",
    teacherEmail: "halunets.ni@demo.mnau.local",
  },
  {
    name: "Соціальні мережі у публічному управлінні",
    teacherEmail: "prohoniuk.lyu@demo.mnau.local",
  },
  {
    name: "Маркетинг",
    teacherEmail: "stamat.vm@demo.mnau.local",
  },
  {
    name: "Бухгалтерський облік та аудит",
    teacherEmail: "cheban.yuyu@demo.mnau.local",
  },
  {
    name: "Облік і оподаткування ФОП",
    teacherEmail: "cheban.yuyu@demo.mnau.local",
  },
  {
    name: "Корпоративні фінанси",
    teacherEmail: "mikuliak.ka@demo.mnau.local",
  },
  {
    name: "Менеджмент в туризмі",
    teacherEmail: "poltorak.as@demo.mnau.local",
  },
  {
    name: "Event-менеджмент",
    teacherEmail: "piurenko.io@demo.mnau.local",
  },
  {
    name: "Економіка туризму",
    teacherEmail: "kliuchnyk.av@demo.mnau.local",
  },
];

// --------------------------------------------------
// SUBJECT POOLS BY SPECIALTY
//
// This determines which realistic subjects are shown
// for each demo group.
// --------------------------------------------------

const specialtySubjects: Record<string, string[]> = {
  "Комп'ютерні науки": [
    "Прикладне програмування",
    "Об'єктно-орієнтоване програмування",
    "Фреймворки JavaScript",
    "Основи ІТ-підприємництва",
    "Інтелектуальний аналіз даних",
    "Основи наукових досліджень",
  ],

  Менеджмент: [
    "Менеджмент",
    "Теорія організацій",
    "Основи наукових досліджень",
    "ІС і технології в управлінні",
    "Маркетинг",
    "Корпоративні фінанси",
  ],

  "Публічне управління та адміністрування": [
    "Публічне управління та адміністрування",
    "Соціальні мережі у публічному управлінні",
    "ІС і технології в управлінні",
    "Основи наукових досліджень",
    "Менеджмент",
    "Маркетинг",
  ],

  Економіка: [
    "Маркетинг",
    "Корпоративні фінанси",
    "Основи наукових досліджень",
    "Менеджмент",
    "Теорія організацій",
    "Бухгалтерський облік та аудит",
  ],

  "Облік і оподаткування": [
    "Бухгалтерський облік та аудит",
    "Облік і оподаткування ФОП",
    "Корпоративні фінанси",
    "Основи наукових досліджень",
    "Менеджмент",
    "Маркетинг",
  ],

  "Фінанси, банківська справа, страхування та фондовий ринок": [
    "Корпоративні фінанси",
    "Бухгалтерський облік та аудит",
    "Основи наукових досліджень",
    "Менеджмент",
    "Маркетинг",
    "Теорія організацій",
  ],

  "Туризм і рекреація": [
    "Менеджмент в туризмі",
    "Економіка туризму",
    "Event-менеджмент",
    "Основи наукових досліджень",
    "Маркетинг",
    "Менеджмент",
  ],

  "Готельно-ресторанна справа": [
    "Event-менеджмент",
    "Менеджмент",
    "Маркетинг",
    "Основи наукових досліджень",
    "Економіка туризму",
    "Менеджмент в туризмі",
  ],

  Психологія: [
    "Менеджмент",
    "Основи наукових досліджень",
    "Маркетинг",
    "Теорія організацій",
    "ІС і технології в управлінні",
    "Публічне управління та адміністрування",
  ],
};

// --------------------------------------------------
// REAL MNAU ROOM NUMBERS USED FOR DEMO
// --------------------------------------------------

const buildingRooms: Record<string, string[]> = {
  м: [
    "101",
    "107",
    "108",
    "201",
    "203",
    "206",
    "207",
    "208",
    "209",
    "210",
    "212",
    "213",
    "216",
    "301",
    "303",
    "306",
  ],

  гк: [
    "101",
    "112",
    "116",
    "117",
    "207",
    "211",
    "212",
    "213",
    "215",
    "310",
    "324",
  ],

  карп: [
    "107",
    "205",
    "212",
    "215",
    "216",
    "217",
    "219",
    "222",
    "224",
    "305",
    "308",
    "310",
    "324",
    "404",
    "407",
    "408",
    "409",
    "410",
    "413",
  ],
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function makeStudentName(groupIndex: number, studentIndex: number) {
  const firstName =
    firstNames[(studentIndex + groupIndex * 2) % firstNames.length];

  const lastName =
    lastNames[(studentIndex * 3 + groupIndex) % lastNames.length];

  return {
    firstName,
    lastName,
  };
}

function makePhone(groupIndex: number, studentIndex: number) {
  const operatorCodes = [
    "067",
    "068",
    "093",
    "095",
    "096",
    "097",
    "098",
  ];

  const operatorCode =
    operatorCodes[(groupIndex + studentIndex) % operatorCodes.length];

  const uniqueNumber =
    1000000 + groupIndex * 1000 + studentIndex * 17 + 100;

  const numberString = String(uniqueNumber)
    .padStart(7, "0")
    .slice(-7);

  return `+380 ${operatorCode} ${numberString.slice(
    0,
    3
  )} ${numberString.slice(3, 5)} ${numberString.slice(5, 7)}`;
}

function getDemoAttendanceStatus(
  groupIndex: number,
  studentIndex: number,
  lessonIndex: number
) {
  const score =
    (groupIndex * 17 + studentIndex * 13 + lessonIndex * 7) % 100;

  const isHighRiskStudent =
    studentIndex === 3 || studentIndex === 8;

  const isMediumRiskStudent =
    studentIndex === 5 || studentIndex === 11;

  if (isHighRiskStudent) {
    if (score < 48) {
      return "N";
    }

    if (score < 55) {
      return "HV";
    }

    return "PRESENT";
  }

  if (isMediumRiskStudent) {
    if (score < 25) {
      return "N";
    }

    if (score < 32) {
      return "HV";
    }

    return "PRESENT";
  }

  if (score < 8) {
    return "N";
  }

  if (score < 12) {
    return "HV";
  }

  return "PRESENT";
}

// --------------------------------------------------
// MAIN
// --------------------------------------------------

async function main() {
  console.log("Starting seed...");

  // --------------------------------------------------
  // ROLES
  // --------------------------------------------------

  const roles = [
    "TEACHER",
    "STAROSTA",
    "CURATOR",
    "DEAN_OFFICE",
    "ADMIN",
  ];

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("Roles created");

  // --------------------------------------------------
  // ATTENDANCE STATUSES
  // --------------------------------------------------

  const attendanceStatuses = [
    {
      code: "PRESENT",
      name: "Присутній",
    },
    {
      code: "N",
      name: "Відсутній",
    },
    {
      code: "HV",
      name: "Поважна причина",
    },
  ];

  for (const status of attendanceStatuses) {
    await prisma.attendanceStatus.upsert({
      where: {
        code: status.code,
      },
      update: {
        name: status.name,
      },
      create: status,
    });
  }

  console.log("Attendance statuses created");

  // --------------------------------------------------
  // BUILDINGS
  // --------------------------------------------------

  const buildings = [
    {
      code: "гк",
      name: "Головний корпус",
      address: "вул. Георгія Гонгадзе, 9",
    },
    {
      code: "м",
      name: "Корпус менеджменту",
      address: "вул. Георгія Гонгадзе, 3А",
    },
    {
      code: "карп",
      name: "Корпус на Карпенка",
      address: "вул. Карпенка, 73",
    },
  ];

  for (const building of buildings) {
    await prisma.building.upsert({
      where: {
        code: building.code,
      },
      update: {
        name: building.name,
        address: building.address,
      },
      create: building,
    });
  }

  console.log("Buildings created");

  // --------------------------------------------------
  // FACULTY
  // --------------------------------------------------

  const faculty = await prisma.faculty.upsert({
    where: {
      name: "Факультет менеджменту",
    },
    update: {},
    create: {
      name: "Факультет менеджменту",
    },
  });

  console.log("Faculty created");

  // --------------------------------------------------
  // SPECIALTIES + GROUPS
  // --------------------------------------------------

  const specialties = [
    {
      code: "J2",
      name: "Готельно-ресторанна справа",
      groups: ["ГРС 3/1"],
    },
    {
      code: "J3",
      name: "Туризм і рекреація",
      groups: ["Тур 3/1"],
    },
    {
      code: "F3",
      name: "Комп'ютерні науки",
      groups: ["Кн 3/1", "Кн 3/2"],
    },
    {
      code: "D3",
      name: "Менеджмент",
      groups: ["Мен 3/1", "Мен 3/2", "Мен 3/3"],
    },
    {
      code: "D4",
      name: "Публічне управління та адміністрування",
      groups: ["Пуа 3/1"],
    },
    {
      code: "C1",
      name: "Економіка",
      groups: ["Ек 3/1"],
    },
    {
      code: null,
      name: "Облік і оподаткування",
      groups: ["Б 3/1"],
    },
    {
      code: null,
      name: "Фінанси, банківська справа, страхування та фондовий ринок",
      groups: ["Ф 3/1"],
    },
    {
      code: null,
      name: "Психологія",
      groups: ["Пс 3/1"],
    },
  ];

  for (const specialtyData of specialties) {
    const specialty = await prisma.specialty.upsert({
      where: {
        facultyId_name: {
          facultyId: faculty.id,
          name: specialtyData.name,
        },
      },
      update: {
        code: specialtyData.code,
      },
      create: {
        code: specialtyData.code,
        name: specialtyData.name,
        facultyId: faculty.id,
      },
    });

    for (const groupName of specialtyData.groups) {
      await prisma.group.upsert({
        where: {
          specialtyId_name: {
            specialtyId: specialty.id,
            name: groupName,
          },
        },
        update: {
          course: 3,
        },
        create: {
          name: groupName,
          course: 3,
          specialtyId: specialty.id,
        },
      });
    }
  }

  console.log("Specialties and groups created");

  // --------------------------------------------------
  // STUDENTS
  // --------------------------------------------------

  const groups = await prisma.group.findMany({
    include: {
      specialty: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex];

    const existingStudents = await prisma.student.findMany({
      where: {
        groupId: group.id,
      },
      orderBy: {
        id: "asc",
      },
    });

    if (existingStudents.length === 0) {
      for (let studentIndex = 0; studentIndex < 15; studentIndex++) {
        const studentName = makeStudentName(
          groupIndex,
          studentIndex
        );

        await prisma.student.create({
          data: {
            firstName: studentName.firstName,
            lastName: studentName.lastName,
            phone: makePhone(groupIndex, studentIndex),
            groupId: group.id,
          },
        });
      }
    } else {
      for (
        let studentIndex = 0;
        studentIndex < existingStudents.length;
        studentIndex++
      ) {
        const student = existingStudents[studentIndex];

        await prisma.student.update({
          where: {
            id: student.id,
          },
          data: {
            phone: makePhone(groupIndex, studentIndex),
          },
        });
      }
    }
  }

  console.log("Students created and phone numbers updated");

  // --------------------------------------------------
  // TEACHERS
  // --------------------------------------------------

  const teacherRole = await prisma.role.findUniqueOrThrow({
    where: {
      name: "TEACHER",
    },
  });

  const teachersByEmail = new Map<
    string,
    {
      id: number;
      email: string;
    }
  >();

  for (const teacherData of teachers) {
    const user = await prisma.user.upsert({
      where: {
        email: teacherData.email,
      },
      update: {
        firstName: teacherData.firstName,
        lastName: teacherData.lastName,
        roleId: teacherRole.id,
      },
      create: {
        email: teacherData.email,

        // DEMO account only.
        // Real authentication comes later.
        passwordHash: "DEMO_ACCOUNT_NO_LOGIN",

        firstName: teacherData.firstName,
        lastName: teacherData.lastName,
        roleId: teacherRole.id,
      },
    });

    let teacher = await prisma.teacher.findUnique({
      where: {
        userId: user.id,
      },
    });

    if (!teacher) {
      teacher = await prisma.teacher.create({
        data: {
          firstName: teacherData.firstName,
          lastName: teacherData.lastName,
          userId: user.id,
        },
      });
    } else {
      teacher = await prisma.teacher.update({
        where: {
          id: teacher.id,
        },
        data: {
          firstName: teacherData.firstName,
          lastName: teacherData.lastName,
        },
      });
    }

    teachersByEmail.set(teacherData.email, {
      id: teacher.id,
      email: teacherData.email,
    });
  }

  console.log("Real MNAU teachers created");

  // --------------------------------------------------
  // SUBJECTS
  // --------------------------------------------------

  const subjectsByName = new Map<string, number>();

  for (const subjectData of subjectCatalog) {
    const subject = await prisma.subject.upsert({
      where: {
        name: subjectData.name,
      },
      update: {},
      create: {
        name: subjectData.name,
      },
    });

    subjectsByName.set(subject.name, subject.id);
  }

  console.log("Real subjects created");

  // --------------------------------------------------
  // CLEAN OLD DEMO LESSONS
  //
  // Attendance depends on lessons, so remove attendance
  // first and regenerate the demo period consistently.
  // --------------------------------------------------

  await prisma.attendance.deleteMany();
  await prisma.lesson.deleteMany();

  console.log("Old demo lessons cleared");

  // --------------------------------------------------
  // LESSONS
  // --------------------------------------------------

  const allBuildings = await prisma.building.findMany({
    orderBy: {
      id: "asc",
    },
  });

  const buildingByCode = new Map(
    allBuildings.map((building) => [
      building.code,
      building,
    ])
  );

  // Demo dates only.
  const lessonDates = [
    new Date("2026-09-01T08:30:00"),
    new Date("2026-09-01T10:05:00"),

    new Date("2026-09-02T08:30:00"),
    new Date("2026-09-02T10:05:00"),

    new Date("2026-09-03T08:30:00"),
    new Date("2026-09-03T10:05:00"),
  ];

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex];

    const pool =
      specialtySubjects[group.specialty.name] ??
      subjectCatalog.slice(0, 6).map((subject) => subject.name);

    for (
      let lessonIndex = 0;
      lessonIndex < lessonDates.length;
      lessonIndex++
    ) {
      const subjectName =
        pool[lessonIndex % pool.length];

      const subjectDefinition =
        subjectCatalog.find(
          (subject) => subject.name === subjectName
        );

      if (!subjectDefinition) {
        throw new Error(
          `Subject mapping not found for ${subjectName}`
        );
      }

      const subjectId =
        subjectsByName.get(subjectName);

      if (!subjectId) {
        throw new Error(
          `Subject DB record not found for ${subjectName}`
        );
      }

      const teacher =
        teachersByEmail.get(
          subjectDefinition.teacherEmail
        );

      if (!teacher) {
        throw new Error(
          `Teacher not found for ${subjectDefinition.teacherEmail}`
        );
      }

      // Rotate real building abbreviations.
      const buildingCodes = ["м", "гк", "карп"];

      const buildingCode =
        buildingCodes[
          (groupIndex + lessonIndex) %
            buildingCodes.length
        ];

      const building =
        buildingByCode.get(buildingCode);

      if (!building) {
        throw new Error(
          `Building ${buildingCode} not found`
        );
      }

      const rooms =
        buildingRooms[buildingCode];

      const room =
        rooms[
          (groupIndex * 3 + lessonIndex) %
            rooms.length
        ];

      const lessonNumber =
        lessonIndex % 2 === 0
          ? 1
          : 2;

      await prisma.lesson.create({
        data: {
          date: lessonDates[lessonIndex],
          lessonNumber,
          room,

          groupId: group.id,
          teacherId: teacher.id,
          subjectId,
          buildingId: building.id,
        },
      });
    }
  }

  console.log("Lessons created with real teacher mappings");

  // --------------------------------------------------
  // ATTENDANCE
  // --------------------------------------------------

  const presentStatus =
    await prisma.attendanceStatus.findUniqueOrThrow({
      where: {
        code: "PRESENT",
      },
    });

  const absentStatus =
    await prisma.attendanceStatus.findUniqueOrThrow({
      where: {
        code: "N",
      },
    });

  const hvStatus =
    await prisma.attendanceStatus.findUniqueOrThrow({
      where: {
        code: "HV",
      },
    });

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex];

    const students = await prisma.student.findMany({
      where: {
        groupId: group.id,
      },
      orderBy: {
        id: "asc",
      },
    });

    const lessons = await prisma.lesson.findMany({
      where: {
        groupId: group.id,
      },
      orderBy: [
        {
          date: "asc",
        },
        {
          lessonNumber: "asc",
        },
      ],
    });

    for (
      let lessonIndex = 0;
      lessonIndex < lessons.length;
      lessonIndex++
    ) {
      const lesson = lessons[lessonIndex];

      for (
        let studentIndex = 0;
        studentIndex < students.length;
        studentIndex++
      ) {
        const student = students[studentIndex];

        const statusCode = getDemoAttendanceStatus(
          groupIndex,
          studentIndex,
          lessonIndex
        );

        let statusId = presentStatus.id;

        if (statusCode === "N") {
          statusId = absentStatus.id;
        }

        if (statusCode === "HV") {
          statusId = hvStatus.id;
        }

        await prisma.attendance.create({
          data: {
            studentId: student.id,
            lessonId: lesson.id,
            statusId,
          },
        });
      }
    }
  }

  console.log("Attendance created");

  // --------------------------------------------------
  // RESULT
  // --------------------------------------------------

  const facultiesCount =
    await prisma.faculty.count();

  const specialtiesCount =
    await prisma.specialty.count();

  const groupsCount =
    await prisma.group.count();

  const studentsCount =
    await prisma.student.count();

  const studentsWithPhoneCount =
    await prisma.student.count({
      where: {
        phone: {
          not: null,
        },
      },
    });

  const teachersCount =
    await prisma.teacher.count();

  const subjectsCount =
    await prisma.subject.count();

  const lessonsCount =
    await prisma.lesson.count();

  const attendanceCount =
    await prisma.attendance.count();

  const buildingsCount =
    await prisma.building.count();

  const rolesCount =
    await prisma.role.count();

  const statusesCount =
    await prisma.attendanceStatus.count();

  console.log("");
  console.log("Seed completed");
  console.log("--------------------------------");
  console.log(`Faculties: ${facultiesCount}`);
  console.log(`Specialties: ${specialtiesCount}`);
  console.log(`Groups: ${groupsCount}`);
  console.log(`Students: ${studentsCount}`);
  console.log(
    `Students with phone: ${studentsWithPhoneCount}`
  );
  console.log(`Teachers: ${teachersCount}`);
  console.log(`Subjects: ${subjectsCount}`);
  console.log(`Lessons: ${lessonsCount}`);
  console.log(
    `Attendance records: ${attendanceCount}`
  );
  console.log(`Buildings: ${buildingsCount}`);
  console.log(`Roles: ${rolesCount}`);
  console.log(
    `Attendance statuses: ${statusesCount}`
  );
}

main()
  .catch((error) => {
    console.error("");
    console.error("Seed failed:");
    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });