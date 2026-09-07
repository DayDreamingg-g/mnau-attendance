import {DateTime} from 'luxon';
import {z} from 'zod';
import {today,ZONE,atKyiv} from './time';
import {HttpError} from './errors';

export type Search=Record<string,string|string[]|undefined>;

export const sortKeys=[
  'student',
  'group',
  'present',
  'n',
  'hv',
  'unmarked',
  'pending',
  'percentage',
  'groups_name', 'groups_course', 'groups_specialty', 'groups_students', 'groups_lessons', 'groups_percentage',
  'specialties_name', 'specialties_groups', 'specialties_students', 'specialties_percentage',
  'history_date', 'history_pair', 'history_subject', 'history_teacher', 'history_location', 'history_status', 'history_confirmation',
  'lessons_date', 'lessons_subject', 'lessons_teacher', 'lessons_location', 'lessons_state',
  'reports_kind', 'reports_faculty', 'reports_period', 'reports_state', 'reports_updated',
  'report_student', 'report_group', 'report_percentage',
  'audit_date', 'audit_actor', 'audit_student',
] as const;

export type SortKey=(typeof sortKeys)[number];
export type SortOrder='asc'|'desc';

export type Filters={
  from:string;
  to:string;
  course?:number;
  faculty?:string;
  specialty?:string;
  group?:string;
  student?:string;
  subject?:string;
  status?:string;
  threshold?:number;
  sort?:SortKey;
  order?:SortOrder;
};

const validDate=z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value)=>DateTime.fromISO(value,{zone:ZONE}).isValid,
  );

const schema=z.object({
  from:validDate,
  to:validDate,

  course:z.coerce
    .number()
    .int()
    .min(1)
    .max(4)
    .optional(),

  faculty:z.string()
    .max(100)
    .optional(),

  specialty:z.string()
    .max(100)
    .optional(),

  group:z.string()
    .max(100)
    .optional(),

  student:z.string().max(100).optional(),

  subject:z.string()
    .max(100)
    .optional(),

  status:z.enum([
    'PRESENT',
    'N',
    'HV',
    'UNMARKED',
    'PENDING',
    'CANCELLED',
  ]).optional(),

  threshold:z.coerce
    .number()
    .refine(
      (value)=>value===50||value===70,
    )
    .optional(),

  sort:z.enum(sortKeys)
    .optional(),

  order:z.enum([
    'asc',
    'desc',
  ]).optional(),
});

export function parseFilters(
  search:Search,
):Filters{
  const raw:Record<string,string>={};

  for(const [key,value] of Object.entries(search)){
    if(Array.isArray(value)){
      throw new HttpError(
        400,
        'Фільтр не може повторюватися.',
      );
    }

    if(value){
      raw[key]=value;
    }
  }

  const parsed=schema.safeParse({
    from:DateTime
      .fromISO(
        today(),
        {zone:ZONE},
      )
      .minus({days:28})
      .toISODate()!,

    to:today(),

    ...raw,
  });

  if(!parsed.success){
    throw new HttpError(
      400,
      'Некоректні фільтри. Перевірте дати та курс.',
    );
  }

  const filters=parsed.data;

  if(
    filters.from>filters.to||
    DateTime
      .fromISO(filters.to)
      .diff(
        DateTime.fromISO(filters.from),
        'days',
      )
      .days>366
  ){
    throw new HttpError(
      400,
      'Оберіть період до 366 днів з правильною послідовністю дат.',
    );
  }

  return filters;
}

export function range(
  filters:Filters,
){
  return {
    gte:atKyiv(
      filters.from,
      '00:00:00',
    ),

    lte:atKyiv(
      filters.to,
      '23:59:59.999',
    ),
  };
}

export function filterLink(
  path:string,
  filters:Filters,
  overrides:Partial<Filters>={},
){
  const query=new URLSearchParams();

  for(const [key,value] of Object.entries({
    ...filters,
    ...overrides,
  })){
    if(
      value!==undefined&&
      value!==''
    ){
      query.set(
        key,
        String(value),
      );
    }
  }

  return `${path}?${query}`;
}