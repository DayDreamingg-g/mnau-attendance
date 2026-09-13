import { randomBytes,createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { HttpError } from './errors';
import { demoEnabled } from './time';
export const COOKIE='mnau_session';
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export const principalSelect={id:true,name:true,email:true,active:true,roles:{select:{roleId:true}},teacher:{select:{id:true}},student:{select:{id:true,groupId:true}},starostaAssignments:{select:{groupId:true}},curatorAssignments:{select:{groupId:true}},deanAssignments:{select:{facultyId:true}}} as const;
export async function principalFromToken(token:string|undefined) {
  if(!token || !/^[a-f0-9]{64}$/.test(token))return null;
  const session=await db.session.findUnique({where:{tokenHash:hashToken(token)},select:{expiresAt:true,user:{select:principalSelect}}});
  if(!session || session.expiresAt<=new Date() || !session.user.active)return null;
  return session.user;
}
export type Principal=NonNullable<Awaited<ReturnType<typeof principalFromToken>>>;
export async function currentUser(){return principalFromToken((await cookies()).get(COOKIE)?.value);}
export async function requireUser(){const user=await currentUser();if(!user)redirect('/login');return user;}
export async function requireApi(){const user=await currentUser();if(!user)throw new HttpError(401,'Увійдіть до системи.');return user;}
export function hasRole(user:Principal,role:string){return user.roles.some(r=>r.roleId===role);}
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
async function consumeBucket(key:string,limit:number,seconds:number){
  const now=new Date(),resetAt=new Date(now.getTime()+seconds*1000);
  const rows=await db.$queryRaw<{attempts:number}[]>`INSERT INTO "LoginBucket" ("key","attempts","resetAt") VALUES (${key},1,${resetAt}) ON CONFLICT ("key") DO UPDATE SET "attempts"=CASE WHEN "LoginBucket"."resetAt" <= ${now} THEN 1 ELSE "LoginBucket"."attempts"+1 END, "resetAt"=CASE WHEN "LoginBucket"."resetAt" <= ${now} THEN ${resetAt} ELSE "LoginBucket"."resetAt" END RETURNING "attempts"`;
  if(rows[0].attempts>limit)throw new HttpError(429,'Забагато спроб. Повторіть пізніше.');
}
const dummyHash=bcrypt.hashSync('invalid-password-placeholder',12);
export async function login(email:string,password:string){
  await consumeBucket('login:global',120,60);
  await consumeBucket('login:'+hashToken(email),8,900);
  const user=await db.user.findUnique({where:{email},select:{id:true,active:true,passwordHash:true}});
  const valid=await bcrypt.compare(password,user?.passwordHash??dummyHash);
  if(!user?.active || !valid)throw new HttpError(401,'Невірна електронна пошта або пароль.');
  const token=randomBytes(32).toString('hex');
  await db.session.create({data:{userId:user.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+30*24*60*60*1000)}});
  return token;
}
export async function logout(){const token=(await cookies()).get(COOKIE)?.value;if(token)await db.session.deleteMany({where:{tokenHash:hashToken(token)}});(await cookies()).delete(COOKIE);}
