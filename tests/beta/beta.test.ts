import {betaCalendarScope} from '../../src/lib/beta-calendar';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import bcrypt from 'bcryptjs';
import {db} from '../../src/lib/db';
import {prepareCSBeta} from '../../scripts/prepare-cs-beta';
import {repairCSBeta} from '../../scripts/repair-cs-beta';
import {weekHalf} from '../../scripts/generate-semester-schedule';
import {principalSelect,login,principalFromToken,type Principal} from '../../src/lib/auth';
import {analytics} from '../../src/lib/analytics';
import {groupScope} from '../../src/lib/access';
import {changeStudent,createStudentAccount} from '../../src/lib/students';
import {adminChange} from '../../src/lib/admin';
import {journal,saveJournal} from '../../src/lib/journal';
import {CS_COUNTS,CS_GROUP_IDS,teacherKey,readCSData} from '../../src/lib/cs-beta-data';
import {atKyiv,today,effectiveNow} from '../../src/lib/time';
import {HttpError} from '../../src/lib/errors';
const principal=(email:string)=>db.user.findUniqueOrThrow({where:{email},select:principalSelect});
const reject=(fn:()=>Promise<unknown>,status:number)=>assert.rejects(fn,e=>e instanceof HttpError&&e.status===status);
const reason='Перевірка beta: підтверджена зміна';
const base=process.env.TEST_BASE_URL!;
let admin:Principal,curator:Principal,starosta:Principal,developer:Principal,dean:Principal,teacher:Principal;
let summary:Awaited<ReturnType<typeof prepareCSBeta>>,ongoing:string,past:string,future:string,studentId:string;
let otherCounts:{students:number;lessons:number};
const marks=(version:number,id:string,mode='CONFIRM',why?:string)=>({version,requestId:randomUUID(),mode,reason:why,rows:[{studentId:id,status:'PRESENT'}]});
before(async()=>{
  otherCounts={students:await db.student.count({where:{groupId:{notIn:[...CS_GROUP_IDS]}}}),lessons:await db.lesson.count()};
  summary=await prepareCSBeta();
  const retired=await db.lesson.findFirstOrThrow({where:{id:{startsWith:'demo-'},groups:{some:{groupId:'g-3-4'}}}});
  await db.auditLog.create({data:{lessonId:retired.id,studentId:'removed-synthetic-student',objectType:'Attendance',objectId:'orphan-demo-audit',source:'DEMO_RANDOM_ATTENDANCE',details:{generator:'demo-attendance'}}});
  await repairCSBeta({from:'2026-09-07',to:'2026-09-28'});
  [admin,curator,starosta,developer,dean]=await Promise.all(['admin@test.com','curator.cs@test.com','starosta.kn1-1@test.com','developer@test.com','dean@test.com'].map(principal));
  teacher=await principal('parkhomenko.oyu@test.com');
});
after(async()=>{await db.$disconnect();});
test('beta reset imports 17/0/20/21/0 real students and preserves unrelated data and every lesson',async()=>{
  for(const [id,count] of Object.entries(CS_COUNTS))assert.equal(await db.student.count({where:{groupId:id}}),count,id);
  assert.equal(await db.student.count({where:{groupId:{in:[...CS_GROUP_IDS]},isSynthetic:true}}),0);
  assert.equal(await db.student.count({where:{groupId:{notIn:[...CS_GROUP_IDS]}}}),otherCounts.students);
  assert.ok(await db.lesson.count()>=otherCounts.lessons);
  assert.equal(await db.attendance.count({where:{student:{isSynthetic:false}}}),0);
  assert.equal(await db.lessonStudent.count({where:{student:{isSynthetic:false},lesson:{endAt:{lte:effectiveNow().toJSDate()}}}}),0);
  assert.equal(await db.user.count({where:{student:{isSynthetic:false}}}),0);
  assert.equal(await db.starostaAssignment.count({where:{user:{email:{startsWith:'starosta.kn'}}}}),5);
  assert.equal(curator.curatorAssignments.length,5);assert.equal(starosta.student,null);
  const source=await db.student.findFirstOrThrow({where:{groupId:'g-1-4'},select:{source:true}});
  assert.ok((source.source as {importedAt:string}).importedAt);
});
test('beta calendar hides superseded CS-only demo lessons while preserving their records',async()=>{
  assert.ok(await db.lesson.count({where:{id:{startsWith:'demo-'}}}));
  assert.equal(await db.lesson.count({where:{AND:[await betaCalendarScope(),{synthetic:true,id:{startsWith:'demo-'},groups:{some:{groupId:'g-1-4'},every:{groupId:{in:[...CS_GROUP_IDS]}}}}]}}),0);
});

