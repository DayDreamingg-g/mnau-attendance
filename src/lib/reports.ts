import {teacherIdentity} from './teacher-identity';
import {scopedTeacherLabel} from './report-presentation';
import {termScope} from './terms';
import {reportFiles} from './report-files';
import {range} from './filters';
import {effectiveNow,dayOf,timeLabel} from './time';
import {betaCalendarScope} from './beta-calendar';
import {betaFilters} from './beta-ui';
import {createHash,timingSafeEqual} from 'node:crypto';
import {db} from './db';
import {analytics,type Analytics} from './analytics';
import {requireReportFaculty,groupScope,lessonScope,rosterScope} from './access';
import type {Principal} from './auth';
import {HttpError} from './errors';
import {metrics,sumCounts,emptyCounts,studentTotals} from './metrics';
import {type ReportFilters,type ReportKind,type ReportSummary} from './report-types';
import type {Prisma} from '../generated/prisma/client';
export {csvEscape} from './report-files';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');

async function reportSnapshot(user:Principal,facultyId:string,f:ReportFilters,kind:ReportKind,client:Prisma.TransactionClient) {
  requireReportFaculty(user,facultyId);
  const faculty=await client.faculty.findUnique({where:{id:facultyId}});
  if(!faculty)throw new HttpError(404,'Факультет не знайдено.');
  const filters:ReportFilters={from:f.from,to:f.to,course:f.course,faculty:facultyId,specialty:f.specialty,group:f.group,student:f.student,threshold:f.threshold,subject:f.subject,term:f.term,scope:f.scope,...(f.view?{view:f.view}:{})};
  if(kind==='SEMESTER'){const term=await client.academicTerm.findFirst({where:{id:filters.term,facultyId,confirmedAt:{not:null}}});if(!term||term.fromDate!==filters.from||term.toDate!==filters.to)throw new HttpError(400,'Період має відповідати обраному семестру.');}
  if(filters.specialty&&!await client.specialty.findFirst({where:{id:filters.specialty,facultyId}}))throw new HttpError(404,'Спеціальність поза межами факультету.');
  if(filters.group&&!await client.group.findFirst({where:{id:filters.group,specialtyId:filters.specialty,specialty:{facultyId}}}))throw new HttpError(404,'Група не належить обраній спеціальності або факультету.');
  if(filters.group&&!await client.group.findFirst({where:{AND:[{id:filters.group},groupScope(user)]}}))throw new HttpError(403,'Група поза вашою областю доступу.');
  if(!await client.group.count({where:{AND:[{specialty:{facultyId}},groupScope(user)]}}))throw new HttpError(403,'Факультет недоступний.');
  const scoped=await betaFilters(user,filters,client);Object.assign(filters,scoped);
  const all=await analytics(user,filters,client);
  if(filters.student&&!all.students.some(s=>s.id===filters.student))throw new HttpError(404,'Студент не належить обраній області звіту.');
  const selectedIds=new Set(studentTotals(all.students).filter(s=>(!filters.student||s.id===filters.student)&&(!filters.threshold||(s.stats.percentage!==null&&s.stats.percentage<filters.threshold))).map(s=>s.id));
  const students=all.students.filter(s=>s.stats.expected>0&&selectedIds.has(s.id)).sort((a,b)=>a.fullName.localeCompare(b.fullName,'uk',{sensitivity:'base',numeric:true})||a.id.localeCompare(b.id));
  const studentIds=new Set(students.map(s=>s.id));
  const groups=all.groups.filter(g=>students.some(s=>s.groupId===g.id)).map(g=>({...g,students:g.students.filter(s=>studentIds.has(s.id)),stats:metrics(sumCounts(students.filter(s=>s.groupId===g.id).map(s=>s.stats)))}));
  const specialties=all.specialties.filter(s=>groups.some(g=>g.specialtyId===s.id)).map(s=>{const sg=groups.filter(g=>g.specialtyId===s.id);return {...s,groupCount:sg.length,studentCount:sg.reduce((sum,g)=>sum+g.students.length,0),stats:metrics(sumCounts(sg.map(g=>g.stats)))};});
  const data:Analytics={...all,students,groups,specialties,stats:metrics(sumCounts(students.map(s=>s.stats))),below70:studentTotals(students).filter(s=>s.stats.below70).length,below50:studentTotals(students).filter(s=>s.stats.below50).length};
  const realStudents=students.length?await client.student.count({where:{id:{in:[...studentIds]},isSynthetic:false}}):0;
  const curatorAssignments=await client.curatorAssignment.findMany({where:{groupId:{in:groups.map(g=>g.id)},user:{active:true,roles:{some:{roleId:'CURATOR'}}}},select:{userId:true,groupId:true,user:{select:{name:true}},group:{select:{name:true}}},orderBy:[{groupId:'asc'},{userId:'asc'}]});
  const curators=curatorAssignments.map(a=>({id:a.userId,name:a.user.name,groupId:a.groupId,groupName:a.group.name}));
  const rows=students.map(s=>({id:s.id,fullName:s.fullName,groupId:s.groupId,groupName:s.groupName,course:s.course,specialtyName:s.specialtyName,stats:s.stats}));
  const scope=[faculty.name,filters.specialty?all.specialties.find(s=>s.id===filters.specialty)?.name:undefined,filters.group?all.groups.find(g=>g.id===filters.group)?.name:undefined,filters.student?all.students.find(s=>s.id===filters.student)?.fullName:undefined,filters.threshold?`Нижче ${filters.threshold}%`:undefined].filter(Boolean).join(' · ');
  // Include document labels and every exported cell, so renamed profiles cannot reuse stale files.
  const sourceLessons=await client.lesson.findMany({where:{AND:[await betaCalendarScope(client),await termScope(user,filters.term,client),lessonScope(user),{startAt:range(filters),endAt:{lte:effectiveNow().toJSDate()},cancelled:false,subjectId:filters.subject,groups:{some:{groupId:{in:groups.map(g=>g.id)}}}}]},include:{teacher:true,subject:true,roster:{where:{AND:[rosterScope(user),{studentId:{in:[...studentIds]},groupId:{in:groups.map(g=>g.id)}}]}},attendance:true},orderBy:{startAt:'asc'}});
  const details=sourceLessons.flatMap(l=>groups.filter(g=>l.roster.some(r=>r.groupId===g.id)).map(g=>{const c=emptyCounts();for(const r of l.roster.filter(r=>r.groupId===g.id)){const a=l.attendance.find(a=>a.studentId===r.studentId);if(a)c[a.statusCode]++;else c.unmarked++;}return {lessonId:l.id,groupId:g.id,group:g.name,teacher:l.teacher?teacherIdentity(l.teacher.displayName,l.teacher.position).name:'Не призначено',subject:l.subject.name,date:dayOf(l.startAt),time:timeLabel(l.startAt)+'–'+timeLabel(l.endAt),pair:l.pairNumber,onlineUrl:l.onlineUrl,stats:metrics(c)};}));
  const teacher=scopedTeacherLabel(sourceLessons.map(l=>l.teacher));
  const fingerprint=digest(JSON.stringify({kind,filters,faculty:faculty.name,rows,curators,details,teacher,synthetic:realStudents===0}));
  const summary:ReportSummary={fingerprint,scope,curators,teacher,lessons:details,lessonCount:new Set(details.map(l=>l.lessonId)).size,incompleteLessons:new Set(details.filter(l=>l.stats.unmarked>0).map(l=>l.lessonId)).size,students:new Set(students.map(s=>s.id)).size,groups:groups.length,stats:data.stats,below70:studentTotals(students).filter(s=>s.stats.below70).map(s=>({id:s.id,name:s.fullName,group:s.groupName,percentage:s.stats.percentage!,critical:s.stats.below50})),below50:data.below50,synthetic:realStudents===0,rows};
  return {data,filters,faculty,summary};
}

