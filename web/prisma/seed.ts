import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

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

const DEMO_PASSWORD = "Test1234!";

// ==================================================
// TYPES
// ==================================================

type TeacherDefinition = {
  firstName: string;
  lastName: string;
  email: string;
};

type LessonDefinition = {
  subject: string;
  teacherEmail: string;
};

type SpecialtyDefinition = {
  code: string | null;
  name: string;
  groups: {
    name: string;
    course: number;
  }[];
};

// ==================================================
// DEMO STUDENTS
// ==================================================

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

// ==================================================
// TEACHERS FROM MNAU SCHEDULES
//
// All emails below are DEMO logins.
// Names/initials come from the university schedules.
// ==================================================

const teachers: TeacherDefinition[] = [
  {
    firstName: "С.І.",
    lastName: "Тищенко",
    email: "tyshchenko.si@test.com",
  },
  {
    firstName: "І.І.",
    lastName: "Хилько",
    email: "khylko.ii@test.com",
  },
  {
    firstName: "Г.С.",
    lastName: "Побережець",
    email: "poberezhets.gs@test.com",
  },
  {
    firstName: "О.В.",
    lastName: "Бойчук",
    email: "boichuk.ov@test.com",
  },
  {
    firstName: "О.Є.",
    lastName: "Богатенкова",
    email: "bohatenkova.oe@test.com",
  },
  {
    firstName: "Г.Ю.",
    lastName: "Суріна",
    email: "surina.gyu@test.com",
  },
  {
    firstName: "О.В.",
    lastName: "Довгаль",
    email: "dovhal.ov@test.com",
  },
  {
    firstName: "В.В.",
    lastName: "Співак",
    email: "spivak.vv@test.com",
  },
  {
    firstName: "А.Ю.",
    lastName: "Ракова",
    email: "rakova.ayu@test.com",
  },
  {
    firstName: "А.А.",
    lastName: "Гусенко",
    email: "husenko.aa@test.com",
  },
  {
    firstName: "Н.Г.",
    lastName: "Пономаренко",
    email: "ponomarenko.ng@test.com",
  },
  {
    firstName: "Н.В.",
    lastName: "Мірошкіна",
    email: "miroshkina.nv@test.com",
  },
  {
    firstName: "В.Д.",
    lastName: "Соколік",
    email: "sokolik.vd@test.com",
  },
  {
    firstName: "К.В.",
    lastName: "Тішечкіна",
    email: "tishechkina.kv@test.com",
  },
  {
    firstName: "І.О.",
    lastName: "Банєва",
    email: "banieva.io@test.com",
  },
  {
    firstName: "Т.А.",
    lastName: "Ганніченко",
    email: "hannichenko.ta@test.com",
  },
  {
    firstName: "Н.І.",
    lastName: "Галунець",
    email: "halunets.ni@test.com",
  },
  {
    firstName: "О.О.",
    lastName: "Саламатіна",
    email: "salamatina.oo@test.com",
  },
  {
    firstName: "Т.М.",
    lastName: "Борко",
    email: "borko.tm@test.com",
  },
  {
    firstName: "А.Ю.",
    lastName: "Пархоменко",
    email: "parkhomenko.ayu@test.com",
  },
  {
    firstName: "С.В.",
    lastName: "Болотських",
    email: "bolotskykh.sv@test.com",
  },
  {
    firstName: "С.І.",
    lastName: "Богданов",
    email: "bohdanov.si@test.com",
  },
  {
    firstName: "В.В.",
    lastName: "Поживатенко",
    email: "pozhyvatenko.vv@test.com",
  },
  {
    firstName: "І.В.",
    lastName: "Гончаренко",
    email: "honcharenko.iv@test.com",
  },
  {
    firstName: "Г.А.",
    lastName: "Гарбар",
    email: "harbar.ga@test.com",
  },
  {
    firstName: "С.І.",
    lastName: "Ємельянов",
    email: "yemelianov.si@test.com",
  },
  {
    firstName: "В.Л.",
    lastName: "Короленко",
    email: "korolenko.vl@test.com",
  },
  {
    firstName: "Ю.В.",
    lastName: "Маєр",
    email: "mayer.yv@test.com",
  },
  {
    firstName: "Т.Г.",
    lastName: "Олійник",
    email: "oliinyk.tg@test.com",
  },
  {
    firstName: "К.А.",
    lastName: "Мікуляк",
    email: "mikuliak.ka@test.com",
  },
  {
    firstName: "О.І.",
    lastName: "Лугова",
    email: "luhova.oi@test.com",
  },
  {
    firstName: "Л.В.",
    lastName: "Машкіна",
    email: "mashkina.lv@test.com",
  },
  {
    firstName: "О.О.",
    lastName: "Жебко",
    email: "zhebko.oo@test.com",
  },
  {
    firstName: "О.А.",
    lastName: "Христенко",
    email: "khrystenko.oa@test.com",
  },
  {
    firstName: "Л.Ю.",
    lastName: "Прогонюк",
    email: "prohoniuk.lyu@test.com",
  },
  {
    firstName: "С.В.",
    lastName: "Сирцева",
    email: "syrtseva.sv@test.com",
  },
  {
    firstName: "О.С.",
    lastName: "Біліченко",
    email: "bilichenko.os@test.com",
  },
  {
    firstName: "Н.О.",
    lastName: "Шишпанова",
    email: "shyshpanova.no@test.com",
  },
  {
    firstName: "В.С.",
    lastName: "Кушнірук",
    email: "kushniruk.vs@test.com",
  },
  {
    firstName: "Є.Ю.",
    lastName: "Борчик",
    email: "borchyk.eyu@test.com",
  },
  {
    firstName: "О.Ю.",
    lastName: "Пархоменко",
    email: "parkhomenko.oyu@test.com",
  },
  {
    firstName: "О.І.",
    lastName: "Петрова",
    email: "petrova.oi@test.com",
  },
  {
    firstName: "А.М.",
    lastName: "Коломієць",
    email: "kolomiets.am@test.com",
  },
  {
    firstName: "С.І.",
    lastName: "Павлюк",
    email: "pavliuk.si@test.com",
  },
  {
    firstName: "І.О.",
    lastName: "Піюренко",
    email: "piurenko.io@test.com",
  },
  {
    firstName: "А.С.",
    lastName: "Полторак",
    email: "poltorak.as@test.com",
  },
  {
    firstName: "Н.М.",
    lastName: "Сіренко",
    email: "sirenko.nm@test.com",
  },
  {
    firstName: "А.І.",
    lastName: "Зінченко",
    email: "zinchenko.ai@test.com",
  },
  {
    firstName: "А.І.",
    lastName: "Бурковська",
    email: "burkovska.ai@test.com",
  },
  {
    firstName: "А.В.",
    lastName: "Бурковська",
    email: "burkovska.av@test.com",
  },
  {
    firstName: "О.А.",
    lastName: "Боднар",
    email: "bodnar.oa@test.com",
  },
  {
    firstName: "В.М.",
    lastName: "Стамат",
    email: "stamat.vm@test.com",
  },
  {
    firstName: "А.В.",
    lastName: "Ключник",
    email: "kliuchnyk.av@test.com",
  },
  {
    firstName: "Ю.Ю.",
    lastName: "Чебан",
    email: "cheban.yuyu@test.com",
  },
  {
    firstName: "Н.В.",
    lastName: "Потриваєва",
    email: "potryvaieva.nv@test.com",
  },
  {
    firstName: "О.І.",
    lastName: "Мельник",
    email: "melnyk.oi@test.com",
  },
  {
    firstName: "Г.В.",
    lastName: "Табацкова",
    email: "tabatskova.gv@test.com",
  },
  {
    firstName: "В.С.",
    lastName: "Доній",
    email: "donii.vs@test.com",
  },
  {
    firstName: "А.В.",
    lastName: "Марковська",
    email: "markovska.av@test.com",
  },
  {
    firstName: "І.С.",
    lastName: "Поточилова",
    email: "potochylova.is@test.com",
  },
  {
    firstName: "Р.О.",
    lastName: "Трибрат",
    email: "trybrat.ro@test.com",
  },
  {
    firstName: "А.Л.",
    lastName: "Сухорукова",
    email: "sukhorukova.al@test.com",
  },
  {
    firstName: "Т.Я.",
    lastName: "Іваненко",
    email: "ivanenko.tya@test.com",
  },
  {
    firstName: "І.І.",
    lastName: "Червен",
    email: "cherven.ii@test.com",
  },
  {
    firstName: "М.В.",
    lastName: "Дубініна",
    email: "dubinina.mv@test.com",
  },
  {
    firstName: "Р.С.",
    lastName: "Мірошник",
    email: "miroshnyk.rs@test.com",
  },
  {
    firstName: "Т.С.",
    lastName: "Кучмійова",
    email: "kuchmiova.ts@test.com",
  },
  {
    firstName: "О.С.",
    lastName: "Садовий",
    email: "sadovyi.os@test.com",
  },
  {
    firstName: "В.О.",
    lastName: "Крайній",
    email: "krainii.vo@test.com",
  },
];