test('canonical CS structure and PDF calendars are complete for every group and teacher',async()=>{
  const specialties=await db.specialty.findMany({where:{name:"Комп'ютерні науки"},include:{groups:{orderBy:{name:'asc'}}}});
  assert.equal(specialties.length,1);assert.equal(specialties[0].groups.length,5);
  assert.deepEqual(specialties[0].groups.map(g=>g.name),['КН 1/1','КН 2/1','КН 3/1','КН 3/2','КН 4/1']);
  for(const g of specialties[0].groups)assert.ok(await db.lesson.count({where:{cancelled:false,groups:{some:{groupId:g.id}}}}),g.name);
  assert.equal(await db.student.count({where:{fullName:'Test Test Test'}}),0);
  assert.equal(await db.user.count({where:{email:'123@1561s.com'}}),0);
  assert.equal(await db.auditLog.count({where:{objectId:'orphan-demo-audit'}}),1);
  assert.equal(await db.lesson.count({where:{teacherId:teacher.teacher!.id,cancelled:false,groups:{some:{groupId:'g-4-4'}}}}),0);
  const shared=await db.lesson.findFirstOrThrow({where:{cancelled:false,startAt:{gt:effectiveNow().toJSDate()},groups:{some:{groupId:'g-3-4'}},AND:[{groups:{some:{groupId:'g-3-5'}}}]},include:{roster:true}});
  assert.equal(shared.roster.length,41);
  const slots=new Set<string>();
  for(const l of await db.lesson.findMany({where:{cancelled:false,groups:{some:{groupId:{in:[...CS_GROUP_IDS]}}}},include:{groups:true}}))for(const g of l.groups){const key=g.groupId+':'+l.startAt.toISOString()+':'+l.pairNumber;assert.ok(!slots.has(key),key);slots.add(key);}
});

test('all five starostas log in through HTTP, create a session and reach their own workspace',async()=>{
  for(const group of ['1-1','2-1','3-1','3-2','4-1']){
    const email='starosta.kn'+group+'@test.com';
    const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{origin:process.env.APP_ORIGIN!,'Content-Type':'application/json'},body:JSON.stringify({email,password:'Test1234!'})});
    assert.equal(response.status,200,email);
    const cookie=response.headers.get('set-cookie')!.split(';')[0];assert.match(cookie,/mnau_session=/);
    const home=await fetch(base+'/',{headers:{cookie},redirect:'manual'});
    assert.ok(home.status===307||home.status===200);const homeText=await home.text();assert.ok(home.headers.get('location')==='/starosta'||homeText.includes('/starosta'));
    const workspace=await fetch(base+'/starosta',{headers:{cookie}});assert.equal(workspace.status,200);assert.ok((await workspace.text()).includes('КН '+group.replace('-','/')));
    const denied=await fetch(base+'/api/students',{method:'POST',headers:{cookie,origin:process.env.APP_ORIGIN!,'Content-Type':'application/json'},body:JSON.stringify({action:'ADD',groupId:group==='1-1'?'g-3-4':'g-1-4',fullName:'Заборонена підміна',reason})});assert.equal(denied.status,403);
  }
});

