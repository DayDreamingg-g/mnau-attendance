import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {db} from './db';
import {hasRole,homeFor,principalSelect,type Principal} from './auth';
import {HttpError} from './errors';
import {positions,teacherIdentity} from './teacher-identity';
export {positions} from './teacher-identity';
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('PROFILE'),name:z.string().trim().min(2).max(200),position:z.enum(Object.keys(positions) as [keyof typeof positions,...(keyof typeof positions)[]])}).strict(),
  z.object({action:z.literal('PASSWORD'),currentPassword:z.string().min(1).max(128),newPassword:z.string().min(10).max(128)}).strict(),
  z.object({action:z.literal('WORKSPACE'),workspace:z.enum(['TEACHER','CURATOR','DEAN_OFFICE','ADMIN','DEVELOPER','STAROSTA'])}).strict(),
  z.object({action:z.literal('REVOKE_SESSION'),sessionId:z.string().min(1).max(100)}).strict(),
  z.object({action:z.literal('REVOKE_ALL')}).strict(),
]);
export async function changeProfile(user:Principal,raw:unknown,tokenHash:string){
  const parsed=schema.safeParse(raw);if(!parsed.success)throw new HttpError(400,'Перевірте поля. Новий пароль: 10–128 символів.');
  const p=parsed.data;
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
    const actor=await tx.user.findUniqueOrThrow({where:{id:user.id},select:principalSelect});
    if(!actor.active||!await tx.session.findFirst({where:{userId:user.id,tokenHash,expiresAt:{gt:new Date()}}}))throw new HttpError(401,'Сеанс завершено.');
    if(actor.mustChangePassword&&p.action!=='PASSWORD')throw new HttpError(403,'Спочатку змініть тимчасовий пароль.');
    let details:Record<string,unknown>={action:p.action},destination:string|undefined;
    if(p.action==='PASSWORD'){
      const account=await tx.user.findUniqueOrThrow({where:{id:user.id},select:{passwordHash:true}});
      if(!await bcrypt.compare(p.currentPassword,account.passwordHash))throw new HttpError(400,'Поточний пароль неправильний.');
      if(p.currentPassword===p.newPassword)throw new HttpError(400,'Новий пароль має відрізнятися від поточного.');
      await tx.user.update({where:{id:user.id},data:{passwordHash:await bcrypt.hash(p.newPassword,12),mustChangePassword:false,passwordChangedAt:new Date()}});
      await tx.session.deleteMany({where:{userId:user.id,tokenHash:{not:tokenHash}}});
      destination=homeFor({...actor,mustChangePassword:false});
    }else if(p.action==='PROFILE'){
      if(!actor.roles.some(r=>['TEACHER','CURATOR','DEAN_OFFICE','ADMIN','DEVELOPER'].includes(r.roleId)))throw new HttpError(403,'Розширений профіль для цієї ролі недоступний.');
      const identity=teacherIdentity(p.name,p.position);
      await tx.user.update({where:{id:user.id},data:{name:identity.name,position:p.position}});
      if(actor.teacher)await tx.teacher.update({where:{id:actor.teacher.id},data:{displayName:identity.name,position:p.position}});
      details={...details,before:{name:actor.name,position:actor.position},after:{name:identity.name,position:p.position}};
    }else if(p.action==='WORKSPACE'){
      if(!hasRole(actor,p.workspace)||p.workspace==='TEACHER'&&(!actor.teacher||actor.teacher.retiredAt))throw new HttpError(403,'Це робоче місце недоступне.');
      await tx.user.update({where:{id:user.id},data:{workspace:p.workspace}});destination=homeFor({...actor,workspace:p.workspace});
      details={...details,before:actor.workspace,after:p.workspace};
    }else if(p.action==='REVOKE_SESSION'){
      const target=await tx.session.findFirst({where:{id:p.sessionId,userId:user.id}});
      if(!target)throw new HttpError(404,'Сеанс недоступний.');
      await tx.session.delete({where:{id:target.id}});details={...details,sessionId:target.id};
      if(target.tokenHash===tokenHash)destination='/login';
    }else{await tx.session.deleteMany({where:{userId:user.id}});destination='/login';}
    await tx.auditLog.create({data:{actorId:user.id,objectType:'User',objectId:user.id,source:p.action==='PASSWORD'?'PASSWORD_CHANGE':'PROFILE',details:JSON.parse(JSON.stringify(details))}});
    return {ok:true,destination};
  },{timeout:15000});
}
