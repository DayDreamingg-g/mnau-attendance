import {db} from './db';
import type {Principal} from './auth';
import {HttpError} from './errors';
import {parseFilters} from './filters';
import {createReport,parseReportKind,reportPeriod} from './reports';

export async function reportAutomation(user:Principal,body:Record<string,unknown>){
  const facultyId=user.deanAssignments[0]?.facultyId;
  if(!facultyId)throw new HttpError(403,'Не призначено факультет автоматизації.');
  if(body.faculty!==undefined&&body.faculty!==facultyId)throw new HttpError(403,'Машинний ключ не дозволяє інший факультет.');
  if(body.requireReady!==undefined&&typeof body.requireReady!=='boolean')throw new HttpError(400,'Некоректний параметр requireReady.');
  if(body.action==='WEEKLY_CURATORS'){
    if(body.student)throw new HttpError(400,'Тижневе зведення куратора формується за групами.');
    const filters=reportPeriod('WEEKLY',body);
    if(filters.specialty&&!await db.specialty.findFirst({where:{id:filters.specialty,facultyId}}))throw new HttpError(404,'Спеціальність поза межами факультету.');
    if(filters.group&&!await db.group.findFirst({where:{id:filters.group,specialtyId:filters.specialty,specialty:{facultyId}}}))throw new HttpError(404,'Група поза межами області звіту.');
    const assignments=await db.curatorAssignment.findMany({where:{groupId:filters.group,group:{course:filters.course,specialtyId:filters.specialty,specialty:{facultyId}},user:{active:true,roles:{some:{roleId:'CURATOR'}}}},select:{groupId:true,userId:true,user:{select:{name:true}},group:{select:{name:true}}},orderBy:[{groupId:'asc'},{userId:'asc'}]});
    // One persisted report per assigned group, even when a group has several curators.
    const groups=[...new Set(assignments.map(a=>a.groupId))];
    const reports=[];
    for(const group of groups){const result=await createReport(user,facultyId,{...filters,group},'WEEKLY',true);reports.push({...result,groupId:group,reportPath:`/reports/${result.id}`,curators:assignments.filter(a=>a.groupId===group).map(a=>({id:a.userId,name:a.user.name}))});}
    return {action:'WEEKLY_CURATORS',state:reports.some(r=>r.state==='FAILED')?'FAILED' as const:reports.some(r=>r.state==='PENDING')?'PENDING' as const:'READY' as const,reused:reports.length>0&&reports.every(r=>r.reused),reports,message:reports.length?`Сформовано зведення для ${reports.length} призначених груп.`:'Немає груп із призначеним активним куратором.'};
  }
  const alert=body.action==='ALERT70'?70:body.action==='ALERT50'?50:undefined;
  if(body.action!==undefined&&body.action!=='REPORT'&&!alert)throw new HttpError(400,'Невідома дія автоматизації.');
  const kind=alert?'DAILY':parseReportKind(body.kind);
  const defaults=alert?parseFilters({}):{};
  const filters=reportPeriod(kind,{...defaults,...body,...(alert?{threshold:alert}:{})});
  const result=await createReport(user,facultyId,filters,kind,true);
  const report=await db.report.findUniqueOrThrow({where:{id:result.id},select:{summary:true,alertKey:true}});
  const summary=report.summary as {students?:number}|null;
  return {...result,action:body.action??'REPORT',reportPath:`/reports/${result.id}`,...(alert?{threshold:alert,students:summary?.students??0,alertKey:report.alertKey,delivery:'STORED_ONLY'}:{})};
}
