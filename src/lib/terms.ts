import {randomUUID} from 'node:crypto';
import {DateTime} from 'luxon';
import {z} from 'zod';
import {db} from './db';
import {hasRole,isManager,principalSelect,type Principal} from './auth';
import {groupScope} from './access';
import {HttpError} from './errors';
import {atKyiv,today} from './time';
import type {Prisma} from '../generated/prisma/client';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>DateTime.fromISO(s).isValid);
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('CREATE'),name:z.string().trim().min(2).max(100),facultyId:z.string().max(100),fromDate:date,toDate:date,rosterMode:z.enum(['EMPTY','CURRENT_DRAFT']).default('EMPTY'),confirm:z.literal(true).optional(),reason:z.string().trim().min(5).max(500).optional()}).strict(),
 z.object({action:z.enum(['ARCHIVE','CONFIRM_ROSTER']),termId:z.string().max(100),confirm:z.literal(true),reason:z.string().trim().min(5).max(500)}).strict()
]);
export async function termScope(user:Principal,termId?:string,client:Prisma.TransactionClient=db):Promise<Prisma.LessonWhereInput>{
 const term=await client.academicTerm.findFirst({where:{...(termId?{id:termId}:{fromDate:{lte:today()},toDate:{gte:today()},archivedAt:null}),confirmedAt:{not:null},faculty:{specialties:{some:{groups:{some:groupScope(user)}}}}},orderBy:{fromDate:'desc'}});
 if(termId&&!term)throw new HttpError(404,'Семестр недоступний.');
 return term?{termId:term.id}:{};
}
export async function changeTerm(user:Principal,raw:unknown){const parsed=input.safeParse(raw);if(!parsed.success)throw new HttpError(400,'Перевірте дати, причину та підтвердження.');const p=parsed.data;return db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(9152027)::text`;
 await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
 const actor=await tx.user.findUniqueOrThrow({where:{id:user.id},select:principalSelect});if(!actor.active||actor.mustChangePassword)throw new HttpError(403,'Дія недоступна.');
 let id:string;let rosterDraft:{id:string;groupId:string;fullName:string}[]|undefined;
 if(p.action==='CREATE'){
  if(!isManager(actor))throw new HttpError(403,'Новий семестр підтверджує адміністратор.');
  if(p.fromDate>p.toDate||DateTime.fromISO(p.toDate).diff(DateTime.fromISO(p.fromDate),'days').days>366)throw new HttpError(400,'Некоректний період.');
  if(await tx.academicTerm.count({where:{facultyId:p.facultyId,fromDate:{lte:p.toDate},toDate:{gte:p.fromDate}}}))throw new HttpError(409,'Семестри не можуть перетинатися.');
  if(p.rosterMode==='CURRENT_DRAFT')rosterDraft=await tx.student.findMany({where:{active:true,group:{specialty:{facultyId:p.facultyId}}},select:{id:true,groupId:true,fullName:true},orderBy:{fullName:'asc'}});
  id=randomUUID();await tx.academicTerm.create({data:{id,name:p.name,facultyId:p.facultyId,fromDate:p.fromDate,toDate:p.toDate,confirmedAt:new Date()}});
 }else{
  id=p.termId;const term=await tx.academicTerm.findUnique({where:{id}});if(!term)throw new HttpError(404,'Семестр не знайдено.');
  if(!isManager(actor)&&!(p.action==='ARCHIVE'&&hasRole(actor,'DEAN_OFFICE')&&actor.deanAssignments.some(a=>a.facultyId===term.facultyId)))throw new HttpError(403,'Немає прав на цей семестр.');
  if(term.archivedAt)throw new HttpError(403,'Архів доступний лише для читання.');
  if(p.action==='ARCHIVE')await tx.academicTerm.update({where:{id},data:{archivedAt:new Date()}});
  else{
   if(term.rosterConfirmedAt)throw new HttpError(409,'Склад цього семестру вже підтверджено.');
   // Attach only existing unassigned lessons. No progression, new lessons or past snapshots.
   const lessons=await tx.lesson.findMany({where:{termId:null,startAt:{gte:atKyiv(term.fromDate,'00:00'),lte:atKyiv(term.toDate,'23:59:59.999')},groups:{some:{group:{specialty:{facultyId:term.facultyId}}},every:{group:{specialty:{facultyId:term.facultyId}}}}},include:{groups:{include:{group:{include:{students:{where:{active:true}}}}}}},orderBy:{id:'asc'}});
   for(const l of lessons){await tx.$queryRaw`SELECT id FROM "Lesson" WHERE id=${l.id} FOR UPDATE`;await tx.lesson.update({where:{id:l.id},data:{termId:id,version:{increment:1}}});if(l.startAt>new Date())await tx.lessonStudent.createMany({data:l.groups.flatMap(g=>g.group.students.map(s=>({lessonId:l.id,studentId:s.id,groupId:g.groupId}))),skipDuplicates:true});}
   await tx.academicTerm.update({where:{id},data:{rosterConfirmedAt:new Date()}});
  }
 }
 await tx.auditLog.create({data:{actorId:actor.id,objectType:'AcademicTerm',objectId:id,source:'TERM_'+p.action,reason:p.reason,details:JSON.parse(JSON.stringify({...p,...(rosterDraft?{rosterDraft}:{})}))}});return {ok:true,id};
},{timeout:60000});}
