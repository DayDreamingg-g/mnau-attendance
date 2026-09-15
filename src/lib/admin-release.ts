import {randomBytes,randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {db} from './db';
import {principalSelect,hasRole,isManager,type Principal} from './auth';
import {requireAdmin} from './access';
import {HttpError} from './errors';
import {positions,teacherIdentity} from './teacher-identity';
const reason=z.string().trim().min(5).max(500);
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('CREATE_TEACHER'),name:z.string().trim().min(2).max(200),position:z.enum(Object.keys(positions) as [keyof typeof positions,...(keyof typeof positions)[]]),email:z.email().max(200).transform(s=>s.toLowerCase()),facultyId:z.string().max(100),subjects:z.array(z.string().max(100)).max(100),groups:z.array(z.string().max(100)).max(100),roles:z.array(z.enum(['TEACHER','CURATOR','DEAN_OFFICE'])).min(1).max(3),reason:reason.optional()}).strict(),
 z.object({action:z.literal('RETIRE_TEACHER'),teacherId:z.string().max(100),confirm:z.literal(true),expectedFuture:z.number().int().min(0),reason}).strict(),
 z.object({action:z.literal('SELF_ROLES'),roles:z.array(z.enum(['TEACHER','CURATOR','DEAN_OFFICE','STAROSTA','ADMIN','DEVELOPER'])).min(1).max(6),confirm:z.literal(true),reason}).strict(),
 z.object({action:z.literal('RESET_COOLDOWN'),key:z.string().max(150),reason}).strict(),
 z.object({action:z.literal('FEEDBACK_STATE'),id:z.string().max(100),state:z.enum(['NEW','IN_PROGRESS','RESOLVED']),reason:reason.optional()}).strict(),
 z.object({action:z.enum(['ASSIGN_SUBJECT','REMOVE_SUBJECT','ASSIGN_TEACHING_GROUP','REMOVE_TEACHING_GROUP']),teacherId:z.string().max(100),target:z.string().max(100),reason}).strict(),
]);
export async function adminRelease(user:Principal,raw:unknown){requireAdmin(user);const parsed=input.safeParse(raw);if(!parsed.success)throw new HttpError(400,'Перевірте параметри дії та причину.');const p=parsed.data;
 const password=p.action==='CREATE_TEACHER'?randomBytes(18).toString('base64url'):undefined;
 const passwordHash=password?await bcrypt.hash(password,12):undefined;
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(9152028)::text`;
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
  const actor=await tx.user.findUniqueOrThrow({where:{id:user.id},select:principalSelect});if(!actor.active||actor.mustChangePassword||!isManager(actor))throw new HttpError(403,'Адміністративна дія недоступна.');
  let objectId:string=user.id,details:unknown=p;
  if(p.action==='CREATE_TEACHER'){
   if(!p.roles.includes('TEACHER')||!await tx.faculty.findUnique({where:{id:p.facultyId}}))throw new HttpError(400,'Оберіть роль викладача та факультет.');
   if(await tx.user.findUnique({where:{email:p.email}}))throw new HttpError(409,'Email вже використовується. Призначте наявний обліковий запис.');
   if(await tx.group.count({where:{id:{in:p.groups},specialty:{facultyId:p.facultyId}}})!==new Set(p.groups).size||await tx.subject.count({where:{id:{in:p.subjects}}})!==new Set(p.subjects).size)throw new HttpError(400,'Перевірте групи та дисципліни.');
   objectId=randomUUID();const teacherId=randomUUID();const identity=teacherIdentity(p.name,p.position);
   await tx.user.create({data:{id:objectId,email:p.email,name:identity.name,position:identity.position,passwordHash:passwordHash!,mustChangePassword:true,roles:{create:[...new Set(p.roles)].map(roleId=>({roleId}))},teacher:{create:{id:teacherId,displayName:identity.name,position:identity.position,source:{type:'ADMIN_CREATED',originalName:p.name,facultyId:p.facultyId},subjects:{create:[...new Set(p.subjects)].map(subjectId=>({subjectId}))},groups:{create:[...new Set(p.groups)].map(groupId=>({groupId}))}}},...(p.roles.includes('CURATOR')?{curatorAssignments:{create:[...new Set(p.groups)].map(groupId=>({groupId}))}}:{}),...(p.roles.includes('DEAN_OFFICE')?{deanAssignments:{create:{facultyId:p.facultyId}}}:{})}});
   details={...p,teacherId};
  }else if(p.action==='RETIRE_TEACHER'){
   const teacher=await tx.teacher.findUnique({where:{id:p.teacherId}});if(!teacher||teacher.retiredAt)throw new HttpError(404,'Активного викладача не знайдено.');
   if(teacher.userId===actor.id)throw new HttpError(403,'Власні ролі змінюються лише спеціальною дією розробника.');
   if(teacher.userId&&!hasRole(actor,'DEVELOPER')&&await tx.userRole.findUnique({where:{userId_roleId:{userId:teacher.userId,roleId:'DEVELOPER'}}}))throw new HttpError(403,'Адміністратор не змінює права розробника.');
   const future=await tx.lesson.count({where:{teacherId:teacher.id,startAt:{gt:new Date()},cancelled:false}});
   if(future!==p.expectedFuture)throw new HttpError(409,'Кількість майбутніх занять змінилася. Оновіть підтвердження.');
   if(teacher.userId){await tx.$queryRaw`SELECT id FROM "User" WHERE id=${teacher.userId} FOR UPDATE`;await tx.userRole.deleteMany({where:{userId:teacher.userId,roleId:'TEACHER'}});await tx.session.deleteMany({where:{userId:teacher.userId}});}
   await tx.teacher.update({where:{id:teacher.id},data:{retiredAt:new Date()}});objectId=teacher.id;details={...p,futureNeedsReassignment:future};
  }else if(p.action==='SELF_ROLES'){
   if(!hasRole(actor,'DEVELOPER'))throw new HttpError(403,'Лише розробник може змінити власні ролі.');
   if(!p.roles.some(r=>['ADMIN','DEVELOPER'].includes(r))&&!await tx.user.count({where:{id:{not:actor.id},active:true,roles:{some:{roleId:{in:['ADMIN','DEVELOPER']}}}}}))throw new HttpError(409,'Потрібен хоча б один активний адміністратор.');
   await tx.userRole.deleteMany({where:{userId:actor.id,roleId:{notIn:p.roles}}});await tx.userRole.createMany({data:[...new Set(p.roles)].map(roleId=>({userId:actor.id,roleId})),skipDuplicates:true});details={...p,before:actor.roles.map(r=>r.roleId)};
  }else if(p.action==='RESET_COOLDOWN'){
   const before=await tx.loginBucket.findUnique({where:{key:p.key}});if(!before)throw new HttpError(404,'Обмеження не знайдено.');
   await tx.loginBucket.update({where:{key:p.key},data:{attempts:0,strikes:0,blockedUntil:null,resetAt:new Date()}});objectId=p.key;details={...p,before:{attempts:before.attempts,strikes:before.strikes,blockedUntil:before.blockedUntil?.toISOString()}};
  }else if(p.action==='FEEDBACK_STATE'){
   const before=await tx.feedback.findUniqueOrThrow({where:{id:p.id}});await tx.feedback.update({where:{id:p.id},data:{state:p.state}});objectId=p.id;details={...p,before:before.state};
  }else{
   const teacher=await tx.teacher.findUnique({where:{id:p.teacherId}});if(!teacher||teacher.retiredAt)throw new HttpError(404,'Викладача не знайдено.');objectId=teacher.id;
   if(p.action==='ASSIGN_SUBJECT')await tx.teacherSubject.upsert({where:{teacherId_subjectId:{teacherId:teacher.id,subjectId:p.target}},create:{teacherId:teacher.id,subjectId:p.target},update:{}});
   if(p.action==='REMOVE_SUBJECT')await tx.teacherSubject.deleteMany({where:{teacherId:teacher.id,subjectId:p.target}});
   if(p.action==='ASSIGN_TEACHING_GROUP')await tx.teacherGroup.upsert({where:{teacherId_groupId:{teacherId:teacher.id,groupId:p.target}},create:{teacherId:teacher.id,groupId:p.target},update:{}});
   if(p.action==='REMOVE_TEACHING_GROUP')await tx.teacherGroup.deleteMany({where:{teacherId:teacher.id,groupId:p.target}});
  }
  await tx.auditLog.create({data:{actorId:actor.id,objectType:p.action==='FEEDBACK_STATE'?'Feedback':p.action==='RESET_COOLDOWN'?'LoginBucket':'Administration',objectId,source:'ADMIN_'+p.action,reason:p.reason,details:JSON.parse(JSON.stringify(details))}});
  return {ok:true,...(password?{password}:{})};
 },{timeout:15000});
}
