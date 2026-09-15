import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {db} from '../../src/lib/db';
import {journal,saveJournal,type JournalInput} from '../../src/lib/journal';
import {principalSelect,hashToken} from '../../src/lib/auth';
import {HttpError} from '../../src/lib/errors';
import {atKyiv,today} from '../../src/lib/time';

const p=(id:string)=>db.user.findUniqueOrThrow({where:{id},select:principalSelect});
const rejected=(fn:()=>Promise<unknown>,status:number)=>assert.rejects(fn,error=>error instanceof HttpError&&error.status===status);
const request=(version:number,studentId:string,status:'PRESENT'|'N'|'HV'|null='N',mode:JournalInput['mode']='CONFIRM'):JournalInput=>({version,requestId:randomUUID(),mode,rows:[{studentId,status}]});
async function fixture(){
  const key=randomUUID();
  const template=await db.lesson.findUniqueOrThrow({where:{id:'demo-joint-kn3'},include:{roster:{include:{student:true}},groups:true,teacher:true}});
  assert.equal(template.groups.length,2,'Seed must retain source-backed joint lesson');
  const [groupA,groupB]=template.groups.map(group=>group.groupId);
  // Test roster members are synthetic fixtures in existing, source-confirmed groups.
  const studentA=await db.student.create({data:{id:`journal-a-${key}`,fullName:'Тест журналу А',groupId:groupA}});
  const studentB=await db.student.create({data:{id:`journal-b-${key}`,fullName:'Тест журналу Б',groupId:groupB}});
  const actor=await db.user.create({data:{email:`journal-${key}@test.com`,name:'Тестовий староста',mustChangePassword:false,passwordHash:'not-a-login-credential',roles:{create:{roleId:'STAROSTA'}},starostaAssignments:{create:{groupId:groupB}},student:{connect:{id:studentB.id}}},select:principalSelect});
  const lesson=await db.lesson.create({data:{id:`journal-${key}`,startAt:atKyiv(today(),'08:30'),endAt:atKyiv(today(),'09:50'),pairNumber:1,subjectId:template.subjectId,teacherId:template.teacherId,buildingId:template.buildingId,room:template.room,bellId:template.bellId,sourceId:template.sourceId,synthetic:true,kind:'Ізольована перевірка журналу',groups:{create:[{groupId:groupA},{groupId:groupB}]},roster:{create:[{studentId:studentA.id},{studentId:studentB.id}]}}});
  const teacher=await p(template.teacher!.userId!);
  return {actor,teacher,lesson,studentA,studentB,groupA,groupB};
}
after(async()=>{await db.$disconnect();});

test('AUTO submission saves curator and own starosta scope atomically',async()=>{
  const f=await fixture();
  await db.userRole.create({data:{userId:f.actor.id,roleId:'CURATOR'}});
  await db.curatorAssignment.create({data:{userId:f.actor.id,groupId:f.groupA}});
  const actor=await p(f.actor.id);
  const current=await journal(actor,f.lesson.id);
  assert.deepEqual(new Set(current.rows.map(row=>row.id)),new Set([f.studentA.id,f.studentB.id]));
  const result=await saveJournal(actor,f.lesson.id,{version:current.lesson.version,requestId:randomUUID(),mode:'AUTO',rows:[{studentId:f.studentA.id,status:'PRESENT'},{studentId:f.studentB.id,status:'N'}]});
  assert.equal(result.rows.find(row=>row.id===f.studentA.id)?.confirmed,true);
  assert.equal(result.rows.find(row=>row.id===f.studentB.id)?.confirmed,true);
  assert.equal(await db.auditLog.count({where:{lessonId:f.lesson.id}}),2);
  const state=await journal(f.actor,f.lesson.id);
  await saveJournal(f.actor,f.lesson.id,request(state.lesson.version,f.studentB.id,'PRESENT','CONFIRM'));
});

test('draft replay after teacher confirmation returns current state without overwriting',async()=>{
  const f=await fixture();
  const draft=request(0,f.studentB.id,'N','DRAFT');
  const saved=await saveJournal(f.actor,f.lesson.id,draft);
  await saveJournal(f.teacher,f.lesson.id,request(saved.version,f.studentB.id,'HV'));
  const count=await db.auditLog.count({where:{lessonId:f.lesson.id}});
  const replay=await saveJournal(f.actor,f.lesson.id,draft);
  assert.equal(replay.replayed,true);assert.equal(replay.submittedVersion,saved.version);
  assert.equal(replay.rows[0].status,'HV');assert.equal(replay.rows[0].confirmed,true);assert.equal(replay.rows[0].editable,true);
  assert.equal(await db.auditLog.count({where:{lessonId:f.lesson.id}}),count);
});