test('sources and personal teacher navigation are protected by actual roles and profiles',async()=>{
  for(const actor of [teacher,starosta]){
    const token=await login(actor.email,'Test1234!'),cookie='mnau_session='+token;
    const response=await fetch(base+'/sources',{headers:{cookie}});const html=await response.text();
    assert.ok(response.status===404||html.includes('Сторінка недоступна'));assert.ok(!html.includes('Оригінальне ПІБ'));
  }
  const token=await login(developer.email,'Test1234!');
  const html=await(await fetch(base+'/admin',{headers:{cookie:'mnau_session='+token}})).text();assert.ok(!html.includes('Мої заняття'));
});

test('permanent deletion requires manager confirmation and preserves imported student history',async()=>{
  const added=await changeStudent(curator,{action:'ADD',groupId:'g-2-4',fullName:'Видалення помилкового запису',reason});
  await reject(()=>changeStudent(curator,{action:'DELETE',groupId:'g-2-4',studentId:added.studentId,confirmDelete:true,reason}),403);
  await reject(()=>changeStudent(admin,{action:'DELETE',groupId:'g-2-4',studentId:added.studentId,reason}),400);
  await changeStudent(admin,{action:'DELETE',groupId:'g-2-4',studentId:added.studentId,confirmDelete:true,reason});assert.equal(await db.student.count({where:{id:added.studentId}}),0);
  const official=await db.student.findFirstOrThrow({where:{groupId:'g-1-4',importKey:{not:null}}});
  await reject(()=>changeStudent(admin,{action:'DELETE',groupId:'g-1-4',studentId:official.id,confirmDelete:true,reason}),409);
});

test('preparation and calendar generation are repeatable; no marks, duplicate teachers, users or assignments',async()=>{
  const before={users:await db.user.count(),teachers:await db.teacher.count(),students:await db.student.count(),lessons:await db.lesson.count(),roster:await db.lessonStudent.count()};
  await repairCSBeta({from:'2026-09-07',to:'2026-09-28'});
  assert.deepEqual({users:await db.user.count(),teachers:await db.teacher.count(),students:await db.student.count(),lessons:await db.lesson.count(),roster:await db.lessonStudent.count()},before);
  const {cells}=await readCSData(),teachers=await db.teacher.findMany();
  for(const key of new Set(cells.flatMap(c=>c.teacher?[teacherKey(c.teacher)]:[])))assert.equal(teachers.filter(t=>teacherKey(t.displayName)===key).length,1,key);
  for(const lesson of await db.lesson.findMany({where:{id:{startsWith:'cs-calendar-'}},include:{source:true,groups:true}})){
    const cell=lesson.source!.data as unknown as {splitCell:boolean;splitPart:string;groups:string[]};
    if(cell.splitCell)assert.equal(lesson.weekPattern,weekHalf(lesson.startAt.toISOString().slice(0,10))==='lower'?'DENOMINATOR':'NUMERATOR');
    assert.deepEqual(lesson.groups.map(g=>g.groupId).sort(),cell.groups.sort());
  }
});
test('every one of 19 teacher accounts authenticates using bcrypt and sees only assigned lessons',async()=>{
  assert.equal(summary.teacherAccounts.length,19);
  for(const account of summary.teacherAccounts){
    const token=await login(account.email,'Test1234!'),u=(await principalFromToken(token))!;
    assert.ok(u.teacher);assert.ok(u.roles.some(r=>r.roleId==='TEACHER'));
    const own=await db.lesson.findFirstOrThrow({where:{teacherId:u.teacher!.id}});await journal(u,own.id);
    const foreign=await db.lesson.findFirstOrThrow({where:{teacherId:{not:u.teacher!.id}}});await reject(()=>journal(u,foreign.id),404);
    const row=await db.user.findUniqueOrThrow({where:{id:u.id}});assert.match(row.passwordHash,/^\$2[aby]\$/);
  }
});

