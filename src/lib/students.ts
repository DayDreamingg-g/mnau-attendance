import {obsoleteCSCalendar} from './beta-calendar';
import {CS_GROUP_IDS} from './cs-beta-data';
import {randomUUID,randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {db} from './db';
import {principalSelect,isManager,type Principal} from './auth';
import {hardDeleteStudent} from './student-cleanup';
import {canCorrectGroup,canManageStudents} from './access';
import {effectiveNow} from './time';
import {HttpError} from './errors';
import {journalStateFromCounts} from './journal-state';
import type {Prisma} from '../generated/prisma/client';

const input=z.object({action:z.enum(['ADD','EDIT','ARCHIVE','RESTORE','TRANSFER','DELETE']),groupId:z.string().min(1).max(100),studentId:z.string().max(100).optional(),confirmDelete:z.literal(true).optional(),fullName:z.string().trim().min(2).max(200).optional(),phone:z.string().trim().max(40).nullable().optional(),targetGroupId:z.string().max(100).optional(),reason:z.string().trim().min(5).max(500)}).strict();
export async function refreshRosterState(tx:Prisma.TransactionClient,lessonIds:string[]){
  for(const id of [...new Set(lessonIds)].sort()){
    const expected=await tx.lessonStudent.count({where:{lessonId:id}});
    const marked=await tx.attendance.count({where:{lessonId:id}});
    const confirmed=await tx.attendance.count({where:{lessonId:id,confirmed:true}});
    await tx.lesson.update({where:{id},data:{version:{increment:1},journalState:journalStateFromCounts(expected,marked,confirmed)}});
  }
}
/** Caller owns group locks; schedule generation takes the same locks. */
export async function addCurrentRoster(tx:Prisma.TransactionClient,student:{id:string;groupId:string},now:Date){
  const lessons=await tx.lesson.findMany({where:{...(CS_GROUP_IDS.includes(student.groupId as typeof CS_GROUP_IDS[number])?{NOT:obsoleteCSCalendar}:{}),cancelled:false,endAt:{gt:now},groups:{some:{groupId:student.groupId}}},select:{id:true},orderBy:{id:'asc'}});
  const changed:string[]=[];
  for(const lesson of lessons){
    await tx.$queryRaw`SELECT "id" FROM "Lesson" WHERE "id"=${lesson.id} FOR UPDATE`;
    const added=await tx.lessonStudent.createMany({data:[{lessonId:lesson.id,studentId:student.id,groupId:student.groupId}],skipDuplicates:true});
    if(added.count)changed.push(lesson.id);
  }
  return changed;
}
export async function changeStudent(user:Principal,raw:unknown){
  const parsed=input.safeParse(raw);if(!parsed.success)throw new HttpError(400,'Перевірте ПІБ, групу і причину зміни.');
  const p=parsed.data;
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${user.id} FOR UPDATE`;
    const actor=await tx.user.findUnique({where:{id:user.id},select:principalSelect});
    if(!actor?.active)throw new HttpError(401,'Обліковий запис недоступний.');
    for(const id of [...new Set([p.groupId,p.targetGroupId].filter((id):id is string=>!!id))].sort())await tx.$queryRaw`SELECT "id" FROM "Group" WHERE "id"=${id} FOR UPDATE`;
    const group=await tx.group.findUnique({where:{id:p.groupId},include:{specialty:true}});
    if(!group)throw new HttpError(404,'Групу не знайдено.');
    if(!canManageStudents(actor,group))throw new HttpError(403,'Немає доступу до складу цієї групи.');
    const now=effectiveNow().toJSDate();
    let before=null;
    if(p.action!=='ADD'){
      if(!p.studentId)throw new HttpError(400,'Оберіть студента.');
      await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id"=${p.studentId} FOR UPDATE`;
      before=await tx.student.findUnique({where:{id:p.studentId}});
      if(!before)throw new HttpError(404,'Студента не знайдено.');
      if(before.groupId!==group.id)throw new HttpError(403,'Студент не належить обраній групі.');
    }
    let changed:string[]=[];
    if(p.action==='DELETE'){
      if(!isManager(actor))throw new HttpError(403,'Видалення доступне адміністратору або розробнику.');
      if(!p.confirmDelete)throw new HttpError(400,'Підтвердіть остаточне видалення.');
      const result=await hardDeleteStudent(tx,before!.id);
      await refreshRosterState(tx,result.lessonIds);
      await tx.auditLog.create({data:{actorId:actor.id,studentId:before!.id,groupId:group.id,objectType:'Student',objectId:before!.id,source:'ROSTER_MANAGEMENT',reason:p.reason,details:{action:'DELETE',fullName:before!.fullName,userId:before!.userId}}});
      return {ok:true,studentId:before!.id};
    }
    let after;
    if(p.action==='ADD'){
      if(!p.fullName)throw new HttpError(400,'Вкажіть ПІБ.');
      after=await tx.student.create({data:{id:randomUUID(),fullName:p.fullName,phone:p.phone||null,groupId:group.id,isSynthetic:false,joinedAt:now,source:{type:'MANUAL',actorId:actor.id,actorName:actor.name,createdAt:now.toISOString(),reason:p.reason}}});
      changed=await addCurrentRoster(tx,after,now);
    }else if(p.action==='EDIT'){
      after=await tx.student.update({where:{id:before!.id},data:{fullName:p.fullName,phone:p.phone===undefined?undefined:p.phone||null}});
      if(after.userId)await tx.user.update({where:{id:after.userId},data:{name:after.fullName}});
    }else{
      if(p.action==='TRANSFER'){
        const target=p.targetGroupId?await tx.group.findUnique({where:{id:p.targetGroupId},include:{specialty:true}}):null;
        if(!target)throw new HttpError(404,'Цільову групу не знайдено.');
        if(!canCorrectGroup(actor,group)||!canCorrectGroup(actor,target))throw new HttpError(403,'Переведення потребує прав на обидві групи.');
        if(target.id===group.id||!before!.active)throw new HttpError(400,'Оберіть іншу групу для активного студента.');
      }
      if(p.action!=='RESTORE'){
        const future=await tx.lessonStudent.findMany({where:{studentId:before!.id,groupId:group.id,OR:[{lesson:{startAt:{gt:now}}},{lesson:{startAt:{lte:now},endAt:{gt:now}},attendance:null}]},select:{lessonId:true}});
        for(const row of future)await tx.$queryRaw`SELECT "id" FROM "Lesson" WHERE "id"=${row.lessonId} FOR UPDATE`;
        if(await tx.attendance.count({where:{studentId:before!.id,lessonId:{in:future.map(r=>r.lessonId)}}}))throw new HttpError(409,'У майбутньому журналі є відмітки; зверніться до адміністратора.');
        await tx.lessonStudent.deleteMany({where:{studentId:before!.id,lessonId:{in:future.map(r=>r.lessonId)}}});
        changed=future.map(r=>r.lessonId);
      }
      after=await tx.student.update({where:{id:before!.id},data:p.action==='TRANSFER'?{groupId:p.targetGroupId,joinedAt:now}:p.action==='ARCHIVE'?{active:false,archivedAt:now}:{active:true,archivedAt:null,joinedAt:now}});
      if(p.action==='ARCHIVE'&&after.userId){await tx.user.update({where:{id:after.userId},data:{active:false}});await tx.session.deleteMany({where:{userId:after.userId}});}
      if(after.active)changed.push(...await addCurrentRoster(tx,after,now));
    }
    await refreshRosterState(tx,changed);
    const snapshot=(s:typeof after|null)=>s?{fullName:s.fullName,phone:s.phone,groupId:s.groupId,active:s.active,archivedAt:s.archivedAt?.toISOString()??null}:null;
    await tx.auditLog.create({data:{actorId:actor.id,groupId:group.id,studentId:after.id,objectType:'Student',objectId:after.id,reason:p.reason,source:'ROSTER_MANAGEMENT',details:{action:p.action,before:snapshot(before),after:snapshot(after),rosterLessons:changed.length}}});
    return {ok:true,studentId:after.id};
  },{maxWait:10000,timeout:60000});
}
const accountInput=z.object({studentId:z.string().min(1),email:z.email().max(200).transform(s=>s.toLowerCase()),reason:z.string().trim().min(5).max(500)}).strict();
export async function createStudentAccount(user:Principal,raw:unknown){
  const parsed=accountInput.safeParse(raw);if(!parsed.success)throw new HttpError(400,'Перевірте email та причину.');
  const p=parsed.data,password=randomBytes(18).toString('base64url'),passwordHash=await bcrypt.hash(password,12);
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${user.id} FOR UPDATE`;
    const actor=await tx.user.findUnique({where:{id:user.id},select:principalSelect});
    if(!actor?.active)throw new HttpError(401,'Обліковий запис недоступний.');
    await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id"=${p.studentId} FOR UPDATE`;
    const student=await tx.student.findUnique({where:{id:p.studentId},include:{group:{include:{specialty:true}}}});
    if(!student)throw new HttpError(404,'Студента не знайдено.');
    if(!canCorrectGroup(actor,student.group))throw new HttpError(403,'Створювати облікові записи може куратор, деканат, адміністратор або розробник.');
    if(!student.active||student.userId||await tx.user.findUnique({where:{email:p.email}}))throw new HttpError(409,'Студент неактивний або обліковий запис вже існує.');
    await tx.role.upsert({where:{id:'STUDENT'},create:{id:'STUDENT',label:'Студент'},update:{}});
    const account=await tx.user.create({data:{email:p.email,name:student.fullName,passwordHash,roles:{create:{roleId:'STUDENT'}}}});
    await tx.student.update({where:{id:student.id},data:{userId:account.id}});
    await tx.auditLog.create({data:{actorId:actor.id,groupId:student.groupId,studentId:student.id,objectType:'StudentAccount',objectId:account.id,reason:p.reason,source:'ACCOUNT_MANAGEMENT',details:{action:'CREATE',email:p.email}}});
    return {ok:true,email:p.email,password};
  });
}