test('simultaneous identical requests replay once; mismatched key and stale version conflict',async()=>{
  const f=await fixture();const submission=request(0,f.studentA.id);
  const results=await Promise.all([saveJournal(f.teacher,f.lesson.id,submission),saveJournal(f.teacher,f.lesson.id,submission)]);
  assert.deepEqual(results.map(result=>result.replayed).sort(),[false,true]);
  assert.equal(await db.auditLog.count({where:{lessonId:f.lesson.id}}),1);
  assert.equal((await journal(f.teacher,f.lesson.id)).lesson.version,1);
  await rejected(()=>saveJournal(f.teacher,f.lesson.id,{...submission,rows:[{studentId:f.studentA.id,status:'HV'}]}),409);
  await rejected(()=>saveJournal(f.teacher,f.lesson.id,request(0,f.studentA.id,'HV')),409);
});

test('write refreshes assignments and inactive-account permissions instead of trusting UI principal',async()=>{
  const f=await fixture();
  await db.userRole.create({data:{userId:f.actor.id,roleId:'CURATOR'}});
  await db.curatorAssignment.create({data:{userId:f.actor.id,groupId:f.groupA}});
  const stale=await p(f.actor.id);
  await db.curatorAssignment.delete({where:{userId_groupId:{userId:f.actor.id,groupId:f.groupA}}});
  await rejected(()=>saveJournal(stale,f.lesson.id,request(0,f.studentA.id)),403);
  assert.equal((await db.lesson.findUniqueOrThrow({where:{id:f.lesson.id}})).version,0);
  await db.user.update({where:{id:f.actor.id},data:{active:false}});
  await rejected(()=>saveJournal(stale,f.lesson.id,request(0,f.studentB.id,'N','DRAFT')),401);
});

test('starosta API hides other group rows and rejects forged roster writes and confirmation',async()=>{
  const f=await fixture();
  const token=randomBytes(32).toString('hex');
  await db.session.create({data:{userId:f.actor.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+60000)}});
  const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3001';
  const headers={cookie:`mnau_session=${token}`,origin:process.env.APP_ORIGIN??'http://localhost:3000','Content-Type':'application/json'};
  const response=await fetch(`${base}/api/lessons/${f.lesson.id}`,{headers});assert.equal(response.status,200);
  const body=await response.json();assert.deepEqual(body.rows.map((row:{id:string})=>row.id),[f.studentB.id]);
  for(const submission of [request(0,f.studentA.id,'N','DRAFT'),request(0,f.studentA.id,'N','CONFIRM')]){
    const result=await fetch(`${base}/api/lessons/${f.lesson.id}`,{method:'POST',headers,body:JSON.stringify(submission)});assert.equal(result.status,403);
  }
  assert.equal(await db.attendance.count({where:{lessonId:f.lesson.id}}),0);
});

test('shared lesson confirmation never blocks the other group; clearing a row reopens only that row',async()=>{
  const f=await fixture();
  const first=await db.user.create({data:{email:`first-${randomUUID()}@test.com`,name:'Староста першої групи',mustChangePassword:false,passwordHash:'not-a-login-credential',roles:{create:{roleId:'STAROSTA'}},starostaAssignments:{create:{groupId:f.groupA}},student:{connect:{id:f.studentA.id}}},select:principalSelect});
  const draftA=await saveJournal(first,f.lesson.id,request(0,f.studentA.id,'PRESENT','DRAFT'));
  await saveJournal(f.teacher,f.lesson.id,request(draftA.version,f.studentA.id,'PRESENT'));
  const groupA=await journal(first,f.lesson.id),groupB=await journal(f.actor,f.lesson.id);
  assert.equal(groupA.rows[0].confirmed,true);assert.equal(groupA.rows[0].editable,true);
  assert.equal(groupB.lesson.journalState,'DRAFT');assert.equal(groupB.rows[0].status,null);assert.equal(groupB.rows[0].editable,true);
  await rejected(()=>saveJournal(f.actor,f.lesson.id,request(groupB.lesson.version,f.studentA.id,'HV','DRAFT')),403);
  const draftB=await saveJournal(f.actor,f.lesson.id,request(groupB.lesson.version,f.studentB.id,'N','DRAFT'));
  const teacher=await journal(f.teacher,f.lesson.id);assert.equal(teacher.lesson.journalState,'CONFIRMED');
  const completed=await saveJournal(f.teacher,f.lesson.id,request(draftB.version,f.studentB.id,'N'));
  assert.equal((await journal(f.actor,f.lesson.id)).lesson.journalState,'CONFIRMED');
  const cleared=await saveJournal(f.teacher,f.lesson.id,request(completed.version,f.studentB.id,null));
  assert.equal((await journal(f.actor,f.lesson.id)).lesson.journalState,'DRAFT');
  assert.equal((await journal(f.actor,f.lesson.id)).rows[0].editable,true);
  assert.equal((await journal(first,f.lesson.id)).rows[0].editable,true);
  await saveJournal(f.teacher,f.lesson.id,request(cleared.version,f.studentA.id,null));
  assert.equal((await journal(f.teacher,f.lesson.id)).lesson.journalState,'EMPTY');
});