test('repair preserves a reconciled manual journal and rolls back entirely on ambiguous history',async()=>{
  const lesson=await db.lesson.findFirstOrThrow({where:{id:{startsWith:'cs-calendar-'},cancelled:false,endAt:{lt:effectiveNow().toJSDate()},groups:{some:{groupId:'g-1-4'}}}});
  const fixture='repair-history-fixture';
  await db.student.create({data:{id:fixture,groupId:'g-1-4',fullName:'Ізольований тест історії',isSynthetic:false}});
  await db.lessonStudent.create({data:{lessonId:lesson.id,studentId:fixture,groupId:'g-1-4'}});
  await db.attendance.create({data:{lessonId:lesson.id,studentId:fixture,statusCode:'PRESENT',confirmed:true}});
  const before=await db.attendance.findUniqueOrThrow({where:{studentId_lessonId:{studentId:fixture,lessonId:lesson.id}}});
  await repairCSBeta({from:'2026-09-07',to:'2026-09-28'});
  assert.deepEqual(await db.attendance.findUniqueOrThrow({where:{studentId_lessonId:{studentId:fixture,lessonId:lesson.id}}}),before);
  assert.equal(await db.lessonStudent.count({where:{lessonId:lesson.id,studentId:fixture,groupId:'g-1-4'}}),1);
  const ambiguous='ambiguous-repair-subject';await db.subject.create({data:{id:ambiguous,name:'Невідоме ручне заняття',source:{test:true}}});
  await db.lesson.update({where:{id:lesson.id},data:{subjectId:ambiguous}});
  await db.user.update({where:{id:starosta.id},data:{active:false}});
  await assert.rejects(()=>repairCSBeta({from:'2026-09-07',to:'2026-09-28'}),/Ambiguous manual history/);
  assert.equal((await db.user.findUniqueOrThrow({where:{id:starosta.id}})).active,false);
  assert.deepEqual(await db.attendance.findUniqueOrThrow({where:{studentId_lessonId:{studentId:fixture,lessonId:lesson.id}}}),before);
  await db.user.update({where:{id:starosta.id},data:{active:true}});
  await db.lesson.update({where:{id:lesson.id},data:{subjectId:lesson.subjectId}});
  await db.attendance.deleteMany({where:{studentId:fixture}});await db.lessonStudent.deleteMany({where:{studentId:fixture}});await db.student.delete({where:{id:fixture}});await db.subject.delete({where:{id:ambiguous}});
});
test('starosta and curator server APIs reject group/student/lesson tampering',async()=>{
  assert.deepEqual((await db.group.findMany({where:groupScope(starosta)})).map(g=>g.id),['g-1-4']);
  const foreign=await db.student.findFirstOrThrow({where:{groupId:'g-3-4'}});
  await reject(()=>changeStudent(starosta,{action:'ADD',groupId:'g-3-4',fullName:'Заборонений запис',reason}),403);
  await reject(()=>changeStudent(starosta,{action:'EDIT',groupId:'g-1-4',studentId:foreign.id,fullName:'Підміна',reason}),403);
  await reject(()=>changeStudent(curator,{action:'ADD',groupId:'g-1-2',fullName:'Підміна',reason}),403);
  const token=await login(starosta.email,'Test1234!');
  const response=await fetch(base+'/api/students',{method:'POST',headers:{origin:process.env.APP_ORIGIN!,'Content-Type':'application/json',cookie:'mnau_session='+token},body:JSON.stringify({action:'ADD',groupId:'g-3-4',fullName:'Підміна',reason})});assert.equal(response.status,403);
  const html=await(await fetch(base+'/groups/g-3-4',{headers:{cookie:'mnau_session='+token}})).text();assert.ok(!html.includes(foreign.fullName));
});
test('add/edit student without a phone updates current/future roster transactionally and no past attendance',async()=>{
  const template=await db.lesson.findFirstOrThrow({where:{teacherId:teacher.teacher!.id},select:{subjectId:true,buildingId:true,room:true,bellId:true}});
  for(const [key,start,end] of [['past','2026-09-13T08:30','2026-09-13T09:50'],['ongoing',today()+'T20:00',today()+'T22:00'],['future','2026-09-16T08:30','2026-09-16T09:50']]){
    const id='beta-test-'+key;await db.lesson.create({data:{...template,id,teacherId:teacher.teacher!.id,pairNumber:1,startAt:atKyiv(start.slice(0,10),start.slice(11)),endAt:atKyiv(end.slice(0,10),end.slice(11)),groups:{create:{groupId:'g-1-4'}}}});
    if(key==='past')past=id;if(key==='ongoing')ongoing=id;if(key==='future')future=id;
  }
  const result=await changeStudent(starosta,{action:'ADD',groupId:'g-1-4',fullName:'Тестова студентка beta',reason});studentId=result.studentId;
  assert.equal((await db.student.findUniqueOrThrow({where:{id:studentId}})).phone,null);
  assert.equal(await db.lessonStudent.count({where:{studentId,lessonId:{in:[ongoing,future]}}}),2);
  assert.equal(await db.lessonStudent.count({where:{studentId,lessonId:past}}),0);
  assert.equal(await db.attendance.count({where:{studentId}}),0);
  await changeStudent(starosta,{action:'EDIT',groupId:'g-1-4',studentId,fullName:'Тестова студентка після зміни',phone:'+380000000000',reason});
  assert.equal(await db.auditLog.count({where:{objectType:'Student',studentId}}),2);
});
test('starosta drafts, teacher confirms, future writes fail and stale versions conflict',async()=>{
  const state=await journal(starosta,ongoing);await saveJournal(starosta,ongoing,marks(state.lesson.version,studentId,'DRAFT'));
  const draft=await journal(teacher,ongoing);assert.equal(draft.rows[0].confirmed,false);
  await saveJournal(teacher,ongoing,marks(draft.lesson.version,studentId));
  const confirmed=await journal(starosta,ongoing);assert.equal(confirmed.rows[0].editable,false);
  await reject(()=>saveJournal(starosta,ongoing,marks(confirmed.lesson.version,studentId,'DRAFT')),403);
  await reject(()=>saveJournal(teacher,ongoing,marks(draft.lesson.version,studentId)),409);
  const planned=await journal(teacher,future);assert.equal(planned.rows[0].editable,false);
  await reject(()=>saveJournal(teacher,future,marks(planned.lesson.version,studentId)),403);
});
test('transfer preserves old roster group and attendance, removes future old roster and adds new roster',async()=>{
  const mark=await db.attendance.findUniqueOrThrow({where:{studentId_lessonId:{studentId,lessonId:ongoing}}});
  await reject(()=>changeStudent(starosta,{action:'TRANSFER',groupId:'g-1-4',studentId,targetGroupId:'g-3-4',reason}),403);
  await changeStudent(curator,{action:'TRANSFER',groupId:'g-1-4',studentId,targetGroupId:'g-3-4',reason});
  assert.deepEqual(await db.attendance.findUniqueOrThrow({where:{studentId_lessonId:{studentId,lessonId:ongoing}}}),mark);
  assert.equal((await db.lessonStudent.findUniqueOrThrow({where:{lessonId_studentId:{lessonId:ongoing,studentId}}})).groupId,'g-1-4');
  assert.equal(await db.lessonStudent.count({where:{lessonId:future,studentId}}),0);
  assert.ok(await db.lessonStudent.count({where:{studentId,groupId:'g-3-4'}})>0);
  assert.equal((await journal(teacher,ongoing)).rows[0].group.toUpperCase(),'КН 1/1');
});
test('archive is soft, future roster is removed, and correction authorities require a reason after Kyiv day ends',async()=>{
  await db.lesson.update({where:{id:ongoing},data:{startAt:atKyiv('2026-09-13','20:00'),endAt:atKyiv('2026-09-13','22:00')}});
  await changeStudent(curator,{action:'ARCHIVE',groupId:'g-3-4',studentId,reason});
  assert.equal((await db.student.findUniqueOrThrow({where:{id:studentId}})).active,false);
  assert.ok(await db.attendance.findUnique({where:{studentId_lessonId:{studentId,lessonId:ongoing}}}));
  assert.equal(await db.lessonStudent.count({where:{studentId,lesson:{startAt:{gt:effectiveNow().toJSDate()}}}}),0);
  for(const actor of [curator,dean,admin,developer]){
    const state=await journal(actor,ongoing);await reject(()=>saveJournal(actor,ongoing,marks(state.lesson.version,studentId)),400);
    await saveJournal(actor,ongoing,marks(state.lesson.version,studentId,'CONFIRM',reason));
  }
  const old=await journal(teacher,ongoing);await reject(()=>saveJournal(teacher,ongoing,marks(old.lesson.version,studentId,'CONFIRM',reason)),403);
});
test('historical analytics attribute transferred and archived attendance to its original group',async()=>{
  const data=await analytics(curator,{from:'2026-09-13',to:'2026-09-14'});
  const old=data.students.find(s=>s.id===studentId&&s.groupId==='g-1-4');
  assert.equal(old?.stats.PRESENT,1);
  assert.ok(!data.students.some(s=>s.id===studentId&&s.groupId==='g-3-4'&&s.stats.PRESENT));
});