export async function reportPreview(user:Principal,facultyId:string,f:ReportFilters,kind:ReportKind){
  return db.$transaction(tx=>reportSnapshot(user,facultyId,f,kind,tx),{isolationLevel:'RepeatableRead',timeout:30000});
}
export async function createReport(user:Principal,facultyId:string,f:ReportFilters,kind:ReportKind,machine=false){
  const {filters,summary}=await reportPreview(user,facultyId,f,kind);
  if(!summary.groups||!summary.students||!summary.stats.expected)throw new HttpError(422,'За вибраний період даних немає. Змініть період або область звіту.');
  const key=digest(JSON.stringify({kind,...filters,createdBy:machine?'machine':user.id}));
  let report=await db.report.findUnique({where:{key}});
  const previous=report?.summary as {fingerprint?:string}|null;
  if(report?.state==='READY'&&previous?.fingerprint===summary.fingerprint)return {id:report.id,state:report.state,reused:true};
  if(report?.state==='PENDING'&&report.updatedAt.getTime()>Date.now()-5*60*1000)return {id:report.id,state:report.state,reused:true};
  if(report){const claim=await db.report.updateMany({where:{id:report.id,updatedAt:report.updatedAt},data:{state:'PENDING',error:null}});if(claim.count!==1)return {id:report.id,state:'PENDING' as const,reused:true};}
  else{try{report=await db.report.create({data:{key,facultyId,createdById:machine?null:user.id,kind,fromDate:filters.from,toDate:filters.to,filters:JSON.parse(JSON.stringify(filters)) as Prisma.InputJsonValue,state:'PENDING'}});}catch(e){const existing=await db.report.findUnique({where:{key}});if(existing)return {id:existing.id,state:existing.state,reused:true};throw e;}}
  try{
    const files=await reportFiles(summary,filters);
    await db.report.update({where:{id:report.id},data:{state:'READY',error:null,...files,alertKey:digest(key+JSON.stringify(summary.below70.map(s=>s.id).sort())),summary:JSON.parse(JSON.stringify(summary)) as Prisma.InputJsonValue}});
    await db.auditLog.create({data:{actorId:machine?null:user.id,objectType:'Report',objectId:report.id,source:machine?'REPORT_AUTOMATION':'REPORT_CREATED',details:{facultyId,from:filters.from,to:filters.to,rows:summary.stats.expected}}});
    return {id:report.id,state:'READY' as const,reused:false};
  }catch(e){const errorId=crypto.randomUUID();const context={errorId,reportId:report.id,stage:'REPORT_FILES',from:filters.from,to:filters.to,facultyId,type:e instanceof Error?e.name:'UnknownError',code:typeof e==='object'&&e&&'code' in e?String(e.code).slice(0,40):undefined};console.error(JSON.stringify(context));await db.$transaction([db.report.update({where:{id:report.id},data:{state:'FAILED',error:'Не вдалося сформувати файли. Код: '+errorId}}),db.auditLog.create({data:{actorId:machine?null:user.id,objectType:'SystemError',objectId:errorId,source:'REPORT_FAILED',details:JSON.parse(JSON.stringify(context))}})]);throw new HttpError(503,'Не вдалося сформувати звіт. Код: '+errorId);}
}
export async function machineUser(request:Request):Promise<Principal>{
  const configured=process.env.REPORT_MACHINE_TOKEN;
  if(!configured||!/^[a-f0-9]{64}$/.test(configured))throw new HttpError(503,'Машинний доступ не налаштовано.');
  const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
  if(!timingSafeEqual(Buffer.from(digest(configured),'hex'),Buffer.from(digest(supplied),'hex')))throw new HttpError(401,'Неавторизований службовий запит.');
  const faculty=await db.faculty.findUnique({where:{slug:process.env.REPORT_FACULTY_SLUG??'management'}});if(!faculty)throw new HttpError(503,'Факультет звітності не налаштовано.');
  return {id:'machine-reports',name:'Report automation',email:'',active:true,mustChangePassword:false,position:'UNSPECIFIED',workspace:null,roles:[{roleId:'DEAN_OFFICE'}],teacher:null,student:null,starostaAssignments:[],curatorAssignments:[],deanAssignments:[{facultyId:faculty.id}]};
}

export {reportPeriod,reportBody,readReportBody,parseReportKind} from './report-input';
