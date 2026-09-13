import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {db} from '../../src/lib/db';
import {adminChange} from '../../src/lib/admin';
import {groupScope,requireReportFaculty} from '../../src/lib/access';
import {hashToken,principalFromToken,principalSelect,type Principal} from '../../src/lib/auth';
import {HttpError} from '../../src/lib/errors';

const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3001';
const origin=process.env.APP_ORIGIN??'http://localhost:3000';
const fixtureIds=[`admin-test-${randomUUID()}`,`admin-test-${randomUUID()}`];
const reason='Інтеграційна перевірка керування призначеннями';
let admin:Principal;
let groupId:string,facultyId:string,groupStudentName:string;
const principal=(id:string)=>db.user.findUniqueOrThrow({where:{id},select:principalSelect});
const body=(action:string,target:string,userId=fixtureIds[0])=>({userId,action,target,reason});
const change=(action:string,target:string,userId=fixtureIds[0])=>adminChange(admin,body(action,target,userId));
const rejected=(fn:()=>Promise<unknown>,status:number)=>assert.rejects(fn,e=>e instanceof HttpError&&e.status===status);
async function session(userId:string){
  const token=randomBytes(32).toString('hex');
  await db.session.create({data:{userId,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+3600000)}});
  return {token,cookie:`mnau_session=${token}`};
}
async function authenticated(token:string){const user=await principalFromToken(token);assert.ok(user);return user;}
async function post(payload:unknown,cookie?:string){
  return fetch(base+'/api/admin/assignments',{method:'POST',headers:{origin,'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(payload)});
}
async function assertGroupAccess(cookie:string,allowed:boolean){
  const response=await fetch(base+`/groups/${groupId}`,{headers:{cookie},redirect:'manual'});
  const html=await response.text();
  if(allowed){assert.equal(response.status,200);assert.ok(html.includes(groupStudentName),'Scoped student must be visible');}
  else{
    assert.ok(!html.includes(groupStudentName),'A revoked scope must not expose students');
    // App Router may send its shell before notFound() resolves; verify the actual 404 UI too.
    assert.ok(response.status===404||html.includes('Сторінка недоступна'),'Expected inaccessible page');
  }
}
async function lessonStatus(cookie:string,id:string){return (await fetch(base+`/api/lessons/${id}`,{headers:{cookie},redirect:'manual'})).status;}

before(async()=>{
  admin=await db.user.findUniqueOrThrow({where:{email:'admin@test.com'},select:principalSelect});
  const group=await db.group.findFirstOrThrow({where:{specialty:{facultyId:'faculty-management'}},include:{specialty:true},orderBy:{id:'asc'}});
  groupId=group.id;facultyId=group.specialty.facultyId;
  groupStudentName=(await db.student.findFirstOrThrow({where:{groupId},orderBy:{id:'asc'}})).fullName;
  const passwordHash=(await db.user.findUniqueOrThrow({where:{id:admin.id},select:{passwordHash:true}})).passwordHash;
  for(const id of fixtureIds)await db.user.create({data:{id,email:`${id}@test.invalid`,name:'Тест призначень',passwordHash}});
});
after(async()=>{
  // Only test-created accounts are removed; all source profiles remain intact.
  await db.teacher.updateMany({where:{userId:{in:fixtureIds}},data:{userId:null}});
  await db.student.updateMany({where:{userId:{in:fixtureIds}},data:{userId:null}});
  await db.auditLog.deleteMany({where:{OR:[{actorId:{in:fixtureIds}},{objectType:'UserAssignment',objectId:{in:fixtureIds}}]}});
  await db.session.deleteMany({where:{userId:{in:fixtureIds}}});
  await db.userRole.deleteMany({where:{userId:{in:fixtureIds}}});
  await db.curatorAssignment.deleteMany({where:{userId:{in:fixtureIds}}});
  await db.deanAssignment.deleteMany({where:{userId:{in:fixtureIds}}});
  await db.starostaAssignment.deleteMany({where:{userId:{in:fixtureIds}}});
  await db.user.deleteMany({where:{id:{in:fixtureIds}}});
  await db.$disconnect();
});

test('administration requires a server-side active ADMIN, including direct API requests',async()=>{
  const payload=body('ADD_ROLE','ADMIN');
  assert.equal((await post(payload)).status,401);
  const auditBefore=await db.auditLog.count({where:{objectType:'UserAssignment'}});
  for(const email of ['dean@test.com','curator@test.com','teacher@test.com','starosta@test.com']){
    const actor=await db.user.findUniqueOrThrow({where:{email},select:principalSelect});
    await rejected(()=>adminChange(actor,payload),403);
    const auth=await session(actor.id);
    assert.equal((await post(payload,auth.cookie)).status,403,email);
    await db.session.deleteMany({where:{tokenHash:hashToken(auth.token)}});
  }
  assert.equal(await db.userRole.count({where:{userId:fixtureIds[0]}}),0);
  assert.equal(await db.auditLog.count({where:{objectType:'UserAssignment'}}),auditBefore);
});

test('assignment validation and self-admin protection fail without mutations',async()=>{
  await rejected(()=>adminChange(admin,{...body('ADD_ROLE','CURATOR'),reason:'x'}),400);
  await rejected(()=>change('ADD_ROLE','UNKNOWN'),400);
  await rejected(()=>change('ASSIGN_CURATOR','missing-group'),404);
  await rejected(()=>change('ASSIGN_DEAN','missing-faculty'),404);
  await rejected(()=>change('ASSIGN_TEACHER','missing-teacher'),404);
  await rejected(()=>change('ASSIGN_STAROSTA','missing-student'),404);
  await rejected(()=>change('ADD_ROLE','CURATOR','missing-user'),404);
  await rejected(()=>change('REMOVE_ROLE','ADMIN',admin.id),403);
  assert.ok((await principal(admin.id)).roles.some(r=>r.roleId==='ADMIN'));
  assert.equal(await db.auditLog.count({where:{objectType:'UserAssignment',objectId:fixtureIds[0]}}),0);
});

test('curator add/remove and role revocation immediately change an existing session scope',async()=>{
  const auth=await session(fixtureIds[0]);
  await change('ADD_ROLE','CURATOR');
  assert.equal(await db.group.count({where:groupScope(await authenticated(auth.token))}),0);
  await change('ASSIGN_CURATOR',groupId);
  await assertGroupAccess(auth.cookie,true);
  await change('REMOVE_ROLE','CURATOR');
  assert.equal(await db.curatorAssignment.count({where:{userId:fixtureIds[0],groupId}}),1);
  await assertGroupAccess(auth.cookie,false);
  await change('ADD_ROLE','CURATOR');
  await assertGroupAccess(auth.cookie,true);
  await change('REMOVE_CURATOR',groupId);
  await assertGroupAccess(auth.cookie,false);
  assert.equal(await db.group.count({where:groupScope(await authenticated(auth.token))}),0);
  await change('REMOVE_ROLE','CURATOR');
});

test('dean scopes add/remove symmetrically and require both role and faculty assignment',async()=>{
  const auth=await session(fixtureIds[0]);
  await change('ADD_ROLE','DEAN_OFFICE');
  await change('ASSIGN_DEAN',facultyId);
  requireReportFaculty(await authenticated(auth.token),facultyId);
  await assertGroupAccess(auth.cookie,true);
  await change('REMOVE_DEAN',facultyId);
  assert.throws(()=>requireReportFaculty({...admin,roles:[{roleId:'DEAN_OFFICE'}],deanAssignments:[]},facultyId),e=>e instanceof HttpError&&e.status===403);
  await rejected(async()=>requireReportFaculty(await authenticated(auth.token),facultyId),403);
  await assertGroupAccess(auth.cookie,false);
  assert.equal(await db.deanAssignment.count({where:{userId:fixtureIds[0],facultyId}}),0);
  await change('REMOVE_ROLE','DEAN_OFFICE');
});

test('global ADMIN is grantable and revocable, and stale principals cannot retain it',async()=>{
  const auth=await session(fixtureIds[0]);
  await change('ADD_ROLE','ADMIN');
  const stale=await authenticated(auth.token);
  assert.equal((await post(body('ADD_ROLE','CURATOR',fixtureIds[1]),auth.cookie)).status,200);
  assert.ok(await db.group.count({where:groupScope(stale)}));
  await change('REMOVE_ROLE','ADMIN');
  assert.equal((await post(body('ADD_ROLE','ADMIN',fixtureIds[1]),auth.cookie)).status,403);
  await rejected(()=>adminChange(stale,body('ADD_ROLE','ADMIN',fixtureIds[1])),403);
  await change('REMOVE_ROLE','CURATOR',fixtureIds[1]);
  await change('ADD_ROLE','ADMIN');
  const inactive=await principal(fixtureIds[0]);
  await db.user.update({where:{id:fixtureIds[0]},data:{active:false}});
  try{await rejected(()=>adminChange(inactive,body('ADD_ROLE','ADMIN',fixtureIds[1])),403);assert.equal(await principalFromToken(auth.token),null);}
  finally{await db.user.update({where:{id:fixtureIds[0]},data:{active:true}});await change('REMOVE_ROLE','ADMIN');}
});

test('teacher profile attach/detach preserves source and lessons, blocks ownership tampering, and revokes API access',async()=>{
  const owner=await db.user.findUniqueOrThrow({where:{email:'teacher@test.com'},select:principalSelect});
  const teacherId=owner.teacher!.id;
  const original=await db.teacher.findUniqueOrThrow({where:{id:teacherId}});
  const lesson=await db.lesson.findFirstOrThrow({where:{teacherId},orderBy:{startAt:'desc'}});
  const spare=await db.teacher.findFirstOrThrow({where:{userId:null,id:{not:teacherId}}});
  const lessonIds=(await db.lesson.findMany({where:{teacherId},select:{id:true},orderBy:{id:'asc'}})).map(l=>l.id);
  const attendanceBefore=await db.attendance.findMany({where:{lessonId:{in:lessonIds}},orderBy:[{lessonId:'asc'},{studentId:'asc'}]});
  const auth=await session(fixtureIds[0]);
  await change('REMOVE_TEACHER',teacherId,owner.id);
  try{
    await change('ADD_ROLE','TEACHER');
    await change('ASSIGN_TEACHER',teacherId);
    assert.equal(await lessonStatus(auth.cookie,lesson.id),200);
    await rejected(()=>change('REMOVE_TEACHER',teacherId,fixtureIds[1]),409);
    await rejected(()=>change('ASSIGN_TEACHER',teacherId,fixtureIds[1]),409);
    await rejected(()=>change('ASSIGN_TEACHER',spare.id),409);
    await change('REMOVE_ROLE','TEACHER');
    assert.equal((await db.teacher.findUniqueOrThrow({where:{id:teacherId}})).userId,fixtureIds[0]);
    assert.equal(await lessonStatus(auth.cookie,lesson.id),404);
    await change('ADD_ROLE','TEACHER');
    await change('REMOVE_TEACHER',teacherId);
    assert.equal(await lessonStatus(auth.cookie,lesson.id),404);
    assert.equal((await authenticated(auth.token)).teacher,null);
    assert.deepEqual(await db.teacher.findUniqueOrThrow({where:{id:teacherId}}),{...original,userId:null});
    assert.deepEqual((await db.lesson.findMany({where:{teacherId},select:{id:true},orderBy:{id:'asc'}})).map(l=>l.id),lessonIds);
    assert.deepEqual(await db.attendance.findMany({where:{lessonId:{in:lessonIds}},orderBy:[{lessonId:'asc'},{studentId:'asc'}]}),attendanceBefore);
  }finally{
    await db.teacher.update({where:{id:teacherId},data:{userId:owner.id}});
    await change('REMOVE_ROLE','TEACHER');
  }
});

test('starosta group assignment needs no fictitious student and revokes immediately',async()=>{
  const auth=await session(fixtureIds[0]);
  const lesson=await db.lesson.findFirstOrThrow({where:{starostaAllowed:true,groups:{some:{groupId}}}});
  await change('ADD_ROLE','STAROSTA');
  await change('ASSIGN_STAROSTA',groupId);
  await change('ASSIGN_STAROSTA',groupId);
  assert.equal(await db.starostaAssignment.count({where:{userId:fixtureIds[0],groupId}}),1);
  assert.equal((await authenticated(auth.token)).student,null);
  assert.equal(await lessonStatus(auth.cookie,lesson.id),200);
  await change('REMOVE_ROLE','STAROSTA');
  assert.equal(await lessonStatus(auth.cookie,lesson.id),404);
  await change('ADD_ROLE','STAROSTA');
  await change('REMOVE_STAROSTA',groupId);
  assert.equal(await lessonStatus(auth.cookie,lesson.id),404);
  await change('REMOVE_ROLE','STAROSTA');
});

test('assignment audit captures before/after atomically and repeat additions do not duplicate changes',async()=>{
  const auditBefore=await db.auditLog.count({where:{objectType:'UserAssignment',objectId:fixtureIds[0]}});
  const previousRoles=(await principal(fixtureIds[0])).roles.map(r=>r.roleId).sort();
  const first=await change('ADD_ROLE','CURATOR');
  const second=await change('ADD_ROLE','CURATOR');
  assert.equal(first.changed,true);assert.equal(second.changed,false);
  const audits=await db.auditLog.findMany({where:{objectType:'UserAssignment',objectId:fixtureIds[0]},orderBy:{createdAt:'desc'}});
  assert.equal(audits.length,auditBefore+1);
  const audit=audits[0];
  assert.equal(audit.actorId,admin.id);assert.equal(audit.reason,reason);assert.equal(audit.source,'ADMIN');
  const details=audit.details as {action:string;before:{roles:string[]};after:{roles:string[]}};
  assert.equal(details.action,'ADD_ROLE');assert.deepEqual(details.before.roles,previousRoles);assert.deepEqual(details.after.roles,[...previousRoles,'CURATOR'].sort());
  assert.doesNotMatch(JSON.stringify(details),/passwordHash|tokenHash/);
  await change('REMOVE_ROLE','CURATOR');
});

test('admin can revoke all target sessions without touching another account',async()=>{
  const first=await session(fixtureIds[0]),second=await session(fixtureIds[0]),other=await session(fixtureIds[1]);
  await rejected(()=>change('REVOKE_SESSIONS','wrong-target'),400);
  assert.ok(await principalFromToken(first.token));
  await change('REVOKE_SESSIONS','sessions');
  assert.equal(await principalFromToken(first.token),null);assert.equal(await principalFromToken(second.token),null);
  assert.ok(await principalFromToken(other.token));
  assert.equal((await post(body('ADD_ROLE','CURATOR'),first.cookie)).status,401);
});