test('legacy CONFIRMED state with missing roster does not prevent the second starosta from drafting',async()=>{
  const f=await fixture();
  await db.attendance.create({data:{lessonId:f.lesson.id,studentId:f.studentA.id,statusCode:'PRESENT',confirmed:true}});
  await db.lesson.update({where:{id:f.lesson.id},data:{journalState:'CONFIRMED'}});
  const state=await journal(f.actor,f.lesson.id);
  assert.equal(state.lesson.journalState,'DRAFT');assert.equal(state.rows[0].editable,true);
  await saveJournal(f.actor,f.lesson.id,request(state.lesson.version,f.studentB.id,'N','DRAFT'));
  assert.equal((await db.lesson.findUniqueOrThrow({where:{id:f.lesson.id}})).journalState,'CONFIRMED');
});

test('different group editors keep optimistic locking and can retry against the new version',async()=>{
  const f=await fixture();
  const first=await db.user.create({data:{email:`parallel-${randomUUID()}@test.com`,name:'Староста першої групи',mustChangePassword:false,passwordHash:'not-a-login-credential',roles:{create:{roleId:'STAROSTA'}},starostaAssignments:{create:{groupId:f.groupA}},student:{connect:{id:f.studentA.id}}},select:principalSelect});
  const actors=[first,f.actor],students=[f.studentA.id,f.studentB.id];
  const results=await Promise.allSettled(actors.map((actor,index)=>saveJournal(actor,f.lesson.id,request(0,students[index],'N','DRAFT'))));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  const index=results.findIndex(result=>result.status==='rejected');
  const failure=results[index];assert.ok(failure.status==='rejected'&&failure.reason instanceof HttpError&&failure.reason.status===409);
  const state=await journal(actors[index],f.lesson.id);
  await saveJournal(actors[index],f.lesson.id,request(state.lesson.version,students[index],'N','DRAFT'));
  assert.equal(await db.attendance.count({where:{lessonId:f.lesson.id,confirmed:true}}),2);
});

test('demo generation preserves manual marks, bumps versions with drafts, and skips future/cancelled lessons',async()=>{
  const {generateDemoAttendance}=await import('../../scripts/generate-demo-attendance');
  const {effectiveNow}=await import('../../src/lib/time');
  const f=await fixture(),future=await fixture(),cancelled=await fixture();
  const database=await db.$queryRaw<{name:string}[]>`SELECT current_database() AS name`;
  assert.equal(database[0].name,'mnau_attendance','Run through the isolated verification harness; never weaken the generator database guard.');
  await db.lesson.update({where:{id:future.lesson.id},data:{startAt:effectiveNow().plus({days:7}).toJSDate(),endAt:effectiveNow().plus({days:7,hours:1}).toJSDate()}});
  await db.lesson.update({where:{id:cancelled.lesson.id},data:{cancelled:true}});
  const seedStudent=await db.student.create({data:{id:`generator-${randomUUID()}`,fullName:'Тест незаповненої відмітки',groupId:f.groupA}});
  await db.lessonStudent.create({data:{lessonId:f.lesson.id,studentId:seedStudent.id}});
  const manual=await saveJournal(f.teacher,f.lesson.id,request(0,f.studentA.id,'HV'));
  await saveJournal(f.actor,f.lesson.id,request(manual.version,f.studentB.id,'N','DRAFT'));
  const before=await db.lesson.findUniqueOrThrow({where:{id:f.lesson.id},include:{attendance:{orderBy:{studentId:'asc'}}}});
  const result=await generateDemoAttendance();assert.ok(result.createdAttendance>0);
  const after=await db.lesson.findUniqueOrThrow({where:{id:f.lesson.id},include:{attendance:{orderBy:{studentId:'asc'}}}});
  assert.equal(after.version,before.version+1);assert.equal(after.journalState,'CONFIRMED');
  assert.deepEqual(after.attendance.filter(row=>row.studentId!==seedStudent.id),before.attendance);
  assert.equal(after.attendance.find(row=>row.studentId===seedStudent.id)?.confirmed,true);
  assert.equal(await db.auditLog.count({where:{lessonId:f.lesson.id,source:'DEMO_RANDOM_ATTENDANCE'}}),1);
  assert.equal(await db.attendance.count({where:{lessonId:{in:[future.lesson.id,cancelled.lesson.id]}}}),0);
  await rejected(()=>saveJournal(f.teacher,f.lesson.id,request(before.version,f.studentA.id,'N')),409);
  const auditCount=await db.auditLog.count();
  const repeat=await generateDemoAttendance();assert.equal(repeat.createdAttendance,0);
  assert.equal(await db.auditLog.count(),auditCount);
  assert.equal((await db.lesson.findUniqueOrThrow({where:{id:f.lesson.id}})).version,after.version);
});