// ==================================================
// FACULTY STRUCTURE — COURSES 1-4
// ==================================================

const specialties: SpecialtyDefinition[] = [
  {
    code: "J2",
    name: "Готельно-ресторанна справа та кейтеринг",
    groups: [
      { name: "ГРС 1/1", course: 1 },
      { name: "ГРС 2/1", course: 2 },
      { name: "ГРС 3/1", course: 3 },
      { name: "ГРС 4/1", course: 4 },
    ],
  },

  {
    code: "J3",
    name: "Туризм і рекреація",
    groups: [
      { name: "Тур 1/1", course: 1 },
      { name: "Тур 2/1", course: 2 },
      { name: "Тур 3/1", course: 3 },
      { name: "Тур 4/1", course: 4 },
    ],
  },

  {
    code: "F3",
    name: "Комп'ютерні науки",
    groups: [
      { name: "Кн 1/1", course: 1 },
      { name: "Кн 2/1", course: 2 },
      { name: "Кн 3/1", course: 3 },
      { name: "Кн 3/2", course: 3 },
      { name: "Кн 4/1", course: 4 },
    ],
  },

  {
    code: "D3",
    name: "Менеджмент",
    groups: [
      { name: "Мен 1/1", course: 1 },
      { name: "Мен 1/2", course: 1 },

      { name: "Мен 2/1", course: 2 },
      { name: "Мен 2/2", course: 2 },
      { name: "Мен 2/3", course: 2 },

      { name: "Мен 3/1", course: 3 },
      { name: "Мен 3/2", course: 3 },
      { name: "Мен 3/3", course: 3 },

      { name: "Мен 4/1", course: 4 },
      { name: "Мен 4/2", course: 4 },
    ],
  },

  {
    code: "D4",
    name: "Публічне управління та адміністрування",
    groups: [
      { name: "Пуа 2/1", course: 2 },
      { name: "Пуа 3/1", course: 3 },
      { name: "Пуа 4/1", course: 4 },
    ],
  },

  {
    code: "C1",
    name: "Економіка та міжнародні економічні відносини",
    groups: [
      { name: "Ек 1/1", course: 1 },
      { name: "Ек 3/1", course: 3 },
      { name: "Ек 4/1", course: 4 },
    ],
  },

  {
    code: null,
    name: "Облік і оподаткування",
    groups: [
      { name: "Б 1/1", course: 1 },
      { name: "Б 2/1", course: 2 },
      { name: "Б 3/1", course: 3 },
      { name: "Б 4/1", course: 4 },
    ],
  },

  {
    code: null,
    name: "Фінанси, банківська справа, страхування та фондовий ринок",
    groups: [
      { name: "Ф 1/1", course: 1 },
      { name: "Ф 2/1", course: 2 },
      { name: "Ф 3/1", course: 3 },
      { name: "Ф 4/1", course: 4 },
    ],
  },

  {
    code: null,
    name: "Психологія",
    groups: [
      { name: "Пс 1/1", course: 1 },
      { name: "Пс 2/1", course: 2 },
      { name: "Пс 3/1", course: 3 },
    ],
  },
];

// ==================================================
// COURSE-SPECIFIC LESSON POOLS
// ==================================================

