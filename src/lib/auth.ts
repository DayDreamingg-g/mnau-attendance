import { createHash } from 'node:crypto';
export {login,loginSource} from './auth-login';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { HttpError } from './errors';
import { demoEnabled } from './time';
export const COOKIE='mnau_session';
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export const principalSelect={id:true,name:true,email:true,active:true,mustChangePassword:true,position:true,workspace:true,roles:{select:{roleId:true}},teacher:{select:{id:true,retiredAt:true}},student:{select:{id:true,groupId:true}},starostaAssignments:{select:{groupId:true}},curatorAssignments:{select:{groupId:true}},deanAssignments:{select:{facultyId:true}}} as const;
export async function principalFromToken(token:string|undefined) {
  if(!token || !/^[a-f0-9]{64}$/.test(token))return null;
  const session=await db.session.findUnique({where:{tokenHash:hashToken(token)},select:{id:true,lastSeenAt:true,expiresAt:true,user:{select:principalSelect}}});
  if(!session || session.expiresAt<=new Date() || !session.user.active)return null;
  if(Date.now()-session.lastSeenAt.getTime()>60000)await db.session.updateMany({where:{id:session.id},data:{lastSeenAt:new Date()}});
  if(session.user.teacher?.retiredAt)session.user.teacher=null;
  return session.user;
}
export type Principal=NonNullable<Awaited<ReturnType<typeof principalFromToken>>>;
export async function currentUser(){return principalFromToken((await cookies()).get(COOKIE)?.value);}
export async function requireUser(allowPasswordChange=false){const user=await currentUser();if(!user)redirect('/login');if(user.mustChangePassword&&!allowPasswordChange)redirect('/change-password');return user;}
export async function requireApi(allowPasswordChange=false){const user=await currentUser();if(!user)throw new HttpError(401,'Увійдіть до системи.');if(user.mustChangePassword&&!allowPasswordChange)throw new HttpError(403,'Спочатку змініть тимчасовий пароль.');return user;}
export function hasRole(user:Principal,role:string){return !(role==='TEACHER'&&user.teacher?.retiredAt)&&user.roles.some(r=>r.roleId===role);}
export function isManager(user:Principal){return hasRole(user,'ADMIN')||hasRole(user,'DEVELOPER');}
export function starostaGroups(user:Principal){return hasRole(user,'STAROSTA')?user.starostaAssignments.map(a=>a.groupId):[];}
export function cookieOptions(){
  const secure=process.env.COOKIE_SECURE==='true'||process.env.APP_ORIGIN?.startsWith('https://')===true;
  if(process.env.APP_ENV==='production' && (!secure || !process.env.APP_ORIGIN?.startsWith('https://')))throw new Error('Production requires HTTPS and secure cookies');
  demoEnabled();
  return {httpOnly:true,secure,sameSite:'lax' as const,path:'/',maxAge:60*60*24*30};
}
export function checkOrigin(request:Request){
  const allowed=process.env.APP_ORIGIN;
  if(!allowed || request.headers.get('origin')!==new URL(allowed).origin)throw new HttpError(403,'Походження запиту не дозволене.');
}
export async function logout(){const token=(await cookies()).get(COOKIE)?.value;if(token)await db.session.deleteMany({where:{tokenHash:hashToken(token)}});(await cookies()).delete(COOKIE);}

export function homeFor(user:Principal){
  if(user.mustChangePassword)return '/change-password';
  if(user.workspace&&hasRole(user,user.workspace)){
    if(user.workspace==='CURATOR')return '/curator';
    if(user.workspace==='STAROSTA')return '/starosta';
    if(user.workspace==='TEACHER'&&user.teacher&&!user.teacher.retiredAt)return '/teacher';
    if(['ADMIN','DEVELOPER'].includes(user.workspace))return '/admin';
  }
  return hasRole(user,'TEACHER')&&user.teacher&&!user.teacher.retiredAt?'/teacher':hasRole(user,'STAROSTA')?'/starosta':'/';
}