test('a guessed future version cannot authorize writes against a different permission snapshot',async()=>{
  const f=await fixture();
  await rejected(()=>saveJournal(f.actor,f.lesson.id,request(1,f.studentB.id,'N','DRAFT')),409);
  assert.equal(await db.attendance.count({where:{lessonId:f.lesson.id}}),0);
  assert.equal((await db.lesson.findUniqueOrThrow({where:{id:f.lesson.id}})).version,0);
});

test('mixed teacher and curator rights stay correlated with the specific lesson and roster group',async()=>{
  const {analytics}=await import('../../src/lib/analytics');
  const {parseFilters}=await import('../../src/lib/filters');
  const f=await fixture();
  // This teacher teaches B in a different lesson and curates A. Neither right
  // permits seeing B's marks in the shared lesson taught by someone else.
  const teacherProfile=await db.teacher.findFirstOrThrow({where:{id:{not:f.teacher.teacher!.id},userId:{not:null}}});
  const userId=teacherProfile.userId!;
  await db.userRole.upsert({where:{userId_roleId:{userId,roleId:'CURATOR'}},create:{userId,roleId:'CURATOR'},update:{}});
  await db.curatorAssignment.upsert({where:{userId_groupId:{userId,groupId:f.groupA}},create:{userId,groupId:f.groupA},update:{}});
  const unrelated=await fixture();
  await db.lesson.update({where:{id:unrelated.lesson.id},data:{teacherId:teacherProfile.id}});
  await db.lessonStudent.create({data:{lessonId:unrelated.lesson.id,studentId:f.studentB.id}});
  await saveJournal(f.teacher,f.lesson.id,{version:0,requestId:randomUUID(),mode:'CONFIRM',rows:[{studentId:f.studentA.id,status:'PRESENT'},{studentId:f.studentB.id,status:'N'}]});
  const actor=await p(userId);
  const state=await journal(actor,f.lesson.id);
  assert.deepEqual(state.rows.map(row=>row.id),[f.studentA.id]);
  assert.deepEqual(state.lesson.groups.map(group=>group.groupId),[f.groupA]);
  assert.ok(!state.audits.some(audit=>audit.studentId===f.studentB.id));
  const {rosterScope,lessonScopeForGroup}=await import('../../src/lib/access');
  const visibleHistory=await db.lessonStudent.findMany({where:{AND:[{studentId:f.studentB.id},rosterScope(actor)]}});
  assert.deepEqual(visibleHistory.map(row=>row.lessonId),[unrelated.lesson.id]);
  const group=await db.group.findUniqueOrThrow({where:{id:f.groupB},include:{specialty:true}});
  const visibleLessons=await db.lesson.findMany({where:{AND:[lessonScopeForGroup(actor,group),{groups:{some:{groupId:f.groupB}}}]}});
  assert.ok(!visibleLessons.some(lesson=>lesson.id===f.lesson.id));
  assert.ok(visibleLessons.some(lesson=>lesson.id===unrelated.lesson.id));
  const filters=parseFilters({from:today(),to:today(),group:f.groupB});
  const data=await analytics(actor,filters);
  assert.equal(data.students.find(student=>student.id===f.studentB.id)?.stats.N,0);
  await rejected(()=>saveJournal(actor,f.lesson.id,request(state.lesson.version,f.studentB.id,'HV')),403);
});


test('curator plus starosta sees only the curator segment when starosta access is disabled for a shared lesson',async()=>{
  const f=await fixture();
  await db.userRole.create({data:{userId:f.actor.id,roleId:'CURATOR'}});
  await db.curatorAssignment.create({data:{userId:f.actor.id,groupId:f.groupA}});
  await db.lesson.update({where:{id:f.lesson.id},data:{starostaAllowed:false}});
  const actor=await p(f.actor.id),state=await journal(actor,f.lesson.id);
  assert.deepEqual(state.rows.map(row=>row.id),[f.studentA.id]);
  assert.deepEqual(state.lesson.groups.map(group=>group.groupId),[f.groupA]);
  await rejected(()=>saveJournal(actor,f.lesson.id,request(0,f.studentB.id,'N','DRAFT')),403);
});