test('student accounts require elevated group scope, hide phone from teachers and keep passwords hashed',async()=>{
  const s=await db.student.findFirstOrThrow({where:{groupId:'g-1-4',isSynthetic:false}});
  await reject(()=>createStudentAccount(starosta,{studentId:s.id,email:'student.beta@test.com',reason}),403);
  const account=await createStudentAccount(curator,{studentId:s.id,email:'student.beta@test.com',reason});
  const token=await login(account.email,account.password),self=(await principalFromToken(token))!;assert.equal(self.student?.id,s.id);
  const user=await db.user.findUniqueOrThrow({where:{email:account.email}});assert.ok(await bcrypt.compare(account.password,user.passwordHash));
  await changeStudent(curator,{action:'EDIT',groupId:'g-1-4',studentId:s.id,phone:'+380987654321',reason});
  const teacherToken=await login(teacher.email,'Test1234!');
  const html=await(await fetch(base+'/students/'+s.id,{headers:{cookie:'mnau_session='+teacherToken}})).text();assert.ok(!html.includes('+380987654321'));
});
test('admin/developer account management denies disabled login, revokes sessions and enforces production lock',async()=>{
  const token=await login(starosta.email,'Test1234!');
  await adminChange(developer,{userId:starosta.id,action:'DISABLE',target:starosta.id,reason});
  assert.equal(await principalFromToken(token),null);await reject(()=>login(starosta.email,'Test1234!'),401);
  await adminChange(admin,{userId:starosta.id,action:'ENABLE',target:starosta.id,reason});
  const reset=await adminChange(admin,{userId:starosta.id,action:'RESET_PASSWORD',target:starosta.id,reason});assert.ok(reset.password);
  assert.ok(await login(starosta.email,reset.password!));
  await adminChange(admin,{userId:starosta.id,action:'RESET_BETA_PASSWORD',target:starosta.id,reason});
  const previous=process.env.APP_ENV;process.env.APP_ENV='production';
  try{await assert.rejects(()=>prepareCSBeta());await assert.rejects(()=>repairCSBeta());await assert.rejects(()=>adminChange(admin,{userId:starosta.id,action:'RESET_BETA_PASSWORD',target:starosta.id,reason}));}finally{process.env.APP_ENV=previous;}
});
test('normal seed and repeated beta preparation retain manual roster changes and account settings',async()=>{
  const before={students:await db.student.count(),users:await db.user.count(),teachers:await db.teacher.count(),attendance:await db.attendance.count()};
  const result=spawnSync(process.execPath,['--import','tsx','prisma/seed.ts'],{env:process.env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  await prepareCSBeta();
  assert.deepEqual({students:await db.student.count(),users:await db.user.count(),teachers:await db.teacher.count(),attendance:await db.attendance.count()},before);
  assert.equal((await db.student.findUniqueOrThrow({where:{id:studentId}})).active,false);
  assert.equal((await db.student.findUniqueOrThrow({where:{id:studentId}})).groupId,'g-3-4');
});
