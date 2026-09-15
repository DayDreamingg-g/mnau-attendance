import {randomBytes,createHash} from 'node:crypto';
import {isIP} from 'node:net';
import bcrypt from 'bcryptjs';
import {db} from './db';
import {HttpError} from './errors';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function loginSource(request:Request){
  // Trust Railway ingress only in its configured service. Local requests ignore these headers.
  if(process.env.RAILWAY_SERVICE_ID&&process.env.APP_ORIGIN==='https://mnau-attendance.up.railway.app'){
    const value=request.headers.get('x-real-ip')?.trim()??'';
    return isIP(value)?value:'railway-unknown';
  }
  return 'local-network';
}
export function deviceLabel(agent:string){
  const browser=/Edg\//.test(agent)?'Edge':/Firefox\//.test(agent)?'Firefox':/Chrome\//.test(agent)?'Chrome':/Safari\//.test(agent)?'Safari':'Браузер';
  const os=/Android/.test(agent)?'Android':/iPhone|iPad/.test(agent)?'iOS':/Windows/.test(agent)?'Windows':/Macintosh/.test(agent)?'macOS':/Linux/.test(agent)?'Linux':'Пристрій';
  return `${browser} · ${os}`;
}
const dummyHash=bcrypt.hashSync('invalid-password-placeholder',12);
const setting=(name:string,fallback:number,min:number,max:number)=>Math.max(min,Math.min(max,Number(process.env[name])||fallback));
export async function login(email:string,password:string,source='local-network',agent=''){
  email=email.trim().toLowerCase();
  const key='login:pair:'+digest(source+'\0'+email),ipKey='login:ip:'+digest(source);
  const outcome=await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ipKey}))::text`;
    const now=new Date(),keys=[key,ipKey];
    for(const k of keys)await tx.loginBucket.upsert({where:{key:k},create:{key:k,resetAt:new Date(now.getTime()+(k===key?86400000:900000))},update:{}});
    const buckets=await tx.loginBucket.findMany({where:{key:{in:keys}}});
    const until=Math.max(...buckets.map(b=>b.blockedUntil?.getTime()??0));
    if(until>now.getTime())return {status:429,retry:Math.ceil((until-now.getTime())/1000)};
    const user=await tx.user.findUnique({where:{email},select:{id:true,active:true,passwordHash:true}});
    const valid=await bcrypt.compare(password,user?.passwordHash??dummyHash);
    if(!user?.active||!valid){
      let cooldown=0;
      for(const bucket of buckets){
        const expired=bucket.resetAt<=now,attempts=(expired?0:bucket.attempts)+1;
        const threshold=bucket.key===key?setting('LOGIN_FAILURE_THRESHOLD',5,3,20):setting('LOGIN_IP_THRESHOLD',100,30,1000);
        const strikes=(expired?0:bucket.strikes)+(attempts>=threshold?1:0);
        const minutes=attempts>=threshold?Math.min(60,2**Math.min(6,strikes-1)):0;
        await tx.loginBucket.update({where:{key:bucket.key},data:{attempts:minutes?0:attempts,strikes,blockedUntil:minutes?new Date(now.getTime()+minutes*60000):null,resetAt:expired?new Date(now.getTime()+(bucket.key===key?86400000:900000)):bucket.resetAt}});
        cooldown=Math.max(cooldown,minutes*60);
      }
      await tx.auditLog.create({data:{objectType:'Login',objectId:key,source:cooldown?'LOGIN_COOLDOWN':'LOGIN_FAILED',details:{sourceHash:digest(source),cooldownSeconds:cooldown}}});
      return {status:cooldown?429:401,retry:cooldown};
    }
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
    const current=await tx.user.findUnique({where:{id:user.id},select:{active:true,passwordHash:true}});
    if(!current?.active||current.passwordHash!==user.passwordHash)return {status:401,retry:0};
    await tx.loginBucket.update({where:{key},data:{attempts:0,strikes:0,blockedUntil:null}});
    const token=randomBytes(32).toString('hex');
    await tx.session.create({data:{userId:user.id,tokenHash:digest(token),expiresAt:new Date(Date.now()+30*86400000),device:deviceLabel(agent)}});
    await tx.auditLog.create({data:{actorId:user.id,objectType:'User',objectId:user.id,source:'LOGIN_SUCCESS',details:{device:deviceLabel(agent)}}});
    return {status:200,retry:0,token};
  },{timeout:15000,maxWait:10000});
  if(outcome.status!==200)throw new HttpError(outcome.status,outcome.status===429?'Забагато спроб. Повторіть пізніше.':'Невірна електронна пошта або пароль.',outcome.retry);
  return outcome.token!;
}