const coursePools: Record<string, LessonDefinition[]> = {
  // --------------------------------------------------
  // COMPUTER SCIENCE
  // --------------------------------------------------

  "Комп'ютерні науки|1": [
    {
      subject: "Дискретна математика",
      teacherEmail: "bohatenkova.oe@test.com",
    },
    {
      subject: "Логіка",
      teacherEmail: "khylko.ii@test.com",
    },
    {
      subject: "Вища математика",
      teacherEmail: "boichuk.ov@test.com",
    },
    {
      subject: "Інформаційні системи і технології",
      teacherEmail: "spivak.vv@test.com",
    },
    {
      subject: "Історія та культура України",
      teacherEmail: "poberezhets.gs@test.com",
    },
    {
      subject: "Іноземна мова",
      teacherEmail: "ponomarenko.ng@test.com",
    },
  ],

  "Комп'ютерні науки|2": [
    {
      subject: "Програмування на C++",
      teacherEmail: "parkhomenko.oyu@test.com",
    },
    {
      subject: "Бази даних",
      teacherEmail: "zhebko.oo@test.com",
    },
    {
      subject: "ТО комп'ютерних систем",
      teacherEmail: "khylko.ii@test.com",
    },
    {
      subject: "Вища математика",
      teacherEmail: "pozhyvatenko.vv@test.com",
    },
    {
      subject: "Теорія ймовірностей і математична статистика",
      teacherEmail: "khylko.ii@test.com",
    },
    {
      subject: "Чисельні методи",
      teacherEmail: "bohatenkova.oe@test.com",
    },
  ],

  "Комп'ютерні науки|3": [
    {
      subject: "Прикладне програмування",
      teacherEmail: "kolomiets.am@test.com",
    },
    {
      subject: "Об'єктно-орієнтоване програмування",
      teacherEmail: "kolomiets.am@test.com",
    },
    {
      subject: "Фреймворки JavaScript",
      teacherEmail: "kolomiets.am@test.com",
    },
    {
      subject: "Основи ІТ-підприємництва",
      teacherEmail: "yemelianov.si@test.com",
    },
    {
      subject: "Інтелектуальний аналіз даних",
      teacherEmail: "parkhomenko.oyu@test.com",
    },
    {
      subject: "Основи наукових досліджень",
      teacherEmail: "poltorak.as@test.com",
    },
  ],

  "Комп'ютерні науки|4": [
    {
      subject: "Проєктування та розробка ІД",
      teacherEmail: "miroshnyk.rs@test.com",
    },
    {
      subject: "Математичні методи в ІТ",
      teacherEmail: "bohatenkova.oe@test.com",
    },
    {
      subject: "Управління проєктами інформатизації",
      teacherEmail: "krainii.vo@test.com",
    },
    {
      subject: "Системи автоматизованого проєктування",
      teacherEmail: "sadovyi.os@test.com",
    },
    {
      subject: "Розробка мобільних додатків",
      teacherEmail: "zhebko.oo@test.com",
    },
    {
      subject: "Основи наукових досліджень",
      teacherEmail: "poltorak.as@test.com",
    },
  ],

  // --------------------------------------------------
  // MANAGEMENT
  // --------------------------------------------------

  "Менеджмент|1": [
    {
      subject: "Комунікаційні технології",
      teacherEmail: "tyshchenko.si@test.com",
    },
    {
      subject: "Вища математика",
      teacherEmail: "boichuk.ov@test.com",
    },
    {
      subject: "Правознавство",
      teacherEmail: "husenko.aa@test.com",
    },
    {
      subject: "Історія та культура України",
      teacherEmail: "poberezhets.gs@test.com",
    },
    {
      subject: "Іноземна мова",
      teacherEmail: "ponomarenko.ng@test.com",
    },
    {
      subject: "Основи національного спротиву",
      teacherEmail: "bolotskykh.sv@test.com",
    },
  ],

  "Менеджмент|2": [
    {
      subject: "Вища математика",
      teacherEmail: "pozhyvatenko.vv@test.com",
    },
    {
      subject: "Макро та мікроекономіка",
      teacherEmail: "mashkina.lv@test.com",
    },
    {
      subject: "Статистика",
      teacherEmail: "zhebko.oo@test.com",
    },
    {
      subject: "Лідерство та командна робота",
      teacherEmail: "bilichenko.os@test.com",
    },
    {
      subject: "Психологія бізнесу",
      teacherEmail: "mayer.yv@test.com",
    },
    {
      subject: "Зовнішня політика України",
      teacherEmail: "honcharenko.iv@test.com",
    },
  ],

  "Менеджмент|3": [
    {
      subject: "Менеджмент",
      teacherEmail: "burkovska.ai@test.com",
    },
    {
      subject: "Теорія організацій",
      teacherEmail: "burkovska.ai@test.com",
    },
    {
      subject: "Основи наукових досліджень",
      teacherEmail: "poltorak.as@test.com",
    },
    {
      subject: "ІС і технології в управлінні",
      teacherEmail: "pavliuk.si@test.com",
    },
    {
      subject: "Маркетинг",
      teacherEmail: "stamat.vm@test.com",
    },
    {
      subject: "Корпоративні фінанси",
      teacherEmail: "mikuliak.ka@test.com",
    },
  ],

  "Менеджмент|4": [
    {
      subject: "Управління інноваціями",
      teacherEmail: "kushniruk.vs@test.com",
    },
    {
      subject: "Управління персоналом",
      teacherEmail: "sukhorukova.al@test.com",
    },
    {
      subject: "Логістика",
      teacherEmail: "ivanenko.tya@test.com",
    },
    {
      subject: "Організація виробництва та ПДП",
      teacherEmail: "cherven.ii@test.com",
    },
    {
      subject: "Аналіз господарської діяльності",
      teacherEmail: "melnyk.oi@test.com",
    },
    {
      subject: "Основи наукових досліджень",
      teacherEmail: "poltorak.as@test.com",
    },
  ],

  // --------------------------------------------------
  // PUBLIC ADMINISTRATION
  // --------------------------------------------------

  "Публічне управління та адміністрування|2": [
    {
      subject: "Публічне управління",
      teacherEmail: "kliuchnyk.av@test.com",
    },
    {
      subject: "Теорія держави та права",
      teacherEmail: "prohoniuk.lyu@test.com",
    },
    {
      subject: "Антикорупція та доброчесність",
      teacherEmail: "husenko.aa@test.com",
    },
    {
      subject: "Міжнародні організації",
      teacherEmail: "honcharenko.iv@test.com",
    },
    {
      subject: "Зовнішня політика України",
      teacherEmail: "honcharenko.iv@test.com",
    },
    {
      subject: "Статистика",
      teacherEmail: "zhebko.oo@test.com",
    },
  ],

  "Публічне управління та адміністрування|3": [
    {
      subject: "Публічне управління та адміністрування",
      teacherEmail: "halunets.ni@test.com",
    },
    {
      subject: "Соціальні мережі у публічному управлінні",
      teacherEmail: "prohoniuk.lyu@test.com",
    },
    {
      subject: "Аналіз публічної політики",
      teacherEmail: "halunets.ni@test.com",
    },
    {
      subject: "Європейська та північноатлантична інтеграція",
      teacherEmail: "tabatskova.gv@test.com",
    },
    {
      subject: "Політична еліта та політичне лідерство",
      teacherEmail: "potochylova.is@test.com",
    },
    {
      subject: "Основи наукових досліджень",
      teacherEmail: "poltorak.as@test.com",
    },
  ],

  "Публічне управління та адміністрування|4": [
    {
      subject: "Міжнародні організації",
      teacherEmail: "halunets.ni@test.com",
    },
    {
      subject: "Менеджмент публічних установ та організацій",
      teacherEmail: "shyshpanova.no@test.com",
    },
    {
      subject: "Європейські стандарти публічного адміністрування",
      teacherEmail: "sukhorukova.al@test.com",
    },
    {
      subject: "Публічне управління соціальним розвитком",
      teacherEmail: "halunets.ni@test.com",
    },
    {
      subject: "Електронне урядування та демократія",
      teacherEmail: "shyshpanova.no@test.com",
    },
    {
      subject: "Публічні закупівлі",
      teacherEmail: "cheban.yuyu@test.com",
    },
  ],

  // --------------------------------------------------
  // HOSPITALITY
  // --------------------------------------------------

  "Готельно-ресторанна справа та кейтеринг|1": [
    {
      subject: "Основи гостинності",
      teacherEmail: "banieva.io@test.com",
    },
    {
      subject: "Комунікаційні технології",
      teacherEmail: "tyshchenko.si@test.com",
    },
    {
      subject: "Іноземна мова",
      teacherEmail: "ponomarenko.ng@test.com",
    },
    {
      subject: "Філософія",
      teacherEmail: "surina.gyu@test.com",
    },
    {
      subject: "Історія та культура України",
      teacherEmail: "poberezhets.gs@test.com",
    },
    {
      subject: "Інформаційні системи і технології",
      teacherEmail: "spivak.vv@test.com",
    },
  ],

  "Готельно-ресторанна справа та кейтеринг|2": [
    {
      subject: "Кулінарна етнологія",
      teacherEmail: "banieva.io@test.com",
    },
    {
      subject: "Кулінарні тренди та гастрономія",
      teacherEmail: "harbar.ga@test.com",
    },
    {
      subject: "Бізнес-етика в індустрії гостинності",
      teacherEmail: "kushniruk.vs@test.com",
    },
    {
      subject: "Товарознавство",
      teacherEmail: "husenko.aa@test.com",
    },
    {
      subject: "Безпека харчових продуктів",
      teacherEmail: "pavliuk.si@test.com",
    },
    {
      subject: "Іноземна мова",
      teacherEmail: "ponomarenko.ng@test.com",
    },
  ],

  "Готельно-ресторанна справа та кейтеринг|3": [
    {
      subject: "Менеджмент ГРГ",
      teacherEmail: "burkovska.ai@test.com",
    },
    {
      subject: "Event-менеджмент",
      teacherEmail: "piurenko.io@test.com",
    },
    {
      subject: "Економіка і фінанси ГРП",
      teacherEmail: "burkovska.ai@test.com",
    },
    {
      subject: "Організація ГРБ",
      teacherEmail: "potochylova.is@test.com",
    },
    {
      subject: "Основи наукових досліджень",
      teacherEmail: "poltorak.as@test.com",
    },
    {
      subject: "Іноземна мова",
      teacherEmail: "hannichenko.ta@test.com",
    },
  ],

  "Готельно-ресторанна справа та кейтеринг|4": [
    {
      subject: "Організація готельного господарства",
      teacherEmail: "ivanenko.tya@test.com",
    },
    {
      subject: "Інноваційні технології в ГРГ",
      teacherEmail: "piurenko.io@test.com",
    },
    {
      subject: "ІСТ в сфері обслуговування",
      teacherEmail: "piurenko.io@test.com",
    },
    {
      subject: "Логістика в ГРБ",
      teacherEmail: "pavliuk.si@test.com",
    },
    {
      subject: "Устаткування в закладах ГРГ",
      teacherEmail: "poltorak.as@test.com",
    },
    {
      subject: "Основи наукових досліджень",
      teacherEmail: "poltorak.as@test.com",
    },
  ],

  // --------------------------------------------------
  // TOURISM
  // --------------------------------------------------

  "Туризм і рекреація|1": [
    {
      subject: "Основи туризмознавства",
      teacherEmail: "halunets.ni@test.com",
    },
    {
      subject: "Комунікаційні технології",
      teacherEmail: "tyshchenko.si@test.com",
    },
    {
      subject: "Іноземна мова",
      teacherEmail: "ponomarenko.ng@test.com",
    },
    {
      subject: "Історія та культура України",
      teacherEmail: "poberezhets.gs@test.com",
    },
    {
      subject: "Філософія",
      teacherEmail: "surina.gyu@test.com",
    },
    {
      subject: "Інформаційні системи і технології",
      teacherEmail: "spivak.vv@test.com",
    },
  ],

  "Туризм і рекреація|2": [
    {
      subject: "Туристичне краєзнавство",
      teacherEmail: "pavliuk.si@test.com",
    },
    {
      subject: "Туристичне країнознавство",
      teacherEmail: "kliuchnyk.av@test.com",
    },
    {
      subject: "Міжнародний туризм",
      teacherEmail: "husenko.aa@test.com",
    },
    {
      subject: "Агроекотуризм",
      teacherEmail: "oliinyk.tg@test.com",
    },
    {
      subject: "Іноземна мова",
      teacherEmail: "ponomarenko.ng@test.com",
    },
    {
      subject: "Статистика",
      teacherEmail: "zhebko.oo@test.com",
    },
  ],

  "Туризм і рекреація|3": [
    {
      subject: "Культурний туризм",
      teacherEmail: "parkhomenko.oyu@test.com",
    },
    {
      subject: "Менеджмент в туризмі",
      teacherEmail: "poltorak.as@test.com",
    },
    {
      subject: "Економіка туризму",
      teacherEmail: "kliuchnyk.av@test.com",
    },
    {
      subject: "Інфраструктура туризму",
      teacherEmail: "harbar.ga@test.com",
    },
    {
      subject: "ІС і технології в туризмі",
      teacherEmail: "yemelianov.si@test.com",
    },
    {
      subject: "Основи наукових досліджень",
      teacherEmail: "poltorak.as@test.com",
    },
  ],

  "Туризм і рекреація|4": [
    {
      subject: "Туроперейтинг",
      teacherEmail: "pavliuk.si@test.com",
    },
    {
      subject: "Логістика туристичних потоків",
      teacherEmail: "hannichenko.ta@test.com",
    },
    {
      subject: "Діловий туризм",
      teacherEmail: "hannichenko.ta@test.com",
    },
    {
      subject: "МСЯ і безпека в туризмі",
      teacherEmail: "piurenko.io@test.com",
    },
    {
      subject: "Інноваційні технології в туризмі",
      teacherEmail: "pavliuk.si@test.com",
    },
    {
      subject: "Ринок туристичних послуг",
      teacherEmail: "oliinyk.tg@test.com",
    },
  ],

  // --------------------------------------------------
  // ECONOMICS
  // --------------------------------------------------

  "Економіка та міжнародні економічні відносини|1": [
    {
      subject: "Економічна теорія",
      teacherEmail: "dovhal.ov@test.com",
    },
    {
      subject: "Вища математика",
      teacherEmail: "bohdanov.si@test.com",
    },
    {
      subject: "Інформаційні системи і технології",
      teacherEmail: "spivak.vv@test.com",
    },
    {
      subject: "Історія та культура України",
      teacherEmail: "poberezhets.gs@test.com",
    },
    {
      subject: "Правознавство",
      teacherEmail: "sokolik.vd@test.com",
    },
    {
      subject: "Іноземна мова",
      teacherEmail: "ponomarenko.ng@test.com",
    },
  ],

  "Економіка та міжнародні економічні відносини|3": [
    {
      subject: "Глобальна економіка",
      teacherEmail: "burkovska.ai@test.com",
    },
    {
      subject: "Міжнародні економічні відносини",
      teacherEmail: "markovska.av@test.com",
    },
    {
      subject: "Статистика ринку",
      teacherEmail: "hannichenko.ta@test.com",
    },
    {
      subject: "Економіка і фінанси підприємств",
      teacherEmail: "oliinyk.tg@test.com",
    },
    {
      subject: "Підприємництво та сталий розвиток",
      teacherEmail: "kliuchnyk.av@test.com",
    },
    {
      subject: "Основи наукових досліджень",
      teacherEmail: "poltorak.as@test.com",
    },
  ],

  "Економіка та міжнародні економічні відносини|4": [
    {
      subject: "Аналіз господарської діяльності",
      teacherEmail: "melnyk.oi@test.com",
    },
    {
      subject: "Моделювання економіки",
      teacherEmail: "dubinina.mv@test.com",
    },
    {
      subject: "Прогнозування СЕП",
      teacherEmail: "kuchmiova.ts@test.com",
    },
    {
      subject: "Методи оптимізації в економіці",
      teacherEmail: "khylko.ii@test.com",
    },
    {
      subject: "Інноваційне підприємство та УСП",
      teacherEmail: "mikuliak.ka@test.com",
    },
    {
      subject: "Основи наукових досліджень",
      teacherEmail: "poltorak.as@test.com",
    },
  ],

  // --------------------------------------------------
  // ACCOUNTING
  // --------------------------------------------------

  "Облік і оподаткування|1": [
    {
      subject: "Економічна теорія",
      teacherEmail: "dovhal.ov@test.com",
    },
    {
      subject: "Вища математика",
      teacherEmail: "bohdanov.si@test.com",
    },
    {
      subject: "Правознавство",
      teacherEmail: "husenko.aa@test.com",
    },
    {
      subject: "Історія та культура України",
      teacherEmail: "poberezhets.gs@test.com",
    },
    {
      subject: "Комунікаційні технології",
      teacherEmail: "tyshchenko.si@test.com",
    },
    {
      subject: "Іноземна мова",
      teacherEmail: "ponomarenko.ng@test.com",
    },
  ],

  "Облік і оподаткування|2": [
    {
      subject: "Бухгалтерський облік",
      teacherEmail: "korolenko.vl@test.com",
    },
    {
      subject: "Фінанси",
      teacherEmail: "mikuliak.ka@test.com",
    },
    {
      subject: "Макро та мікроекономіка",
      teacherEmail: "mashkina.lv@test.com",
    },
    {
      subject: "Статистика",
      teacherEmail: "zhebko.oo@test.com",
    },
    {
      subject: "Діловодство та ДГД",
      teacherEmail: "bohatenkova.oe@test.com",
    },
    {
      subject: "Особистий та сімейний бюджет",
      teacherEmail: "mikuliak.ka@test.com",
    },
  ],

  "Облік і оподаткування|3": [
    {
      subject: "Бухгалтерський облік та аудит",
      teacherEmail: "cheban.yuyu@test.com",
    },
    {
      subject: "Облік і оподаткування ФОП",
      teacherEmail: "cheban.yuyu@test.com",
    },
    {
      subject: "Фінансовий облік",
      teacherEmail: "potryvaieva.nv@test.com",
    },
    {
      subject: "Корпоративні фінанси",
      teacherEmail: "mikuliak.ka@test.com",
    },
    {
      subject: "Основи наукових досліджень",
      teacherEmail: "poltorak.as@test.com",
    },
    {
      subject: "Маркетинг",
      teacherEmail: "stamat.vm@test.com",
    },
  ],

  "Облік і оподаткування|4": [
    {
      subject: "Облік і звітність в оподаткуванні",
      teacherEmail: "cheban.yuyu@test.com",
    },
    {
      subject: "Облік у державному секторі",
      teacherEmail: "syrtseva.sv@test.com",
    },
    {
      subject: "Аудит",
      teacherEmail: "syrtseva.sv@test.com",
    },
    {
      subject: "Фінансовий облік у галузях економіки",
      teacherEmail: "cheban.yuyu@test.com",
    },
    {
      subject: "Публічні закупівлі",
      teacherEmail: "cheban.yuyu@test.com",
    },
    {
      subject: "Аналіз господарської діяльності",
      teacherEmail: "melnyk.oi@test.com",
    },
  ],

  // --------------------------------------------------
  // FINANCE
  // --------------------------------------------------

  "Фінанси, банківська справа, страхування та фондовий ринок|1": [
    {
      subject: "Економічна теорія",
      teacherEmail: "dovhal.ov@test.com",
    },
    {
      subject: "Вища математика",
      teacherEmail: "bohdanov.si@test.com",
    },
    {
      subject: "Комунікаційні технології",
      teacherEmail: "tyshchenko.si@test.com",
    },
    {
      subject: "Правознавство",
      teacherEmail: "sokolik.vd@test.com",
    },
    {
      subject: "Іноземна мова",
      teacherEmail: "ponomarenko.ng@test.com",
    },
    {
      subject: "Історія та культура України",
      teacherEmail: "poberezhets.gs@test.com",
    },
  ],

  "Фінанси, банківська справа, страхування та фондовий ринок|2": [
    {
      subject: "Фінанси",
      teacherEmail: "mikuliak.ka@test.com",
    },
    {
      subject: "Гроші і кредит",
      teacherEmail: "harbar.ga@test.com",
    },
    {
      subject: "Макро та мікроекономіка",
      teacherEmail: "mashkina.lv@test.com",
    },
    {
      subject: "Особистий та сімейний бюджет",
      teacherEmail: "mikuliak.ka@test.com",
    },
    {
      subject: "Статистика",
      teacherEmail: "zhebko.oo@test.com",
    },
    {
      subject: "Вища математика",
      teacherEmail: "pozhyvatenko.vv@test.com",
    },
  ],

  "Фінанси, банківська справа, страхування та фондовий ринок|3": [
    {
      subject: "Корпоративні фінанси",
      teacherEmail: "mikuliak.ka@test.com",
    },
    {
      subject: "Державні фінанси",
      teacherEmail: "sirenko.nm@test.com",
    },
    {
      subject: "Фінансова інфраструктура",
      teacherEmail: "sirenko.nm@test.com",
    },
    {
      subject: "Страхування",
      teacherEmail: "melnyk.oi@test.com",
    },
    {
      subject: "Інвестування",
      teacherEmail: "potochylova.is@test.com",
    },
    {
      subject: "Міжнародні фінансові організації",
      teacherEmail: "borko.tm@test.com",
    },
  ],

  "Фінанси, банківська справа, страхування та фондовий ринок|4": [
    {
      subject: "Цифрові фінанси",
      teacherEmail: "sirenko.nm@test.com",
    },
    {
      subject: "Банківська система",
      teacherEmail: "bodnar.oa@test.com",
    },
    {
      subject: "Бюджетна система",
      teacherEmail: "melnyk.oi@test.com",
    },
    {
      subject: "Соціальне страхування",
      teacherEmail: "mikuliak.ka@test.com",
    },
    {
      subject: "Фінансовий ринок",
      teacherEmail: "burkovska.av@test.com",
    },
    {
      subject: "Фінансовий моніторинг",
      teacherEmail: "bodnar.oa@test.com",
    },
  ],

  // --------------------------------------------------
  // PSYCHOLOGY
  // --------------------------------------------------

  "Психологія|1": [
    {
      subject: "Загальна психологія",
      teacherEmail: "borko.tm@test.com",
    },
    {
      subject: "Вступ до фаху Психологія",
      teacherEmail: "borko.tm@test.com",
    },
    {
      subject: "Логіка",
      teacherEmail: "khylko.ii@test.com",
    },
    {
      subject: "Філософія",
      teacherEmail: "surina.gyu@test.com",
    },
    {
      subject: "Правознавство",
      teacherEmail: "sokolik.vd@test.com",
    },
    {
      subject: "Іноземна мова",
      teacherEmail: "ponomarenko.ng@test.com",
    },
  ],

  "Психологія|2": [
    {
      subject: "Вікова психологія",
      teacherEmail: "miroshkina.nv@test.com",
    },
    {
      subject: "Психодіагностика",
      teacherEmail: "mayer.yv@test.com",
    },
    {
      subject: "Психофізіологія",
      teacherEmail: "mayer.yv@test.com",
    },
    {
      subject: "Диференційна психологія",
      teacherEmail: "mayer.yv@test.com",
    },
    {
      subject: "Арт-терапія",
      teacherEmail: "mayer.yv@test.com",
    },
    {
      subject: "Психологія бізнесу",
      teacherEmail: "mayer.yv@test.com",
    },
  ],

  "Психологія|3": [
    {
      subject: "Клінічна психологія",
      teacherEmail: "mayer.yv@test.com",
    },
    {
      subject: "Психологія ідентичності",
      teacherEmail: "mayer.yv@test.com",
    },
    {
      subject: "Соціальна психологія",
      teacherEmail: "borko.tm@test.com",
    },
    {
      subject: "Психологія сімейних відносин",
      teacherEmail: "zinchenko.ai@test.com",
    },
    {
      subject: "Психологічне консультування",
      teacherEmail: "tishechkina.kv@test.com",
    },
    {
      subject: "Економічна психологія",
      teacherEmail: "mayer.yv@test.com",
    },
  ],
};

