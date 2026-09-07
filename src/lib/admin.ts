import {z} from 'zod';
import {db} from './db';
import {requireAdmin} from './access';
import type {Principal} from './auth';
import {HttpError} from './errors';

const input=z.object({
  userId:z.string().min(1).max(100),
  action:z.enum(['ADD_ROLE','REMOVE_ROLE','ASSIGN_CURATOR','REMOVE_CURATOR','ASSIGN_DEAN','REMOVE_DEAN','ASSIGN_TEACHER','REMOVE_TEACHER','ASSIGN_STAROSTA','REMOVE_STAROSTA','REVOKE_SESSIONS']),
  target:z.string().min(1).max(100),
  reason:z.string().trim().min(5).max(500),
});
const role=z.enum(['ADMIN','DEAN_OFFICE','CURATOR','TEACHER','STAROSTA']);
const assignmentSelect={
  roles:{select:{roleId:true}},teacher:{select:{id:true}},student:{select:{id:true}},
  curatorAssignments:{select:{groupId:true}},deanAssignments:{select:{facultyId:true}},
  _count:{select:{sessions:true}},
} as const;
type AssignmentState={
  roles:{roleId:string}[];teacher:{id:string}|null;student:{id:string}|null;
  curatorAssignments:{groupId:string}[];deanAssignments:{facultyId:string}[];_count:{sessions:number};
};
function snapshot(user:AssignmentState,includeSessions:boolean){
  return {roles:user.roles.map(r=>r.roleId).sort(),teacherId:user.teacher?.id??null,studentId:user.student?.id??null,
    curatorGroupIds:user.curatorAssignments.map(a=>a.groupId).sort(),deanFacultyIds:user.deanAssignments.map(a=>a.facultyId).sort(),...(includeSessions?{sessions:user._count.sessions}:{})};
}

