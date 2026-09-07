import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {db} from '../../src/lib/db';
import {hashToken,principalSelect,type Principal} from '../../src/lib/auth';
import {createReport,reportPreview,reportPeriod} from '../../src/lib/reports';
import type {ReportSummary} from '../../src/lib/report-types';
import {HttpError} from '../../src/lib/errors';
import {atKyiv,today} from '../../src/lib/time';
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3001';
const origin=process.env.APP_ORIGIN??'http://localhost:3000';
const faculty='faculty-management',specialty='test-report-specialty',group='test-report-group',student='test-report-student';
let admin:Principal,dean:Principal,teacher:Principal,cookie:string,teacherCookie:string;
const filters=()=>({...reportPeriod('DAILY',{}),specialty,group,student});
async function session(user:Principal){const token=randomBytes(32).toString('hex');await db.session.create({data:{tokenHash:hashToken(token),userId:user.id,expiresAt:new Date(Date.now()+3600000)}});return `mnau_session=${token}`;}
before(async()=>{
  [admin,dean,teacher]=await Promise.all(['admin@test.com','dean@test.com','teacher@test.com'].map(email=>db.user.findUniqueOrThrow({where:{email},select:principalSelect})));
  [cookie,teacherCookie]=await Promise.all([session(admin),session(teacher)]);
  await db.specialty.create({data:{id:specialty,facultyId:faculty,name:'Тестова область звітності',source:{test:true}}});
  await db.group.create({data:{id:group,specialtyId:specialty,name:'TEST-REPORT',course:1,source:{test:true}}});
  await db.student.createMany({data:[{id:student,fullName:'Тестовий Студент Звіту',groupId:group},{id:'test-report-other-student',fullName:'Інший Студент Звіту',groupId:group}]});
  const reference=await db.lesson.findFirstOrThrow();
  await db.lesson.create({data:{id:'test-report-lesson',startAt:atKyiv(today(),'08:30'),endAt:atKyiv(today(),'09:50'),pairNumber:1,subjectId:reference.subjectId,buildingId:reference.buildingId,bellId:reference.bellId,room:reference.room,synthetic:true,groups:{create:{groupId:group}},roster:{create:[{studentId:student},{studentId:'test-report-other-student'}]}}});
  await db.attendance.createMany({data:[{lessonId:'test-report-lesson',studentId:student,statusCode:'N',confirmed:true},{lessonId:'test-report-lesson',studentId:'test-report-other-student',statusCode:'PRESENT',confirmed:true}]});
});
after(async()=>{await db.$disconnect();});
test('preview has exact student/group raw counts and produces no persisted report',async()=>{
  const where={kind:'WEEKLY',filters:{path:['group'],equals:group}};const count=await db.report.count({where});
  const single=await reportPreview(dean,faculty,filters(),'WEEKLY');
  assert.equal(single.summary.students,1);assert.equal(single.summary.stats.N,1);assert.equal(single.summary.stats.PRESENT,0);assert.equal(single.summary.stats.percentage,0);
  const all=await reportPreview(dean,faculty,{...filters(),student:undefined},'WEEKLY');
  assert.equal(all.summary.students,2);assert.equal(all.summary.stats.percentage,50);assert.equal(all.summary.below50,1);
  assert.equal(await db.report.count({where}),count);
  const r=await fetch(`${base}/api/reports/preview?${new URLSearchParams({faculty,kind:'WEEKLY',from:today(),to:today(),group,student})}`,{headers:{cookie}});
  assert.equal(r.status,200);assert.equal((await r.json()).summary.students,1);
});
test('report scope rejects mismatched hierarchy and unauthorized previews/downloads',async()=>{
  const foreign=await db.student.findFirstOrThrow({where:{groupId:{not:group}}});
  await assert.rejects(()=>reportPreview(dean,faculty,{...filters(),student:foreign.id},'DAILY'),e=>e instanceof HttpError&&e.status===404);
  await assert.rejects(()=>reportPreview(dean,faculty,{...filters(),specialty:'missing-specialty'},'DAILY'),e=>e instanceof HttpError&&e.status===404);
  await assert.rejects(()=>createReport(teacher,faculty,filters(),'DAILY'),e=>e instanceof HttpError&&e.status===403);
  const r=await fetch(`${base}/api/reports/preview?faculty=${faculty}&kind=DAILY`,{headers:{cookie:teacherCookie}});assert.equal(r.status,403);
  const noauth=await fetch(`${base}/api/reports/preview?faculty=${faculty}&kind=DAILY`);assert.equal(noauth.status,401);
});
test('weekly report is deduplicated concurrently, refreshes renamed cells and exports exactly the chosen student',async()=>{
  const [a,b]=await Promise.all([createReport(admin,faculty,filters(),'WEEKLY'),createReport(admin,faculty,filters(),'WEEKLY')]);
  assert.equal(a.id,b.id);const ready=await db.report.findUniqueOrThrow({where:{id:a.id}});assert.equal(ready.state,'READY');
  assert.equal((await createReport(admin,faculty,filters(),'WEEKLY')).reused,true);
  await db.student.update({where:{id:student},data:{fullName:'Оновлене Ім’я Студента'}});
  const updated=await createReport(admin,faculty,filters(),'WEEKLY');assert.equal(updated.id,a.id);assert.equal(updated.reused,false);
  const record=await db.report.findUniqueOrThrow({where:{id:a.id}});const summary=record.summary as unknown as ReportSummary;assert.equal(summary.rows[0].fullName,'Оновлене Ім’я Студента');assert.equal(summary.students,1);
  const csv=await fetch(`${base}/api/reports/${a.id}/csv`,{headers:{cookie}});assert.equal(csv.status,200);const bytes=Buffer.from(await csv.arrayBuffer());assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf');const text=bytes.toString('utf8');assert.equal(text.split('\r\n').length,2);assert.ok(text.includes('Оновлене Ім’я Студента'));
  const pdf=await fetch(`${base}/api/reports/${a.id}/pdf`,{headers:{cookie}});assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
  assert.equal((await fetch(`${base}/api/reports/${a.id}/pdf`,{headers:{cookie:teacherCookie}})).status,404);
  const api=await fetch(`${base}/api/reports`,{method:'POST',headers:{cookie,origin,'Content-Type':'application/json'},body:JSON.stringify({kind:'WEEKLY',faculty,...filters()})});assert.equal(api.status,200);assert.equal((await api.json()).id,a.id);
});
