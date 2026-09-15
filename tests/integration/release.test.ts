import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {db} from '../../src/lib/db';
import {principalSelect,hashToken,login,principalFromToken,type Principal} from '../../src/lib/auth';
import {changeProfile} from '../../src/lib/profile';
import {adminRelease} from '../../src/lib/admin-release';
import {adminChange} from '../../src/lib/admin';
import {changeTerm} from '../../src/lib/terms';
import {saveJournal,journal} from '../../src/lib/journal';
import {changeOnline} from '../../src/lib/lesson-online';
import {createReport} from '../../src/lib/reports';
import {atKyiv,today} from '../../src/lib/time';
import {HttpError} from '../../src/lib/errors';
import type {ReportSummary} from '../../src/lib/report-types';
const base=process.env.TEST_BASE_URL!,origin=process.env.APP_ORIGIN!,reason='Ізольована перевірка релізу';
let admin:Principal,developer:Principal,teacher:Principal,starosta:Principal,group:string,otherGroup:string,faculty:string,subject:string,lesson:string,student:string,otherStudent:string,termId:string;
const principal=(id:string)=>db.user.findUniqueOrThrow({where:{id},select:principalSelect});
async function session(userId:string){const token=randomBytes(32).toString('hex');const s=await db.session.create({data:{userId,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+3600000),device:'Test browser'}});return {token,hash:hashToken(token),cookie:'mnau_session='+token,id:s.id};}
async function post(path:string,body:unknown,cookie:string){return fetch(base+path,{method:'POST',headers:{origin,cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});}
const rejects=(fn:()=>Promise<unknown>,status:number)=>assert.rejects(fn,e=>e instanceof HttpError&&e.status===status);
before(async()=>{
 admin=await db.user.findUniqueOrThrow({where:{email:'admin@test.com'},select:principalSelect});
 developer=await db.user.create({data:{id:randomUUID(),email:randomUUID()+'@example.invalid',name:'Release developer',mustChangePassword:false,passwordHash:'disabled',roles:{create:{roleId:'DEVELOPER'}}},select:principalSelect});
 const suffix=randomUUID();faculty='release-faculty-'+suffix;group='release-group-'+suffix;otherGroup='release-other-'+suffix;subject='release-subject-'+suffix;
 await db.faculty.create({data:{id:faculty,name:'Release fixture faculty',slug:faculty}});await db.specialty.create({data:{id:'release-specialty-'+suffix,name:'Release fixture',facultyId:faculty,source:{fixture:true}}});
 await db.group.createMany({data:[group,otherGroup].map((id,i)=>({id,name:'Release '+i+' '+suffix,course:1,specialtyId:'release-specialty-'+suffix,source:{fixture:true}}))});
 await db.subject.create({data:{id:subject,name:'Тестова дисципліна',source:{fixture:true}}});
 const created=await adminRelease(admin,{action:'CREATE_TEACHER',name:'Викладач перевірки',position:'DOCENT',email:'release-teacher-'+suffix+'@example.invalid',facultyId:faculty,groups:[group],subjects:[subject],roles:['TEACHER','CURATOR'],reason});assert.ok(created.password);
 teacher=await db.user.findUniqueOrThrow({where:{email:'release-teacher-'+suffix+'@example.invalid'},select:principalSelect});
 const temporary=await session(teacher.id);assert.equal((await post('/api/auth/logout',{},temporary.cookie)).status,200);assert.equal(await principalFromToken(temporary.token),null);
 const auth=await session(teacher.id);assert.equal((await fetch(base+'/api/lessons/missing',{headers:{cookie:auth.cookie}})).status,403);
 await changeProfile(teacher,{action:'PASSWORD',currentPassword:created.password!,newPassword:'Unique release password 123!'},auth.hash);teacher=await principal(teacher.id);
 starosta=await db.user.create({data:{id:randomUUID(),email:randomUUID()+'@example.invalid',name:'Release starosta',passwordHash:'disabled',mustChangePassword:false,roles:{create:{roleId:'STAROSTA'}},starostaAssignments:{create:{groupId:group}}},select:principalSelect});
 student='release-student-'+suffix;otherStudent='release-other-student-'+suffix;
 await db.student.createMany({data:[{id:student,groupId:group,fullName:'=FORMULA\tТестовий студент',isSynthetic:true},{id:otherStudent,groupId:otherGroup,fullName:'Інший тестовий студент',isSynthetic:true}]});
 termId=(await changeTerm(admin,{action:'CREATE',name:'Release term',facultyId:faculty,fromDate:'2026-09-01',toDate:'2026-12-31',confirm:true,reason})).id;
 await changeTerm(admin,{action:'CONFIRM_ROSTER',termId,confirm:true,reason});
 const template=await db.lesson.findFirstOrThrow();lesson='release-lesson-'+suffix;
 await db.lesson.create({data:{id:lesson,startAt:atKyiv(today(),'08:30'),endAt:atKyiv(today(),'09:50'),pairNumber:1,subjectId:subject,teacherId:teacher.teacher!.id,termId,buildingId:template.buildingId,bellId:template.bellId,room:'Тест',groups:{create:[{groupId:group},{groupId:otherGroup}]},roster:{create:[{studentId:student,groupId:group},{studentId:otherStudent,groupId:otherGroup}]}}});
});
after(async()=>{await db.$disconnect();});
test('shared journal persists across API reads and denies cross-group writes with optimistic conflicts',async()=>{
 const auth=await session(starosta.id);const before=await journal(starosta,lesson);assert.equal(before.rows.length,1);
 const payload={version:before.lesson.version,requestId:randomUUID(),mode:'AUTO',rows:[{studentId:student,status:'N'}]};
 assert.equal((await post('/api/lessons/'+lesson,payload,auth.cookie)).status,200);
 const read=await fetch(base+'/api/lessons/'+lesson,{headers:{cookie:auth.cookie}});assert.equal((await read.json()).rows[0].status,'N');
 assert.equal((await journal(teacher,lesson)).rows.find(r=>r.id===student)?.status,'N');
 await rejects(()=>saveJournal(starosta,lesson,{...payload,requestId:randomUUID(),version:1,rows:[{studentId:otherStudent,status:'PRESENT'}]}),403);
 await rejects(()=>saveJournal(teacher,lesson,{...payload,requestId:randomUUID()}),409);
});
test('profile edits preserve Teacher IDs, password changes revoke other sessions and reset uses unique temporary credentials',async()=>{
 const first=await session(teacher.id),second=await session(teacher.id),oldTeacher=teacher.teacher!.id;
 await changeProfile(teacher,{action:'PROFILE',name:'Оновлений викладач',position:'PROFESSOR'},first.hash);
 assert.equal((await principal(teacher.id)).teacher?.id,oldTeacher);assert.equal((await db.lesson.findUniqueOrThrow({where:{id:lesson}})).teacherId,oldTeacher);
 await changeProfile(teacher,{action:'PASSWORD',currentPassword:'Unique release password 123!',newPassword:'Changed release password 456!'},first.hash);
 assert.equal(await principalFromToken(second.token),null);assert.ok(await principalFromToken(first.token));
 const reset=await adminChange(admin,{action:'RESET_PASSWORD',userId:teacher.id,target:teacher.id,reason});assert.ok(reset.password);assert.equal(await principalFromToken(first.token),null);
 const stored=await db.user.findUniqueOrThrow({where:{id:teacher.id}});assert.ok(stored.mustChangePassword);assert.notEqual(stored.passwordHash,reset.password);assert.ok(await bcrypt.compare(reset.password!,stored.passwordHash));
 const token=await login(teacher.email,reset.password!,'release-password-source');await changeProfile(await principal(teacher.id),{action:'PASSWORD',currentPassword:reset.password!,newPassword:'Final release password 789!'},hashToken(token));teacher=await principal(teacher.id);
});
test('persistent progressive cooldown does not extend when retried and a different source can log in',async()=>{
 const name='absent-'+randomUUID()+'@example.invalid',source='fixture-ip-a';for(let i=0;i<4;i++)await rejects(()=>login(name,'wrong',source),401);await rejects(()=>login(name,'wrong',source),429);
 const key='login:pair:'+hashToken(source+'\0'+name),blocked=await db.loginBucket.findUniqueOrThrow({where:{key}});await rejects(()=>login(name,'wrong',source),429);assert.deepEqual((await db.loginBucket.findUniqueOrThrow({where:{key}})).blockedUntil,blocked.blockedUntil);
 assert.ok(await login(teacher.email,'Final release password 789!','fixture-ip-b'));
 await adminRelease(admin,{action:'RESET_COOLDOWN',key,reason});assert.equal((await db.loginBucket.findUniqueOrThrow({where:{key}})).strikes,0);await rejects(()=>login(name,'wrong',source),401);
});
test('feedback is stored with safe path and admin visibility; privileged pages reject direct access',async()=>{
 const auth=await session(starosta.id);const r=await post('/api/feedback',{text:'Контрольний відгук про журнал',page:'/starosta?token=secret#fragment'},auth.cookie);assert.equal(r.status,200);const result=await r.json();const feedback=await db.feedback.findUniqueOrThrow({where:{id:result.id}});assert.equal(feedback.page,'/starosta');assert.deepEqual(feedback.roles,['STAROSTA']);
 await rejects(()=>adminRelease(starosta,{action:'FEEDBACK_STATE',id:result.id,state:'RESOLVED',reason}),403);await adminRelease(admin,{action:'FEEDBACK_STATE',id:result.id,state:'RESOLVED',reason});
 const response=await fetch(base+'/admin/feedback',{headers:{cookie:auth.cookie}});assert.ok(!((await response.text()).includes('Контрольний відгук про журнал')));
});
test('online URLs enforce role, ownership, protocol and version; reports export the same snapshot',async()=>{
 const current=await db.lesson.findUniqueOrThrow({where:{id:lesson}});
 await rejects(()=>changeOnline(starosta,lesson,{onlineUrl:'https://example.com/lesson',version:current.version}),403);
 await rejects(()=>changeOnline(teacher,lesson,{onlineUrl:'javascript:alert(1)',version:current.version}),400);
 await changeOnline(teacher,lesson,{onlineUrl:'https://example.com/lesson',version:current.version});
 const report=await createReport(teacher,faculty,{from:today(),to:today(),term:termId},'DAILY');const saved=await db.report.findUniqueOrThrow({where:{id:report.id}}),summary=saved.summary as unknown as ReportSummary;assert.equal(summary.students,2);assert.equal(summary.stats.expected,2);assert.equal(summary.stats.N,1);assert.equal(summary.stats.unmarked,1);assert.equal(summary.lessons?.length,2);assert.equal(summary.lessonCount,1);assert.ok(saved.xlsx&&saved.csv&&saved.pdf);
 const auth=await session(teacher.id);for(const format of ['csv','pdf','xlsx'])assert.equal((await fetch(`${base}/api/reports/${report.id}/${format}`,{headers:{cookie:auth.cookie}})).status,200);
 const starostaAuth=await session(starosta.id);assert.equal((await fetch(`${base}/api/reports/${report.id}/csv`,{headers:{cookie:starostaAuth.cookie}})).status,404);
});
test('self elevation is blocked, retirement preserves lessons and curator role, and archived terms reject every write',async()=>{
 await rejects(()=>adminChange(admin,{action:'ADD_ROLE',userId:admin.id,target:'DEVELOPER',reason}),403);await rejects(()=>adminRelease(admin,{action:'SELF_ROLES',roles:['DEVELOPER'],confirm:true,reason}),403);
 await adminRelease(developer,{action:'SELF_ROLES',roles:['DEVELOPER','CURATOR'],confirm:true,reason});
 const future=await db.lesson.count({where:{teacherId:teacher.teacher!.id,startAt:{gt:new Date()},cancelled:false}});await adminRelease(admin,{action:'RETIRE_TEACHER',teacherId:teacher.teacher!.id,expectedFuture:future,confirm:true,reason});
 const retired=await principal(teacher.id);assert.ok(retired.roles.some(r=>r.roleId==='CURATOR'));assert.ok(!retired.roles.some(r=>r.roleId==='TEACHER'));assert.equal((await db.lesson.findUniqueOrThrow({where:{id:lesson}})).teacherId,teacher.teacher!.id);
 await changeTerm(admin,{action:'ARCHIVE',termId,confirm:true,reason});
 const state=await journal(admin,lesson);assert.ok(state.rows.every(r=>!r.editable));
 await rejects(()=>saveJournal(admin,lesson,{version:state.lesson.version,requestId:randomUUID(),mode:'AUTO',reason,rows:[{studentId:student,status:'HV'}]}),403);
 await assert.rejects(()=>db.attendance.update({where:{studentId_lessonId:{studentId:student,lessonId:lesson}},data:{statusCode:'HV'}}));
 await assert.rejects(()=>db.lessonStudent.delete({where:{lessonId_studentId:{lessonId:lesson,studentId:otherStudent}}}));
 await assert.rejects(()=>db.academicTerm.update({where:{id:termId},data:{archivedAt:null}}));
 assert.equal((await createReport(admin,faculty,{from:today(),to:today(),term:termId},'DAILY')).state,'READY');
});
