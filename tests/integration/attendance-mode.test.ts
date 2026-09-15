import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {DateTime} from 'luxon';
import {db} from '../../src/lib/db';
import {principalSelect,hashToken,type Principal} from '../../src/lib/auth';
import {journal,saveJournal} from '../../src/lib/journal';
import {createReport} from '../../src/lib/reports';
import {changeTerm} from '../../src/lib/terms';
import {atKyiv,today} from '../../src/lib/time';
import {HttpError} from '../../src/lib/errors';
import type {ReportSummary} from '../../src/lib/report-types';
let admin:Principal,teacher:Principal,starosta:Principal,curator:Principal,faculty:string,lesson:string,term:string,students:string[],lateLesson:string;
const base=process.env.TEST_BASE_URL!,origin=process.env.APP_ORIGIN!,reason='Перевірка формату присутності';
const reject=(fn:()=>Promise<unknown>,status:number)=>assert.rejects(fn,e=>e instanceof HttpError&&e.status===status);
async function cookie(user:Principal){const token=randomBytes(32).toString('hex');await db.session.create({data:{userId:user.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+3600000)}});return 'mnau_session='+token;}
async function save(user:Principal,status:'PRESENT'|'N'|'HV'|null,attendanceMode?:'ONLINE'|'OFFLINE'|null,id=lesson){const state=await journal(user,id);return saveJournal(user,id,{version:state.lesson.version,requestId:randomUUID(),mode:'AUTO',reason,rows:[{studentId:students[0],status,attendanceMode}]});}
before(async()=>{
  admin=await db.user.findUniqueOrThrow({where:{email:'admin@test.com'},select:principalSelect});const key='mode-'+randomUUID();faculty=key;
  await db.faculty.create({data:{id:faculty,slug:faculty,name:'Ізольований факультет ON/OFF'}});
  await db.specialty.create({data:{id:key,name:'Формат присутності',facultyId:faculty,source:{fixture:true}}});
  await db.group.create({data:{id:key,name:'ON/OFF 1',course:1,specialtyId:key,source:{fixture:true}}});
  const userData=(name:string)=>({email:randomUUID()+'@example.invalid',name,passwordHash:'disabled',mustChangePassword:false});
  teacher=await db.user.create({data:{...userData('Тестовий викладач'),roles:{create:{roleId:'TEACHER'}},teacher:{create:{id:key,displayName:'Тестовий викладач',source:{fixture:true}}}},select:principalSelect});
  starosta=await db.user.create({data:{...userData('Тестовий староста'),roles:{create:{roleId:'STAROSTA'}},starostaAssignments:{create:{groupId:key}}},select:principalSelect});
  curator=await db.user.create({data:{...userData('Тестовий куратор'),roles:{create:{roleId:'CURATOR'}},curatorAssignments:{create:{groupId:key}}},select:principalSelect});
  students=[0,1,2,3].map(i=>key+'-'+i);await db.student.createMany({data:students.map((id,i)=>({id,groupId:key,fullName:'Тестовий студент '+i,isSynthetic:true}))});
  term=(await changeTerm(admin,{action:'CREATE',name:'ON/OFF term',facultyId:faculty,fromDate:'2026-09-01',toDate:'2026-12-31'})).id;
  await changeTerm(admin,{action:'CONFIRM_ROSTER',termId:term,confirm:true,reason});
  const template=await db.lesson.findFirstOrThrow();lesson=key;lateLesson=key+'-late';
  // Keep these manually constructed lessons outside the separate demo-generator test scope.
  for(const [id,date] of [[lesson,today()],[lateLesson,DateTime.fromISO(today()).minus({days:1}).toISODate()!]])await db.lesson.create({data:{id,synthetic:false,startAt:atKyiv(date,'08:30'),endAt:atKyiv(date,'09:50'),pairNumber:1,termId:term,subjectId:template.subjectId,teacherId:teacher.teacher!.id,buildingId:template.buildingId,bellId:template.bellId,room:'ON/OFF',groups:{create:{groupId:key}},roster:{create:students.map(studentId=>({studentId,groupId:key}))}}});
  await db.attendance.create({data:{studentId:students[0],lessonId:lesson,statusCode:'PRESENT',confirmed:true}});
});
after(async()=>{await db.$disconnect();});
test('old null modes, teacher/starosta shared writes, mode-only audit, replay and stale versions',async()=>{
  assert.equal((await journal(starosta,lesson)).rows[0].attendanceMode,null);
  const result=await save(starosta,'PRESENT','ONLINE');assert.equal(result.rows[0].attendanceMode,'ONLINE');
  const auth=await cookie(teacher);const response=await fetch(base+'/api/lessons/'+lesson,{headers:{cookie:auth}});assert.equal((await response.json()).rows[0].attendanceMode,'ONLINE');
  const requestId=randomUUID(),payload={version:result.version,requestId,mode:'AUTO',rows:[{studentId:students[0],status:'PRESENT',attendanceMode:'OFFLINE'}]};
  const post=()=>fetch(base+'/api/lessons/'+lesson,{method:'POST',headers:{origin,cookie:auth,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.equal((await post()).status,200);const count=await db.auditLog.count({where:{lessonId:lesson}});assert.equal((await (await post()).json()).replayed,true);assert.equal(await db.auditLog.count({where:{lessonId:lesson}}),count);
  assert.equal((await journal(starosta,lesson)).rows[0].attendanceMode,'OFFLINE');
  const audit=await db.auditLog.findFirstOrThrow({where:{lessonId:lesson,details:{path:['requestId'],equals:requestId}}});assert.equal(audit.oldStatus,'PRESENT');assert.equal(audit.newStatus,'PRESENT');assert.deepEqual([Reflect.get(audit.details as object,'oldAttendanceMode'),Reflect.get(audit.details as object,'newAttendanceMode')],['ONLINE','OFFLINE']);
  await reject(()=>saveJournal(starosta,lesson,{...payload,requestId:randomUUID()}),409);
  await save(teacher,'PRESENT');assert.equal((await journal(starosta,lesson)).rows[0].attendanceMode,'OFFLINE');
  await save(teacher,'PRESENT',null);assert.equal((await journal(starosta,lesson)).rows[0].attendanceMode,null);
});
test('invalid N/HV modes fail atomically and database constraint prevents bypass',async()=>{
  const before=await db.lesson.findUniqueOrThrow({where:{id:lesson}}),count=await db.auditLog.count({where:{lessonId:lesson}});
  await reject(()=>save(starosta,'N','ONLINE'),400);await reject(()=>save(teacher,'HV','OFFLINE'),400);
  assert.equal((await db.lesson.findUniqueOrThrow({where:{id:lesson}})).version,before.version);assert.equal(await db.auditLog.count({where:{lessonId:lesson}}),count);
  await assert.rejects(()=>db.attendance.update({where:{studentId_lessonId:{studentId:students[0],lessonId:lesson}},data:{statusCode:'N',attendanceMode:'ONLINE'}}));
  for(const status of ['N','HV',null] as const){await save(teacher,'PRESENT','ONLINE');const result=await save(starosta,status);assert.equal(result.rows[0].attendanceMode,null);assert.equal(result.rows[0].status,status);}
});
test('late mode correction retains curator reason and teacher time restrictions',async()=>{
  await reject(()=>save(teacher,'PRESENT','ONLINE',lateLesson),403);
  const state=await journal(curator,lateLesson);await reject(()=>saveJournal(curator,lateLesson,{version:state.lesson.version,requestId:randomUUID(),mode:'AUTO',rows:[{studentId:students[0],status:'PRESENT',attendanceMode:'ONLINE'}]}),400);
  await save(curator,'PRESENT','ONLINE',lateLesson);const audit=await db.auditLog.findFirstOrThrow({where:{lessonId:lateLesson}});assert.equal(audit.source,'AUTHORIZED_CORRECTION');assert.equal(audit.reason,reason);
});
test('student and lesson snapshots count mode refinements once and every format downloads',async()=>{
  const state=await journal(teacher,lesson);await saveJournal(teacher,lesson,{version:state.lesson.version,requestId:randomUUID(),mode:'AUTO',rows:students.map((studentId,i)=>({studentId,status:i===3?'N':'PRESENT',attendanceMode:i===0?'ONLINE':i===1?'OFFLINE':null}))});
  const auth=await cookie(teacher);
  for(const view of ['STUDENTS','LESSONS'] as const){
    const report=await createReport(teacher,faculty,{from:today(),to:today(),view,term},'CUSTOM');const saved=await db.report.findUniqueOrThrow({where:{id:report.id}}),summary=saved.summary as unknown as ReportSummary;
    assert.deepEqual([summary.stats.PRESENT,summary.stats.ONLINE,summary.stats.OFFLINE,summary.stats.expected,summary.stats.percentage],[3,1,1,4,75]);
    assert.deepEqual(summary.lessons![0].stats,summary.stats);assert.equal(summary.rows.reduce((n,r)=>n+(r.stats.ONLINE??0),0),1);assert.equal(summary.rows.reduce((n,r)=>n+(r.stats.OFFLINE??0),0),1);
    const csv=Buffer.from(saved.csv!).toString();assert.ok(csv.includes('Онлайн'));assert.ok(csv.includes('Офлайн'));assert.ok(Buffer.from(saved.xlsx!).includes(Buffer.from('Онлайн')));
    const html=await (await fetch(base+'/reports/'+report.id,{headers:{cookie:auth}})).text();assert.ok(html.includes('Офлайн'));assert.ok(html.includes('Онлайн'));
    for(const format of ['pdf','csv','xlsx'] as const){const response=await fetch(base+'/api/reports/'+report.id+'/'+format,{headers:{cookie:auth}});assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from(saved[format]!));}
  }
});
test('archived term blocks mode-only writes through journal and direct SQL updates',async()=>{
  await changeTerm(admin,{action:'ARCHIVE',termId:term,confirm:true,reason});
  await reject(()=>save(admin,'PRESENT','OFFLINE'),403);
  await assert.rejects(()=>db.attendance.update({where:{studentId_lessonId:{studentId:students[0],lessonId:lesson}},data:{attendanceMode:'OFFLINE'}}));
});
