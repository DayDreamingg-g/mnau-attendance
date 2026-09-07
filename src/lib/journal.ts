import {createHash} from 'node:crypto';
import {z} from 'zod';
import {db} from './db';
import {hasRole,principalSelect,type Principal} from './auth';
import {lessonScope,groupScopeForLesson,rosterScope,canCorrectGroup} from './access';
import {HttpError} from './errors';
import {dayOf,today,effectiveNow} from './time';
import {confirmsRow} from './journal-submission';
import {journalStateForRoster,journalStateFromCounts} from './journal-state';
import type {Prisma} from '../generated/prisma/client';

const schema=z.object({version:z.number().int().min(0),requestId:z.uuid(),mode:z.enum(['DRAFT','CONFIRM','AUTO']),reason:z.string().trim().max(500).optional(),rows:z.array(z.object({studentId:z.string().min(1).max(100),status:z.enum(['PRESENT','N','HV']).nullable()})).min(1).max(500)}).strict();
export type JournalInput=z.infer<typeof schema>;
export async function journal(user:Principal,id:string,client:Prisma.TransactionClient=db){
  const lesson=await client.lesson.findFirst({where:{AND:[{id},lessonScope(user)]},include:{teacher:true,subject:true,building:true,source:true,_count:{select:{roster:true}},attendance:{select:{confirmed:true}},groups:{where:{group:groupScopeForLesson(user,id)},include:{group:{include:{specialty:true}}}},roster:{where:rosterScope(user),include:{student:{include:{group:{include:{specialty:true}}}},attendance:true}}}});
  if(!lesson)throw new HttpError(404,'Заняття недоступне.');
  // Derive on reads as well, so old databases remain safe before the repair migration.
  lesson.journalState=journalStateForRoster(lesson._count.roster,lesson.attendance);
  const isToday=dayOf(lesson.startAt)===today();
  const future=lesson.startAt>effectiveNow().toJSDate();
  const assigned=hasRole(user,'TEACHER')&&user.teacher?.id===lesson.teacherId;
  const rows=lesson.roster.map(r=>{const elevated=canCorrectGroup(user,r.student.group);const isStarosta=hasRole(user,'STAROSTA')&&user.student?.groupId===r.student.groupId&&lesson.starostaAllowed;const editable=!lesson.cancelled&&!future&&(isToday?(elevated||assigned||(isStarosta&&!r.attendance?.confirmed)):elevated);return {id:r.studentId,name:r.student.fullName,group:r.student.group.name,status:r.attendance?.statusCode??null,confirmed:r.attendance?.confirmed??false,editable,canConfirm:editable&&(elevated||assigned)};}).sort((a,b)=>a.name.localeCompare(b.name,'uk',{sensitivity:'base',numeric:true})||a.id.localeCompare(b.id));
  const audits=await client.auditLog.findMany({where:{lessonId:id,OR:[{studentId:{in:rows.map(r=>r.id)}},{studentId:null}]},include:{actor:{select:{name:true}}},orderBy:{createdAt:'desc'},take:200});
  return {lesson,rows,audits,isToday,future,canConfirm:rows.some(r=>r.canConfirm),needsReason:!isToday};
}
export async function saveJournal(user:Principal,id:string,raw:unknown){
  const parsed=schema.safeParse(raw);if(!parsed.success)throw new HttpError(400,'Некоректні відмітки або версія журналу.');
  const input=parsed.data;
  if(new Set(input.rows.map(r=>r.studentId)).size!==input.rows.length)throw new HttpError(400,'Студент повторюється у запиті.');
  const payloadHash=createHash('sha256').update(JSON.stringify({...input,rows:[...input.rows].sort((a,b)=>a.studentId.localeCompare(b.studentId))})).digest('hex');
  return db.$transaction(async tx=>{
    // Match the admin assignment transaction lock, so revocation and writes serialize.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
    // Resolve current assignments again at write time. A stale UI principal grants no rights.
    const actor=await tx.user.findUnique({where:{id:user.id},select:principalSelect});
    if(!actor?.active)throw new HttpError(401,'Увійдіть до системи.');
    const state=await journal(actor,id,tx);
    const replay=async()=>{
      const duplicate=await tx.journalSubmission.findUnique({where:{id:input.requestId}});
      if(!duplicate)return null;
      if(duplicate.userId!==actor.id||duplicate.lessonId!==id||duplicate.payloadHash!==payloadHash)throw new HttpError(409,'Ключ повторного запиту вже використаний.');
      // A draft may have been confirmed since the original successful request.
      // Return that current state without reapplying or reauthorizing old edits.
      const current=await journal(actor,id,tx);
      return {version:current.lesson.version,submittedVersion:duplicate.resultVersion,replayed:true,rows:current.rows,canConfirm:current.canConfirm,needsReason:current.needsReason};
    };
    const duplicate=await replay();if(duplicate)return duplicate;
    // The permission snapshot and submitted version must describe the same state.
    // A guessed future version must not bypass row protection after a concurrent confirmation.
    if(state.lesson.version!==input.version)throw new HttpError(409,'Журнал уже змінено іншим користувачем. Вашу чернетку збережено у формі. Завантажте актуальні дані та звірте зміни.');
    const rowMap=new Map(state.rows.map(r=>[r.id,r]));
    for(const row of input.rows){
      const original=rowMap.get(row.studentId);
      if(!original?.editable)throw new HttpError(403,'Змінювати ці відмітки заборонено.');
      if(confirmsRow(input.mode,original.canConfirm)&&!original.canConfirm)throw new HttpError(403,'Підтвердження доступне викладачу або уповноваженій особі.');
      if(!confirmsRow(input.mode,original.canConfirm)&&original.confirmed)throw new HttpError(403,'Підтверджені відмітки не можна перетворити на чернетку.');
    }
    if(state.needsReason&&(!input.reason||input.reason.length<5))throw new HttpError(400,'Для виправлення минулого дня вкажіть причину (від 5 символів).');
    const locked=await tx.lesson.updateMany({where:{AND:[{id,version:input.version,cancelled:false},lessonScope(actor)]},data:{version:{increment:1}}});
    if(locked.count!==1){
      // Concurrent requests with one idempotency key wait on the same Lesson lock.
      const duplicateAfterLock=await replay();if(duplicateAfterLock)return duplicateAfterLock;
      throw new HttpError(409,'Журнал уже змінено іншим користувачем. Вашу чернетку збережено у формі. Завантажте актуальні дані та звірте зміни.');
    }
    const current=await tx.attendance.findMany({where:{lessonId:id,studentId:{in:input.rows.map(r=>r.studentId)}}});
    const existing=new Map(current.map(r=>[r.studentId,r]));
    for(const row of input.rows){
      const old=existing.get(row.studentId);const confirmed=confirmsRow(input.mode,rowMap.get(row.studentId)!.canConfirm);
      if(row.status===null){await tx.attendance.deleteMany({where:{lessonId:id,studentId:row.studentId}});}else{await tx.attendance.upsert({where:{studentId_lessonId:{studentId:row.studentId,lessonId:id}},create:{studentId:row.studentId,lessonId:id,statusCode:row.status,confirmed},update:{statusCode:row.status,confirmed}});}
      if((old?.statusCode??null)!==row.status || (!!old?.confirmed)!==(row.status!==null&&confirmed))await tx.auditLog.create({data:{actorId:actor.id,lessonId:id,studentId:row.studentId,objectType:'Attendance',objectId:`${id}:${row.studentId}`,oldStatus:old?.statusCode??null,newStatus:row.status,reason:input.reason??null,source:!confirmed?(hasRole(actor,'STAROSTA')&&actor.student?.id?'STAROSTA_DRAFT':'AUTHORIZED_DRAFT'):state.needsReason?'AUTHORIZED_CORRECTION':'TEACHER_CONFIRMATION',details:{oldConfirmed:old?.confirmed??false,newConfirmed:row.status!==null&&confirmed,requestId:input.requestId}}});
    }
    const counts=await tx.attendance.groupBy({by:['confirmed'],where:{lessonId:id},_count:true});
    const total=counts.reduce((n,c)=>n+c._count,0),confirmed=counts.find(c=>c.confirmed)?._count??0;
    const expected=await tx.lessonStudent.count({where:{lessonId:id}});
    await tx.lesson.update({where:{id},data:{journalState:journalStateFromCounts(expected,total,confirmed)}});
    const resultVersion=input.version+1;
    await tx.journalSubmission.create({data:{id:input.requestId,lessonId:id,userId:actor.id,payloadHash,resultVersion}});
    const saved=await journal(actor,id,tx);
    return {version:resultVersion,submittedVersion:resultVersion,replayed:false,rows:saved.rows,canConfirm:saved.canConfirm,needsReason:saved.needsReason};
  },{maxWait:5000,timeout:15000});
}