export async function adminChange(actor:Principal,body:unknown){
  requireAdmin(actor);
  const parsed=input.safeParse(body);
  if(!parsed.success)throw new HttpError(400,'Перевірте дію, об’єкт і причину.');
  const p=parsed.data;
  return db.$transaction(async tx=>{
    // Lock account rows consistently, then recheck authority after any concurrent revocation.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${actor.id}, ${p.userId}) ORDER BY "id" FOR UPDATE`;
    const currentActor=await tx.user.findUnique({where:{id:actor.id},select:{active:true,roles:{select:{roleId:true}}}});
    if(!currentActor?.active||!currentActor.roles.some(r=>r.roleId==='ADMIN'))throw new HttpError(403,'Потрібні права адміністратора.');
    const user=await tx.user.findUnique({where:{id:p.userId},select:assignmentSelect});
    if(!user)throw new HttpError(404,'Користувача не знайдено.');
    const before=snapshot(user,p.action==='REVOKE_SESSIONS');
    if(p.action==='ADD_ROLE'||p.action==='REMOVE_ROLE'){
      const r=role.safeParse(p.target);
      if(!r.success)throw new HttpError(400,'Невідома роль.');
      if(p.action==='ADD_ROLE')await tx.userRole.upsert({where:{userId_roleId:{userId:p.userId,roleId:r.data}},create:{userId:p.userId,roleId:r.data},update:{}});
      else{
        if(r.data==='ADMIN'&&p.userId===actor.id)throw new HttpError(403,'Не можна зняти власну роль адміністратора.');
        await tx.userRole.deleteMany({where:{userId:p.userId,roleId:r.data}});
      }
    }else if(p.action==='ASSIGN_CURATOR'||p.action==='REMOVE_CURATOR'){
      if(!await tx.group.findUnique({where:{id:p.target},select:{id:true}}))throw new HttpError(404,'Групу не знайдено.');
      if(p.action==='ASSIGN_CURATOR')await tx.curatorAssignment.upsert({where:{userId_groupId:{userId:p.userId,groupId:p.target}},create:{userId:p.userId,groupId:p.target},update:{}});
      else await tx.curatorAssignment.deleteMany({where:{userId:p.userId,groupId:p.target}});
    }else if(p.action==='ASSIGN_DEAN'||p.action==='REMOVE_DEAN'){
      if(!await tx.faculty.findUnique({where:{id:p.target},select:{id:true}}))throw new HttpError(404,'Факультет не знайдено.');
      if(p.action==='ASSIGN_DEAN')await tx.deanAssignment.upsert({where:{userId_facultyId:{userId:p.userId,facultyId:p.target}},create:{userId:p.userId,facultyId:p.target},update:{}});
      else await tx.deanAssignment.deleteMany({where:{userId:p.userId,facultyId:p.target}});
    }else if(p.action==='ASSIGN_TEACHER'||p.action==='REMOVE_TEACHER'){
      const teacher=await tx.teacher.findUnique({where:{id:p.target},select:{userId:true}});
      if(!teacher)throw new HttpError(404,'Профіль викладача не знайдено.');
      if(p.action==='ASSIGN_TEACHER'){
        if(teacher.userId&&teacher.userId!==p.userId)throw new HttpError(409,'Профіль уже має інший обліковий запис.');
        if(user.teacher&&user.teacher.id!==p.target)throw new HttpError(409,'Спочатку від’єднайте поточний профіль викладача користувача.');
        const changed=await tx.teacher.updateMany({where:{id:p.target,OR:[{userId:null},{userId:p.userId}]},data:{userId:p.userId}});
        if(changed.count!==1)throw new HttpError(409,'Призначення змінилося. Оновіть сторінку.');
      }else{
        if(teacher.userId!==p.userId)throw new HttpError(409,'Цей профіль не належить обраному користувачу.');
        const changed=await tx.teacher.updateMany({where:{id:p.target,userId:p.userId},data:{userId:null}});
        if(changed.count!==1)throw new HttpError(409,'Призначення змінилося. Оновіть сторінку.');
      }
    }else if(p.action==='ASSIGN_STAROSTA'||p.action==='REMOVE_STAROSTA'){
      const student=await tx.student.findUnique({where:{id:p.target},select:{userId:true}});
      if(!student)throw new HttpError(404,'Студента не знайдено.');
      if(p.action==='ASSIGN_STAROSTA'){
        if(student.userId&&student.userId!==p.userId)throw new HttpError(409,'Профіль уже має інший обліковий запис.');
        if(user.student&&user.student.id!==p.target)throw new HttpError(409,'Спочатку від’єднайте поточний профіль студента користувача.');
        const changed=await tx.student.updateMany({where:{id:p.target,OR:[{userId:null},{userId:p.userId}]},data:{userId:p.userId}});
        if(changed.count!==1)throw new HttpError(409,'Призначення змінилося. Оновіть сторінку.');
      }else{
        if(student.userId!==p.userId)throw new HttpError(409,'Цей профіль не належить обраному користувачу.');
        const changed=await tx.student.updateMany({where:{id:p.target,userId:p.userId},data:{userId:null}});
        if(changed.count!==1)throw new HttpError(409,'Призначення змінилося. Оновіть сторінку.');
      }
    }else{
      if(p.target!=='sessions')throw new HttpError(400,'Невідомий об’єкт відкликання сесій.');
      await tx.session.deleteMany({where:{userId:p.userId}});
    }
    const after=snapshot(await tx.user.findUniqueOrThrow({where:{id:p.userId},select:assignmentSelect}),p.action==='REVOKE_SESSIONS');
    const changed=JSON.stringify(before)!==JSON.stringify(after);
    if(changed)await tx.auditLog.create({data:{actorId:actor.id,objectType:'UserAssignment',objectId:p.userId,reason:p.reason,source:'ADMIN',details:{action:p.action,target:p.target,before,after}}});
    return {ok:true,changed};
  });
}
