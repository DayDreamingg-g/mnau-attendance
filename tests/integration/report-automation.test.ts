import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../../src/lib/db';
import {machineUser} from '../../src/lib/reports';
import {reportAutomation} from '../../src/lib/report-automation';
import type {Principal} from '../../src/lib/auth';
import type {ReportSummary} from '../../src/lib/report-types';
import {HttpError} from '../../src/lib/errors';
import {today,atKyiv} from '../../src/lib/time';
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3001';
const group='test-automation-group',specialty='test-automation-specialty',curator='test-automation-curator';
let machine:Principal;
const period=()=>({from:today(),to:today(),group});
before(async()=>{
  machine=await machineUser(new Request(`${base}/api/machine/reports`,{headers:{authorization:`Bearer ${process.env.REPORT_MACHINE_TOKEN}`}}));
  await db.specialty.create({data:{id:specialty,name:'Тест автоматизації звітів',facultyId:machine.deanAssignments[0].facultyId,source:{test:true}}});
  await db.group.create({data:{id:group,name:'TEST-AUTOMATION',course:1,specialtyId:specialty,source:{test:true}}});
  await db.student.create({data:{id:'test-automation-student',fullName:'Тестовий Студент Автоматизації',groupId:group}});
  await db.user.create({data:{id:curator,email:'automation-curator@test.com',name:'Тестовий Куратор Автоматизації',mustChangePassword:false,passwordHash:'disabled-test-login',roles:{create:{roleId:'CURATOR'}},curatorAssignments:{create:{groupId:group}}}});
  const source=await db.lesson.findFirstOrThrow();await db.lesson.create({data:{id:'test-automation-lesson',startAt:atKyiv(today(),'08:30'),endAt:atKyiv(today(),'09:50'),pairNumber:1,subjectId:source.subjectId,buildingId:source.buildingId,bellId:source.bellId,room:source.room,groups:{create:{groupId:group}},roster:{create:{studentId:'test-automation-student'}}}});
  await db.attendance.create({data:{lessonId:'test-automation-lesson',studentId:'test-automation-student',statusCode:'N',confirmed:true}});
});
after(async()=>{await db.$disconnect();});
test('weekly automation uses actual curator assignments and deduplicates reports per group',async()=>{
  const result=await reportAutomation(machine,{action:'WEEKLY_CURATORS',...period()});assert.equal(result.state,'READY');assert.ok(result.reports);assert.equal(result.reports.length,1);assert.equal(result.reports[0].curators[0].id,curator);
  const repeat=await reportAutomation(machine,{action:'WEEKLY_CURATORS',...period()});assert.ok(repeat.reports);assert.equal(repeat.reports[0].id,result.reports[0].id);assert.equal(repeat.reused,true);
  const record=await db.report.findUniqueOrThrow({where:{id:result.reports[0].id}});assert.equal((record.summary as unknown as ReportSummary).curators?.[0].id,curator);
  await db.userRole.delete({where:{userId_roleId:{userId:curator,roleId:'CURATOR'}}});
  const removed=await reportAutomation(machine,{action:'WEEKLY_CURATORS',...period()});assert.ok(removed.reports);assert.equal(removed.reports.length,0);
});
test('threshold alerts persist separate deduplicated snapshots without any delivery',async()=>{
  const first=await reportAutomation(machine,{action:'ALERT70',...period()}),critical=await reportAutomation(machine,{action:'ALERT50',...period()});assert.ok('id' in first&&'id' in critical);assert.notEqual(first.id,critical.id);assert.equal(first.students,1);assert.equal(critical.students,1);assert.equal(first.delivery,'STORED_ONLY');
  const repeated=await reportAutomation(machine,{action:'ALERT70',...period()});assert.ok('id' in repeated);assert.equal(repeated.id,first.id);assert.equal(repeated.reused,true);
  await assert.rejects(()=>reportAutomation(machine,{kind:'DAILY',faculty:'faculty-accounting-finance'}),e=>e instanceof HttpError&&e.status===403);
  await assert.rejects(()=>reportAutomation(machine,{action:'UNKNOWN'}),e=>e instanceof HttpError&&e.status===400);
});
test('machine API rejects malformed JSON and returns retriable503 for an active generation lease',async()=>{
  const headers={authorization:`Bearer ${process.env.REPORT_MACHINE_TOKEN}`,'Content-Type':'application/json'};
  const bad=await fetch(`${base}/api/machine/reports`,{method:'POST',headers,body:'{invalid'});assert.equal(bad.status,400);
  const result=await reportAutomation(machine,{kind:'DAILY',...period()});assert.ok('id' in result);
  await db.report.update({where:{id:result.id},data:{state:'PENDING'}});
  const pending=await fetch(`${base}/api/machine/reports`,{method:'POST',headers,body:JSON.stringify({kind:'DAILY',...period(),requireReady:true})});assert.equal(pending.status,503);assert.equal(pending.headers.get('retry-after'),'5');assert.equal((await pending.json()).state,'PENDING');
  await db.report.update({where:{id:result.id},data:{state:'READY'}});
});
