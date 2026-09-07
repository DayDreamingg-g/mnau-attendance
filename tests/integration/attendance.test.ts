import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {db} from '../../src/lib/db';
import {hashToken,principalFromToken,principalSelect,type Principal} from '../../src/lib/auth';
import {journal,saveJournal} from '../../src/lib/journal';
import {analytics} from '../../src/lib/analytics';
import {HttpError} from '../../src/lib/errors';
import {parseFilters} from '../../src/lib/filters';
import {today,effectiveNow} from '../../src/lib/time';
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3001';
const origin=process.env.APP_ORIGIN??'http://localhost:3000';
let admin:Principal,dean:Principal,curator:Principal,starosta:Principal,teacher:Principal;
let liveId:string,groupId:string,foreignLessonId:string,foreignStudentId:string;
const p=async(email:string)=>db.user.findUniqueOrThrow({where:{email},select:principalSelect});
const f=()=>parseFilters({});
const input=(version:number,studentId:string,status:'PRESENT'|'N'|'HV'|null,mode:'CONFIRM'|'DRAFT'='CONFIRM',reason?:string)=>({version,requestId:randomUUID(),mode,reason,rows:[{studentId,status}]});
async function rejected(fn:()=>Promise<unknown>,status:number){await assert.rejects(fn,e=>e instanceof HttpError&&e.status===status);}
async function signIn(email:string,password='Test1234!'){const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(response.status,200);const raw=response.headers.get('set-cookie')!;return {cookie:raw.split(';')[0],raw};}
before(async()=>{
  [admin,dean,curator,starosta,teacher]=await Promise.all(['admin@test.com','dean@test.com','curator@test.com','starosta@test.com','teacher@test.com'].map(p));
  groupId=starosta.student!.groupId;liveId='demo-live-'+groupId;
  const assigned=await db.lesson.findUniqueOrThrow({where:{id:liveId},include:{teacher:{include:{user:{select:principalSelect}}}}});assert.equal(assigned.teacher?.user?.id,teacher.id);
  foreignLessonId=(await db.lesson.findFirstOrThrow({where:{teacherId:{not:teacher.teacher!.id},groups:{none:{groupId}}}})).id;
  foreignStudentId=(await db.student.findFirstOrThrow({where:{groupId:{not:groupId}}})).id;
  await db.specialty.create({data:{id:'test-other-specialty',name:'Синтетична перевірка меж доступу',facultyId:'faculty-accounting-finance',source:{test:true}}});
  await db.group.create({data:{id:'test-other-group',name:'TEST-OTHER',course:1,specialtyId:'test-other-specialty',source:{test:true}}});
  await db.student.create({data:{id:'test-other-student',fullName:'Тестовий Студент Іншого Факультету',groupId:'test-other-group'}});
});
after(async()=>{await db.$disconnect();});
test('all protected direct URLs redirect without a session',async()=>{for(const route of ['/',`/groups/${groupId}`,`/students/${foreignStudentId}`,`/specialties/${(await db.group.findUniqueOrThrow({where:{id:groupId}})).specialtyId}`,`/teacher/lessons/${liveId}`,'/reports','/admin']){const r=await fetch(base+route,{redirect:'manual'});assert.ok([303,307].includes(r.status),route);assert.ok(r.headers.get('location')?.endsWith('/login'));}});
test('random, expired and revoked tokens cannot authenticate',async()=>{
  assert.equal(await principalFromToken(randomBytes(32).toString('hex')),null);
  const token=randomBytes(32).toString('hex');await db.session.create({data:{userId:admin.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()-1000)}});assert.equal(await principalFromToken(token),null);
  await db.session.update({where:{tokenHash:hashToken(token)},data:{expiresAt:new Date(Date.now()+60000)}});assert.equal((await principalFromToken(token))?.id,admin.id);await db.session.delete({where:{tokenHash:hashToken(token)}});assert.equal(await principalFromToken(token),null);
  const r=await fetch(base+'/api/lessons/'+liveId,{headers:{cookie:'mnau_session='+token}});assert.equal(r.status,401);
});
test('login uses POST even before hydration, generic errors, origin validation and rate limiting',async()=>{
  const loginHtml=await(await fetch(base+'/login')).text();const formTag=loginHtml.match(/<form[^>]*>/)?.[0]??'';assert.match(formTag,/method="post"/);assert.match(formTag,/action="\/api\/auth\/login"/);
  const wrong=async(email:string)=>fetch(base+'/api/auth/login',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({email,password:'wrong-password'})});
  const a=await wrong('missing@test.com'),b=await wrong('admin@test.com');assert.equal(a.status,401);assert.equal(b.status,401);assert.deepEqual(await a.json(),await b.json());
  const badOrigin=await fetch(base+'/api/auth/login',{method:'POST',headers:{origin:'https://untrusted.invalid','Content-Type':'application/json'},body:JSON.stringify({email:'admin@test.com',password:'Test1234!'})});assert.equal(badOrigin.status,403);
  let r;for(let i=0;i<9;i++)r=await wrong('rate-limit@test.com');assert.equal(r!.status,429);
});
test('logout revokes only the current opaque server session',async()=>{
  const first=await signIn('admin@test.com'),second=await signIn('admin@test.com');assert.match(first.raw,/HttpOnly/i);assert.match(first.raw,/SameSite=lax/i);assert.match(first.cookie,/=[a-f0-9]{64}$/);
  const token=first.cookie.split('=')[1];const session=await db.session.findUniqueOrThrow({where:{tokenHash:hashToken(token)}});assert.notEqual(session.tokenHash,token);
  const r=await fetch(base+'/api/auth/logout',{method:'POST',headers:{origin,cookie:first.cookie}});assert.equal(r.status,200);assert.equal(await principalFromToken(token),null);assert.ok(await principalFromToken(second.cookie.split('=')[1]));
});
test('teacher cannot read or mutate another lesson by replacing its ID',async()=>{await rejected(()=>journal(teacher,foreignLessonId),404);await rejected(()=>saveJournal(teacher,foreignLessonId,input(0,foreignStudentId,'N')),404);const auth=await signIn('teacher@test.com');const r=await fetch(base+'/api/lessons/'+foreignLessonId,{method:'POST',headers:{origin,cookie:auth.cookie,'Content-Type':'application/json'},body:JSON.stringify(input(0,foreignStudentId,'N'))});assert.equal(r.status,404);});
test('starosta and dean have no cross-group or cross-faculty fallback',async()=>{await rejected(()=>journal(starosta,foreignLessonId),404);const starData=await analytics(starosta,f());assert.deepEqual(starData.groups.map(g=>g.id),[groupId]);const deanData=await analytics(dean,f());assert.ok(!deanData.groups.some(g=>g.id==='test-other-group'));const emptyUser={...teacher,teacher:null,curatorAssignments:[],deanAssignments:[],student:null};assert.equal((await analytics(emptyUser,f())).groups.length,0);const auth=await signIn('dean@test.com');const r=await fetch(base+'/groups/test-other-group',{headers:{cookie:auth.cookie}});assert.ok(r.status===404||!(await r.text()).includes('Тестовий Студент Іншого Факультету'));});
test('unknown students and invalid statuses cannot be submitted',async()=>{const current=await journal(teacher,liveId);await rejected(()=>saveJournal(teacher,liveId,input(current.lesson.version,foreignStudentId,'N')),403);await rejected(()=>saveJournal(teacher,liveId,{...input(current.lesson.version,current.rows[0].id,'N'),rows:[{studentId:current.rows[0].id,status:'ABSENT'}]}),400);});
test('starosta draft does not enter confirmed analytics and teacher confirms it',async()=>{
  const before=await journal(starosta,liveId);const beforeStats=await analytics(curator,f());
  const draft=input(before.lesson.version,before.rows[0].id,'N','DRAFT');await saveJournal(starosta,liveId,draft);
  const after=await journal(teacher,liveId);assert.equal(after.rows[0].status,'N');assert.equal(after.rows[0].confirmed,false);const afterStats=await analytics(curator,f());assert.equal(afterStats.stats.N,beforeStats.stats.N);assert.equal(afterStats.stats.pending,beforeStats.stats.pending+1);
  await saveJournal(teacher,liveId,input(after.lesson.version,after.rows[0].id,'N'));
  const confirmed=await journal(starosta,liveId);assert.equal(confirmed.rows[0].confirmed,true);assert.equal(confirmed.rows[0].editable,false);await rejected(()=>saveJournal(starosta,liveId,input(confirmed.lesson.version,confirmed.rows[0].id,'PRESENT','DRAFT')),403);
  assert.equal((await analytics(curator,f())).stats.N,beforeStats.stats.N+1);
});
test('successful save is persistent, audited and idempotent',async()=>{const state=await journal(teacher,liveId);const req=input(state.lesson.version,state.rows[0].id,'PRESENT');const count=await db.auditLog.count({where:{lessonId:liveId}});const result=await saveJournal(teacher,liveId,req);const replay=await saveJournal(teacher,liveId,req);assert.equal(replay.replayed,true);assert.equal(replay.version,result.version);assert.equal(await db.auditLog.count({where:{lessonId:liveId}}),count+1);assert.equal((await journal(teacher,liveId)).rows[0].status,'PRESENT');});
test('two editors with one version cannot silently overwrite each other',async()=>{const state=await journal(teacher,liveId);const a=input(state.lesson.version,state.rows[1].id,'N'),b=input(state.lesson.version,state.rows[1].id,'HV');const results=await Promise.allSettled([saveJournal(teacher,liveId,a),saveJournal(teacher,liveId,b)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason instanceof HttpError&&r.reason.status===409).length,1);});
test('past edits require the assigned authority and a reason',async()=>{const past=await db.lesson.findFirstOrThrow({where:{id:{startsWith:'demo-history-'+groupId},teacherId:{not:null}},include:{teacher:{include:{user:{select:principalSelect}}}}});const pastTeacher=past.teacher!.user!;const state=await journal(curator,past.id);await rejected(()=>saveJournal(pastTeacher,past.id,input(state.lesson.version,state.rows[0].id,'HV','CONFIRM','Виправлення помилки')),403);await rejected(()=>saveJournal(curator,past.id,input(state.lesson.version,state.rows[0].id,'HV')),400);await saveJournal(curator,past.id,input(state.lesson.version,state.rows[0].id,'HV','CONFIRM','Виправлення помилки внесення'));assert.equal((await journal(curator,past.id)).rows[0].status,'HV');});
test('future/cancelled lessons are not marked and report filtering uses the same math',async()=>{assert.equal(await db.attendance.count({where:{lesson:{OR:[{startAt:{gt:effectiveNow().toJSDate()}},{cancelled:true}]}}}),0);const scoped=await analytics(dean,{...f(),course:2,group:groupId});assert.equal(scoped.groups.length,1);assert.equal(scoped.students.length,15);const empty=await analytics(dean,{...f(),course:4,group:groupId});assert.equal(empty.students.length,0);assert.equal(empty.stats.percentage,null);});
test('repeat seed preserves manual attendance, passwords and sessions',async()=>{assert.equal(await db.teacher.count({where:{userId:{not:null},lessons:{none:{}}}}),0);const state=await journal(teacher,liveId);const password=(await db.user.findUniqueOrThrow({where:{id:teacher.id}})).passwordHash;const sessions=await db.session.count();const seed=spawnSync(process.execPath,['--import','tsx','prisma/seed.ts'],{env:process.env,encoding:'utf8'});assert.equal(seed.status,0,seed.stderr);assert.equal((await journal(teacher,liveId)).lesson.version,state.lesson.version);assert.deepEqual((await journal(teacher,liveId)).rows.map(r=>r.status),state.rows.map(r=>r.status));assert.equal((await db.user.findUniqueOrThrow({where:{id:teacher.id}})).passwordHash,password);assert.equal(await db.session.count(),sessions);});
test('machine endpoint requires its own secret; reports contain real PDF/CSV and are deduplicated',async()=>{
  const noauth=await fetch(base+'/api/machine/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'MONTHLY'})});assert.equal(noauth.status,401);
  const auth=await signIn('dean@test.com');const request=()=>fetch(base+'/api/reports',{method:'POST',headers:{origin,cookie:auth.cookie,'Content-Type':'application/json'},body:JSON.stringify({kind:'MONTHLY',faculty:'faculty-management',from:f().from,to:today(),course:2,group:groupId})});
  const response=await request();assert.equal(response.status,200,await response.clone().text());const report=await response.json();assert.equal(report.state,'READY');const duplicate=await(await request()).json();assert.equal(duplicate.id,report.id);
  const [pdf,csv]=await Promise.all(['pdf','csv'].map(format=>fetch(`${base}/api/reports/${report.id}/${format}`,{headers:{cookie:auth.cookie}})));assert.equal(pdf.status,200);const pdfBytes=Buffer.from(await pdf.arrayBuffer());assert.equal(pdfBytes.subarray(0,5).toString(),'%PDF-');const csvText=await csv.text();assert.ok(csvText.includes('ПІБ'));assert.equal(csvText.split('\r\n').length,16);await mkdir('test-results',{recursive:true});await writeFile('test-results/sample-report.pdf',pdfBytes);
  const teacherAuth=await signIn('teacher@test.com');assert.equal((await fetch(`${base}/api/reports/${report.id}/pdf`,{headers:{cookie:teacherAuth.cookie}})).status,404);
  const forbidden=await fetch(base+'/api/reports',{method:'POST',headers:{origin,cookie:auth.cookie,'Content-Type':'application/json'},body:JSON.stringify({kind:'DAILY',faculty:'faculty-accounting-finance'})});assert.equal(forbidden.status,403);
});