// ==================================================
// BUILDINGS + REALISTIC ROOM POOLS
// ==================================================

const buildingRooms: Record<string, string[]> = {
  м: [
    "101",
    "103",
    "104",
    "107",
    "108",
    "201",
    "203",
    "206",
    "207",
    "208",
    "209",
    "210",
    "211",
    "212",
    "213",
    "216",
    "220",
    "301",
    "303",
    "306",
  ],

  гк: [
    "101",
    "111",
    "112",
    "116",
    "117",
    "211",
    "212",
    "213",
    "215",
    "217",
    "220",
    "223",
    "304",
    "309",
    "310",
    "313",
    "316",
    "319",
    "320",
    "324",
  ],

  карп: [
    "107",
    "107а",
    "109",
    "109а",
    "111",
    "112",
    "113",
    "114",
    "116",
    "202",
    "205",
    "206",
    "210",
    "212",
    "213",
    "215",
    "215а",
    "216",
    "217",
    "219",
    "220",
    "221",
    "222",
    "222а",
    "224",
    "304",
    "305",
    "306",
    "308",
    "310",
    "312",
    "404",
    "407",
    "408",
    "409",
    "410",
    "411",
    "413",
  ],
};

// ==================================================
// HELPERS
// ==================================================

function makeStudentName(
  groupIndex: number,
  studentIndex: number
) {
  const firstName =
    firstNames[
      (studentIndex + groupIndex * 2) % firstNames.length
    ];

  const lastName =
    lastNames[
      (studentIndex * 3 + groupIndex) % lastNames.length
    ];

  return {
    firstName,
    lastName,
  };
}

