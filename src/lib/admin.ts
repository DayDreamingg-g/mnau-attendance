import {randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {db} from './db';
import {requireAdmin} from './access';
import {isManager,hasRole,principalSelect,type Principal} from './auth';
import {HttpError} from './errors';
const input=z.object({
  userId:z.string().min(1).max(100),
  action:z.enum(['ADD_ROLE','REMOVE_ROLE','ASSIGN_CURATOR','REMOVE_CURATOR','ASSIGN_DEAN','REMOVE_DEAN','ASSIGN_TEACHER','REMOVE_TEACHER','ASSIGN_STUDENT','REMOVE_STUDENT','ASSIGN_STAROSTA','REMOVE_STAROSTA','REVOKE_SESSIONS','ENABLE','DISABLE','RESET_PASSWORD','RESET_BETA_PASSWORD']),
  target:z.string().min(1).max(100),reason:z.string().trim().min(5).max(500),
}).strict();
const role=z.enum(['ADMIN','DEVELOPER','DEAN_OFFICE','CURATOR','TEACHER','STAROSTA','STUDENT']);
const assignmentSelect={...principalSelect,_count:{select:{sessions:true}}} as const;
function snapshot(user:Principal&{_count:{sessions:number}},includeSessions:boolean){
  return {active:user.active,roles:user.roles.map(r=>r.roleId).sort(),teacherId:user.teacher?.id??null,studentId:user.student?.id??null,
    starostaGroupIds:user.starostaAssignments.map(a=>a.groupId).sort(),curatorGroupIds:user.curatorAssignments.map(a=>a.groupId).sort(),deanFacultyIds:user.deanAssignments.map(a=>a.facultyId).sort(),...(includeSessions?{sessions:user._count.sessions}:{})};
}
export async function adminChange(actor:Principal,body:unknown){
  requireAdmin(actor);
  const parsed=input.safeParse(body);
  if(!parsed.success)throw new HttpError(400,'Перевірте дію, об’єкт і причину.');
  const p=parsed.data;
  const reset=p.action==='RESET_PASSWORD'||p.action==='RESET_BETA_PASSWORD';
  if(p.action==='RESET_BETA_PASSWORD')throw new HttpError(403,'Спільний TEST-пароль вимкнено. Використайте унікальний тимчасовий пароль.');
  const password=reset?randomBytes(18).toString('base64url'):undefined;
  const passwordHash=password?await bcrypt.hash(password,12):undefined;
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(9152028)::text`;
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${actor.id}, ${p.userId}) ORDER BY "id" FOR UPDATE`;
    const currentActor=await tx.user.findUnique({where:{id:actor.id},select:principalSelect});
    if(!currentActor?.active||currentActor.mustChangePassword||!isManager(currentActor))throw new HttpError(403,'Потрібні права адміністратора або розробника.');
    const user=await tx.user.findUnique({where:{id:p.userId},select:assignmentSelect});
    if(!user)throw new HttpError(404,'Користувача не знайдено.');
    if(hasRole(user,'DEVELOPER')&&!hasRole(currentActor,'DEVELOPER'))throw new HttpError(403,'Керування розробником доступне лише розробнику.');
    const before=snapshot(user,p.action==='REVOKE_SESSIONS');
    if(p.action==='ADD_ROLE'||p.action==='REMOVE_ROLE'){
      const r=role.safeParse(p.target);
      if(!r.success)throw new HttpError(400,'Невідома роль.');
      if(p.userId===actor.id)throw new HttpError(403,'Власні ролі змінюються лише спеціальною дією розробника з підтвердженням.');
      if(r.data==='DEVELOPER'&&!hasRole(currentActor,'DEVELOPER'))throw new HttpError(403,'Роль розробника надає лише розробник.');
      if(p.action==='ADD_ROLE'){
        await tx.role.upsert({where:{id:r.data},create:{id:r.data,label:r.data},update:{}});
        await tx.userRole.upsert({where:{userId_roleId:{userId:p.userId,roleId:r.data}},create:{userId:p.userId,roleId:r.data},update:{}});
      }else{
        if(['ADMIN','DEVELOPER'].includes(r.data)&&p.userId===actor.id)throw new HttpError(403,'Не можна зняти власну роль керування системою.');
        await tx.userRole.deleteMany({where:{userId:p.userId,roleId:r.data}});
      }
    }else if(['ASSIGN_CURATOR','REMOVE_CURATOR','ASSIGN_STAROSTA','REMOVE_STAROSTA'].includes(p.action)){
      if(!await tx.group.findUnique({where:{id:p.target},select:{id:true}}))throw new HttpError(404,'Групу не знайдено.');
      if(p.action==='ASSIGN_CURATOR'&&!hasRole(user,'CURATOR')||p.action==='ASSIGN_STAROSTA'&&!hasRole(user,'STAROSTA'))throw new HttpError(400,'Спочатку призначте відповідну роль.');
      if(p.action==='ASSIGN_CURATOR')await tx.curatorAssignment.upsert({where:{userId_groupId:{userId:p.userId,groupId:p.target}},create:{userId:p.userId,groupId:p.target},update:{}});
      if(p.action==='REMOVE_CURATOR')await tx.curatorAssignment.deleteMany({where:{userId:p.userId,groupId:p.target}});
      if(p.action==='ASSIGN_STAROSTA')await tx.starostaAssignment.upsert({where:{userId_groupId:{userId:p.userId,groupId:p.target}},create:{userId:p.userId,groupId:p.target},update:{}});
      if(p.action==='REMOVE_STAROSTA')await tx.starostaAssignment.deleteMany({where:{userId:p.userId,groupId:p.target}});
    }else if(p.action==='ASSIGN_DEAN'||p.action==='REMOVE_DEAN'){
      if(!await tx.faculty.findUnique({where:{id:p.target},select:{id:true}}))throw new HttpError(404,'Факультет не знайдено.');
      if(p.action==='ASSIGN_DEAN')await tx.deanAssignment.upsert({where:{userId_facultyId:{userId:p.userId,facultyId:p.target}},create:{userId:p.userId,facultyId:p.target},update:{}});
      else await tx.deanAssignment.deleteMany({where:{userId:p.userId,facultyId:p.target}});
    }else if(p.action==='ASSIGN_TEACHER'||p.action==='REMOVE_TEACHER'){
      const teacher=await tx.teacher.findUnique({where:{id:p.target},select:{userId:true,retiredAt:true}});
      if(!teacher||teacher.retiredAt)throw new HttpError(404,'Профіль викладача не знайдено.');
      if(p.action==='ASSIGN_TEACHER'){
        if(teacher.userId&&teacher.userId!==p.userId)throw new HttpError(409,'Профіль уже має інший обліковий запис.');
        if(user.teacher&&user.teacher.id!==p.target)throw new HttpError(409,'Спочатку від’єднайте поточний профіль викладача.');
        const changed=await tx.teacher.updateMany({where:{id:p.target,OR:[{userId:null},{userId:p.userId}]},data:{userId:p.userId}});
        if(changed.count!==1)throw new HttpError(409,'Призначення змінилося. Оновіть сторінку.');
      }else{
        if(teacher.userId!==p.userId)throw new HttpError(409,'Цей профіль не належить обраному користувачу.');
        await tx.teacher.updateMany({where:{id:p.target,userId:p.userId},data:{userId:null}});
      }
    }else if(p.action==='ASSIGN_STUDENT'||p.action==='REMOVE_STUDENT'){
      await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id"=${p.target} FOR UPDATE`;
      const student=await tx.student.findUnique({where:{id:p.target}});
      if(!student)throw new HttpError(404,'Профіль студента не знайдено.');
      if(p.action==='ASSIGN_STUDENT'){
        if(!user.roles.some(r=>r.roleId==='STUDENT')||!student.active)throw new HttpError(400,'Потрібна роль STUDENT та активний профіль.');
        if(student.userId&&student.userId!==p.userId||user.student&&user.student.id!==student.id)throw new HttpError(409,'Профіль вже пов’язаний.');
        await tx.student.update({where:{id:student.id},data:{userId:p.userId}});
      }else{
        if(student.userId!==p.userId)throw new HttpError(409,'Профіль належить іншому користувачу.');
        await tx.student.update({where:{id:student.id},data:{userId:null}});
      }
      await tx.session.deleteMany({where:{userId:p.userId}});
    }else if(p.action==='DISABLE'||p.action==='ENABLE'){
      if(p.action==='DISABLE'&&p.userId===actor.id)throw new HttpError(403,'Не можна вимкнути власний обліковий запис.');
      await tx.user.update({where:{id:p.userId},data:{active:p.action==='ENABLE'}});
      if(p.action==='DISABLE')await tx.session.deleteMany({where:{userId:p.userId}});
    }else if(reset){
      await tx.user.update({where:{id:p.userId},data:{passwordHash,mustChangePassword:true}});
      await tx.session.deleteMany({where:{userId:p.userId}});
    }else{
      if(p.target!=='sessions')throw new HttpError(400,'Невідомий об’єкт відкликання сесій.');
      await tx.session.deleteMany({where:{userId:p.userId}});
    }
    if(!await tx.user.count({where:{active:true,roles:{some:{roleId:{in:['ADMIN','DEVELOPER']}}}}}))throw new HttpError(409,'Не можна прибрати останній адміністративний доступ.');
    const after=snapshot(await tx.user.findUniqueOrThrow({where:{id:p.userId},select:assignmentSelect}),p.action==='REVOKE_SESSIONS');
    const changed=reset||JSON.stringify(before)!==JSON.stringify(after);
    if(changed)await tx.auditLog.create({data:{actorId:actor.id,objectType:'UserAssignment',objectId:p.userId,reason:p.reason,source:'ADMIN',details:{action:p.action,target:p.target,before,after}}});
    return {ok:true,changed,...(password?{password}:{})};
  });
}
