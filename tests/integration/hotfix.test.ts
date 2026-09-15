import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {db} from '../../src/lib/db';
import {principalSelect,hashToken,type Principal} from '../../src/lib/auth';
import {adminRelease} from '../../src/lib/admin-release';
import type {RoleCode} from '../../src/generated/prisma/client';
const base=process.env.TEST_BASE_URL!,origin=process.env.APP_ORIGIN!;
const people=new Map<RoleCode,Principal>();
const reason='Ізольована перевірка видалення відгуку';
async function session(userId:string){const token=randomBytes(32).toString('hex');const s=await db.session.create({data:{userId,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+3600000),device:'Hotfix fixture'}});return {cookie:'mnau_session='+token,id:s.id};}
async function post(path:string,body:unknown,cookie:string){return fetch(base+path,{method:'POST',headers:{origin,cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});}
async function fixture(){const u=people.get('TEACHER')!;return db.feedback.create({data:{userId:u.id,roles:['TEACHER'],page:'/profile',text:'Hotfix feedback '+randomUUID()}});}
before(async()=>{
  for(const roleId of ['ADMIN','DEVELOPER','TEACHER','CURATOR','DEAN_OFFICE','STAROSTA'] as RoleCode[]){
    const id=randomUUID();people.set(roleId,await db.user.create({data:{id,email:id+'@example.invalid',name:'Hotfix '+roleId,passwordHash:'disabled',mustChangePassword:false,roles:{create:{roleId}}},select:principalSelect}));
  }
});
after(async()=>{await db.$disconnect();});

test('feedback delete HTTP RBAC denies teacher, curator, dean and starosta without any mutation',async()=>{
  const feedback=await fixture();
  for(const role of ['TEACHER','CURATOR','DEAN_OFFICE','STAROSTA'] as RoleCode[]){
    const auth=await session(people.get(role)!.id);
    const r=await post('/api/admin/release',{action:'FEEDBACK_DELETE',id:feedback.id,confirm:true,reason},auth.cookie);assert.equal(r.status,403,role);
    const hidden=await fetch(base+'/admin/feedback?deleted=1',{headers:{cookie:auth.cookie}});assert.ok(!(await hidden.text()).includes(feedback.text));
  }
  assert.deepEqual(await db.feedback.findUniqueOrThrow({where:{id:feedback.id}}),feedback);
  assert.equal(await db.auditLog.count({where:{objectId:feedback.id}}),0);
});
for(const role of ['ADMIN','DEVELOPER'] as const)test(role+' can soft-delete with confirmation, retained content, audit and explicit inbox visibility',async()=>{
  const actor=people.get(role)!,auth=await session(actor.id),feedback=await fixture();
  for(const payload of [{confirm:false,reason},{confirm:true,reason:'  '}])assert.equal((await post('/api/admin/release',{action:'FEEDBACK_DELETE',id:feedback.id,...payload},auth.cookie)).status,400);
  assert.equal((await post('/api/admin/release',{action:'FEEDBACK_STATE',id:feedback.id,state:'IN_PROGRESS'},auth.cookie)).status,200);
  assert.equal((await post('/api/admin/release',{action:'FEEDBACK_DELETE',id:feedback.id,confirm:true,reason},auth.cookie)).status,200);
  const deleted=await db.feedback.findUniqueOrThrow({where:{id:feedback.id}});
  assert.ok(deleted.deletedAt);assert.equal(deleted.deletedById,actor.id);assert.equal(deleted.deleteReason,reason);
  assert.equal(deleted.text,feedback.text);assert.equal(deleted.userId,feedback.userId);assert.equal(deleted.state,'IN_PROGRESS');
  const audit=await db.auditLog.findFirstOrThrow({where:{source:'ADMIN_FEEDBACK_DELETE',objectId:feedback.id}});
  assert.equal(audit.actorId,actor.id);assert.equal(audit.reason,reason);assert.equal(audit.objectType,'Feedback');
  assert.deepEqual(audit.details,{action:'FEEDBACK_DELETE',id:feedback.id,confirm:true,reason,before:'IN_PROGRESS',deletedAt:deleted.deletedAt.toISOString(),deletedById:actor.id});
  const normal=await fetch(base+'/admin/feedback',{headers:{cookie:auth.cookie}});assert.ok(!(await normal.text()).includes(feedback.text));
  const all=await fetch(base+'/admin/feedback?deleted=1&state=IN_PROGRESS',{headers:{cookie:auth.cookie}});assert.ok((await all.text()).includes(feedback.text));
  assert.equal((await post('/api/admin/release',{action:'FEEDBACK_STATE',id:feedback.id,state:'RESOLVED'},auth.cookie)).status,409);
  assert.equal((await post('/api/admin/release',{action:'FEEDBACK_DELETE',id:feedback.id,confirm:true,reason},auth.cookie)).status,409);
  assert.equal(await db.auditLog.count({where:{source:'ADMIN_FEEDBACK_DELETE',objectId:feedback.id}}),1);
});
test('feedback delete rechecks current database roles even if passed a stale administrative principal',async()=>{
  const actor=people.get('TEACHER')!,feedback=await fixture();
  await assert.rejects(()=>adminRelease({...actor,roles:[{roleId:'ADMIN'}]},{action:'FEEDBACK_DELETE',id:feedback.id,confirm:true,reason}),e=>e instanceof Error&&'status' in e&&e.status===403);
  assert.equal((await db.feedback.findUniqueOrThrow({where:{id:feedback.id}})).deletedAt,null);
});
test('revoking another session keeps the current cookie; revoking current/all clears it and protects profile',async()=>{
  const user=people.get('CURATOR')!;
  for(const all of [false,true]){
    const current=await session(user.id),other=await session(user.id);
    const otherResult=await post('/api/profile',{action:'REVOKE_SESSION',sessionId:other.id},current.cookie);
    assert.equal(otherResult.status,200);assert.equal(otherResult.headers.get('set-cookie'),null);
    assert.ok(await db.session.findUnique({where:{id:current.id}}));
    const extra=await session(user.id);
    const response=await post('/api/profile',all?{action:'REVOKE_ALL'}:{action:'REVOKE_SESSION',sessionId:current.id},current.cookie);
    assert.equal(response.status,200);assert.equal((await response.json()).destination,'/login');
    assert.match(response.headers.get('set-cookie')??'',/mnau_session=;.*(?:expires=Thu, 01 Jan 1970|Max-Age=0)/i);
    assert.equal(await db.session.findUnique({where:{id:current.id}}),null);
    assert.equal(Boolean(await db.session.findUnique({where:{id:extra.id}})),!all);
    for(const cookie of ['',current.cookie]){const page=await fetch(base+'/profile',{headers:{cookie},redirect:'manual'});assert.ok([303,307].includes(page.status));assert.match(page.headers.get('location')??'',/\/login$/);}
    assert.equal((await post('/api/profile',{action:'REVOKE_ALL'},current.cookie)).status,401);
    const logout=await post('/api/auth/logout',{},current.cookie);assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie')??'',/mnau_session=;/);
  }
});
test('concurrent revoke requests finish safely without an authenticated profile remaining',async()=>{
  const user=people.get('CURATOR')!,auth=await session(user.id);
  const responses=await Promise.all([post('/api/profile',{action:'REVOKE_ALL'},auth.cookie),post('/api/profile',{action:'REVOKE_ALL'},auth.cookie)]);
  assert.ok(responses.some(r=>r.status===200));assert.ok(responses.every(r=>r.status===200||r.status===401));
  assert.equal(await db.session.count({where:{userId:user.id}}),0);
});