function makePhone(
  groupIndex: number,
  studentIndex: number
) {
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
    operatorCodes[
      (groupIndex + studentIndex) % operatorCodes.length
    ];

  const uniqueNumber =
    1000000 +
    groupIndex * 1000 +
    studentIndex * 17 +
    100;

  const numberString = String(uniqueNumber)
    .padStart(7, "0")
    .slice(-7);

  return `+380 ${operatorCode} ${numberString.slice(
    0,
    3
  )} ${numberString.slice(
    3,
    5
  )} ${numberString.slice(5, 7)}`;
}

function getDemoAttendanceStatus(
  groupIndex: number,
  studentIndex: number,
  lessonIndex: number
) {
  const score =
    (groupIndex * 17 +
      studentIndex * 13 +
      lessonIndex * 7) %
    100;

  const highRisk =
    studentIndex === 3 ||
    studentIndex === 8;

  const mediumRisk =
    studentIndex === 5 ||
    studentIndex === 11;

  if (highRisk) {
    if (score < 48) {
      return "N";
    }

    if (score < 55) {
      return "HV";
    }

    return "PRESENT";
  }

  if (mediumRisk) {
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

// ==================================================
// MAIN
// ==================================================

async function main() {
  console.log("");
  console.log("Starting full Faculty of Management seed...");
  console.log("");

  const passwordHash = await hash(DEMO_PASSWORD, 10);

  // ==================================================
  // CLEAR CURRENT DEMO DATA
  // ==================================================

  console.log("Clearing previous demo data...");

  await prisma.attendance.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.session.deleteMany();

  await prisma.teacher.deleteMany();

  await prisma.student.updateMany({
    data: {
      userId: null,
    },
  });

  await prisma.student.deleteMany();
  await prisma.user.deleteMany();

  await prisma.group.deleteMany();
  await prisma.specialty.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.faculty.deleteMany();

  console.log("Previous demo data cleared");

  // ==================================================
  // ROLES
  // ==================================================

  const roleNames = [
    "TEACHER",
    "STAROSTA",
    "CURATOR",
    "DEAN_OFFICE",
    "ADMIN",
  ];

  const roles = new Map<string, number>();

  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: {
        name,
      },
      update: {},
      create: {
        name,
      },
    });

    roles.set(name, role.id);
  }

  console.log("Roles ready");

  // ==================================================
  // ATTENDANCE STATUSES
  // ==================================================

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

  console.log("Attendance statuses ready");

  // ==================================================
  // BUILDINGS
  // ==================================================

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

  console.log("Buildings ready");

  // ==================================================
  // FACULTY
  // ==================================================

  const faculty = await prisma.faculty.create({
    data: {
      name: "Факультет менеджменту",
    },
  });

  console.log("Faculty created");

  // ==================================================
  // SPECIALTIES + GROUPS
  // ==================================================

  for (const specialtyData of specialties) {
    const specialty = await prisma.specialty.create({
      data: {
        code: specialtyData.code,
        name: specialtyData.name,
        facultyId: faculty.id,
      },
    });

    for (const group of specialtyData.groups) {
      await prisma.group.create({
        data: {
          name: group.name,
          course: group.course,
          specialtyId: specialty.id,
        },
      });
    }
  }

  const groups = await prisma.group.findMany({
    include: {
      specialty: true,
    },
    orderBy: [
      {
        course: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  console.log(`Groups created: ${groups.length}`);

  // ==================================================
  // STUDENTS
  // ==================================================

  for (
    let groupIndex = 0;
    groupIndex < groups.length;
    groupIndex++
  ) {
    const group = groups[groupIndex];

    for (
      let studentIndex = 0;
      studentIndex < 15;
      studentIndex++
    ) {
      const studentName = makeStudentName(
        groupIndex,
        studentIndex
      );

      await prisma.student.create({
        data: {
          firstName: studentName.firstName,
          lastName: studentName.lastName,
          phone: makePhone(
            groupIndex,
            studentIndex
          ),
          groupId: group.id,
        },
      });
    }
  }

  console.log("Demo students created");

  // ==================================================
  // TEACHER USERS
  // ==================================================

  const teacherRoleId = roles.get("TEACHER");

  if (!teacherRoleId) {
    throw new Error("TEACHER role not found");
  }

  const teachersByEmail =
    new Map<string, number>();

  for (const teacherData of teachers) {
    const user = await prisma.user.create({
      data: {
        email: teacherData.email,
        passwordHash,
        firstName: teacherData.firstName,
        lastName: teacherData.lastName,
        roleId: teacherRoleId,
      },
    });

    const teacher = await prisma.teacher.create({
      data: {
        firstName: teacherData.firstName,
        lastName: teacherData.lastName,
        userId: user.id,
      },
    });

    teachersByEmail.set(
      teacherData.email,
      teacher.id
    );
  }

  console.log(
    `Teacher accounts created: ${teachers.length}`
  );

  // ==================================================
  // ADMIN ACCOUNTS
  // ==================================================

  const administrativeAccounts = [
    {
      email: "curator@test.com",
      firstName: "Тестовий",
      lastName: "Куратор",
      role: "CURATOR",
    },
    {
      email: "dean@test.com",
      firstName: "Тестовий",
      lastName: "Деканат",
      role: "DEAN_OFFICE",
    },
    {
      email: "admin@test.com",
      firstName: "System",
      lastName: "Admin",
      role: "ADMIN",
    },
  ];

  for (const account of administrativeAccounts) {
    const roleId = roles.get(account.role);

    if (!roleId) {
      throw new Error(
        `${account.role} role not found`
      );
    }

    await prisma.user.create({
      data: {
        email: account.email,
        passwordHash,
        firstName: account.firstName,
        lastName: account.lastName,
        roleId,
      },
    });
  }

  // ==================================================
  // STAROSTA
  // ==================================================

  const starostaRoleId =
    roles.get("STAROSTA");

  if (!starostaRoleId) {
    throw new Error(
      "STAROSTA role not found"
    );
  }

  const demoStarostaGroup =
    await prisma.group.findFirst({
      where: {
        name: "Мен 3/1",
      },
      include: {
        students: {
          orderBy: {
            id: "asc",
          },
          take: 1,
        },
      },
    });

  if (
    !demoStarostaGroup ||
    demoStarostaGroup.students.length === 0
  ) {
    throw new Error(
      "Demo starosta student not found"
    );
  }

  const starostaStudent =
    demoStarostaGroup.students[0];

  const starostaUser =
    await prisma.user.create({
      data: {
        email: "starosta@test.com",
        passwordHash,
        firstName:
          starostaStudent.firstName,
        lastName:
          starostaStudent.lastName,
        roleId: starostaRoleId,
      },
    });

  await prisma.student.update({
    where: {
      id: starostaStudent.id,
    },
    data: {
      userId: starostaUser.id,
    },
  });

  console.log(
    "Administrative and starosta accounts created"
  );

  // ==================================================
  // SUBJECTS
  // ==================================================

  const allLessonDefinitions =
    Object.values(coursePools).flat();

  const uniqueSubjectNames = [
    ...new Set(
      allLessonDefinitions.map(
        (lesson) => lesson.subject
      )
    ),
  ];

  const subjectsByName =
    new Map<string, number>();

  for (const subjectName of uniqueSubjectNames) {
    const subject =
      await prisma.subject.create({
        data: {
          name: subjectName,
        },
      });

    subjectsByName.set(
      subjectName,
      subject.id
    );
  }

  console.log(
    `Subjects created: ${uniqueSubjectNames.length}`
  );

  // ==================================================
  // DEMO LESSONS
  //
  // Six lessons per group.
  // Course/group/subject/teacher are realistic.
  // Dates are demo data.
  // ==================================================

  const lessonDates = [
    new Date("2026-09-01T08:30:00"),
    new Date("2026-09-01T10:05:00"),

    new Date("2026-09-02T08:30:00"),
    new Date("2026-09-02T10:05:00"),

    new Date("2026-09-03T08:30:00"),
    new Date("2026-09-03T10:05:00"),
  ];

  for (
    let groupIndex = 0;
    groupIndex < groups.length;
    groupIndex++
  ) {
    const group = groups[groupIndex];

    const poolKey =
      `${group.specialty.name}|${group.course}`;

    const pool =
      coursePools[poolKey];

    if (!pool || pool.length === 0) {
      throw new Error(
        `No lesson pool for ${poolKey}`
      );
    }

    for (
      let lessonIndex = 0;
      lessonIndex < lessonDates.length;
      lessonIndex++
    ) {
      const lessonDefinition =
        pool[
          lessonIndex % pool.length
        ];

      const subjectId =
        subjectsByName.get(
          lessonDefinition.subject
        );

      if (!subjectId) {
        throw new Error(
          `Subject not found: ${lessonDefinition.subject}`
        );
      }

      const teacherId =
        teachersByEmail.get(
          lessonDefinition.teacherEmail
        );

      if (!teacherId) {
        throw new Error(
          `Teacher not found: ${lessonDefinition.teacherEmail}`
        );
      }

      const buildingCodes = [
        "м",
        "гк",
        "карп",
      ];

      const buildingCode =
        buildingCodes[
          (groupIndex +
            lessonIndex) %
            buildingCodes.length
        ];

      const building =
        buildingByCode.get(
          buildingCode
        );

      if (!building) {
        throw new Error(
          `Building not found: ${buildingCode}`
        );
      }

      const rooms =
        buildingRooms[
          buildingCode
        ];

      const room =
        rooms[
          (groupIndex * 5 +
            lessonIndex * 3) %
            rooms.length
        ];

      const lessonNumber =
        lessonIndex % 2 === 0
          ? 1
          : 2;

      await prisma.lesson.create({
        data: {
          date:
            lessonDates[
              lessonIndex
            ],
          lessonNumber,
          room,
          groupId: group.id,
          teacherId,
          subjectId,
          buildingId:
            building.id,
        },
      });
    }
  }

  console.log("Demo lessons created");

  // ==================================================
  // ATTENDANCE
  // ==================================================

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

  for (
    let groupIndex = 0;
    groupIndex < groups.length;
    groupIndex++
  ) {
    const group = groups[groupIndex];

    const students =
      await prisma.student.findMany({
        where: {
          groupId: group.id,
        },
        orderBy: {
          id: "asc",
        },
      });

    const lessons =
      await prisma.lesson.findMany({
        where: {
          groupId: group.id,
        },
        orderBy: [
          {
            date: "asc",
          },
          {
            lessonNumber:
              "asc",
          },
        ],
      });

    for (
      let lessonIndex = 0;
      lessonIndex < lessons.length;
      lessonIndex++
    ) {
      const lesson =
        lessons[lessonIndex];

      for (
        let studentIndex = 0;
        studentIndex < students.length;
        studentIndex++
      ) {
        const student =
          students[
            studentIndex
          ];

        const status =
          getDemoAttendanceStatus(
            groupIndex,
            studentIndex,
            lessonIndex
          );

        let statusId =
          presentStatus.id;

        if (status === "N") {
          statusId =
            absentStatus.id;
        }

        if (status === "HV") {
          statusId =
            hvStatus.id;
        }

        await prisma.attendance.create({
          data: {
            studentId:
              student.id,
            lessonId:
              lesson.id,
            statusId,
          },
        });
      }
    }
  }

  console.log("Attendance generated");

  // ==================================================
  // RESULT
  // ==================================================

  const facultiesCount =
    await prisma.faculty.count();

  const specialtiesCount =
    await prisma.specialty.count();

  const groupsCount =
    await prisma.group.count();

  const studentsCount =
    await prisma.student.count();

  const teachersCount =
    await prisma.teacher.count();

  const subjectsCount =
    await prisma.subject.count();

  const lessonsCount =
    await prisma.lesson.count();

  const attendanceCount =
    await prisma.attendance.count();

  const usersCount =
    await prisma.user.count();

  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "FULL FACULTY SEED COMPLETED"
  );
  console.log(
    "========================================"
  );
  console.log("");

  console.log(
    `Faculties: ${facultiesCount}`
  );

  console.log(
    `Specialties: ${specialtiesCount}`
  );

  console.log(
    `Groups: ${groupsCount}`
  );

  console.log(
    `Students: ${studentsCount}`
  );

  console.log(
    `Teachers: ${teachersCount}`
  );

  console.log(
    `Subjects: ${subjectsCount}`
  );

  console.log(
    `Lessons: ${lessonsCount}`
  );

  console.log(
    `Attendance records: ${attendanceCount}`
  );

  console.log(
    `Users: ${usersCount}`
  );

  console.log("");
  console.log(
    "Groups by course"
  );
  console.log(
    "----------------------------------------"
  );

  for (const course of [1, 2, 3, 4]) {
    const count =
      await prisma.group.count({
        where: {
          course,
        },
      });

    console.log(
      `Course ${course}: ${count} groups`
    );
  }

  console.log("");
  console.log(
    "Demo accounts"
  );
  console.log(
    "----------------------------------------"
  );

  console.log(
    "admin@test.com"
  );

  console.log(
    "dean@test.com"
  );

  console.log(
    "curator@test.com"
  );

  console.log(
    "starosta@test.com"
  );

  console.log("");
  console.log(
    `All passwords: ${DEMO_PASSWORD}`
  );

  console.log("");
  console.log(
    "Teacher login example:"
  );

  console.log(
    "kolomiets.am@test.com"
  );

  console.log(
    `Password: ${DEMO_PASSWORD}`
  );

  console.log("");
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "FULL SEED FAILED:"
    );

    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });