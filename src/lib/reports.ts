import {createHash,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {db} from './db';
import {analytics,type Analytics} from './analytics';
import {requireReportFaculty} from './access';
import type {Principal} from './auth';
import {HttpError} from './errors';
import type {Filters} from './filters';
import {percent,metrics,sumCounts} from './metrics';
import {reportKindLabels,type ReportFilters,type ReportKind,type ReportSummary} from './report-types';
import type {Prisma} from '../generated/prisma/client';
export function csvEscape(value:unknown){let text=String(value??'');if(/^[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
function csv(data:Analytics,f:Filters){const head=['Період від','Період до','Група','Курс','ПІБ','PRESENT','N','HV','Не відмічено','Чернетки','Показник без поважних пропусків','Нижче 70%','Нижче 50%'];const rows=data.students.map(s=>[f.from,f.to,s.groupName,s.course,s.fullName,s.stats.PRESENT,s.stats.N,s.stats.HV,s.stats.unmarked,s.stats.pending,s.stats.percentage===null?'Немає даних':s.stats.percentage.toFixed(4),s.stats.below70?'Так':'Ні',s.stats.below50?'Так':'Ні']);return Buffer.from('\ufeff'+[head,...rows].map(r=>r.map(csvEscape).join(';')).join('\r\n'),'utf8');}
async function pdf(data:Analytics,f:ReportFilters,facultyName:string,kind:ReportKind,synthetic:boolean){
  const doc=await PDFDocument.create();doc.registerFontkit(fontkit);const font=await doc.embedFont(await readFile(path.join(process.cwd(),'public/fonts/DejaVuSans.ttf')),{subset:true});
  doc.setTitle(`MNAU Attendance · ${f.from}–${f.to}`);doc.setAuthor('MNAU Attendance');
  const students=[...data.students].sort((a,b)=>(a.stats.percentage??Infinity)-(b.stats.percentage??Infinity));
  const columns=[30,244,306,344,375,406,437,501,560];
  const widths=[208,58,34,29,29,29,60,55,239];
  const maxRows=22;const pageCount=Math.max(1,Math.ceil(students.length/maxRows));
  for(let pageIndex=0;pageIndex<pageCount;pageIndex++){
    const page=doc.addPage([842,595]);
    const draw=(value:string,x:number,y:number,size=9,color=rgb(.12,.17,.26))=>page.drawText(value,{x,y,size,font,color});
    draw('MNAU Attendance',30,562,20);draw(reportKindLabels[kind],30,539,12);
    draw(`${facultyName} · ${f.from} — ${f.to}${f.course?` · ${f.course} курс`:''}`,30,520,10);
    draw(`Студенти: ${data.students.length} · Нижче 70%: ${data.below70} (включно з ${data.below50} нижче 50%) · Показник: ${percent(data.stats.percentage)}`,30,500,9);
    page.drawRectangle({x:30,y:464,width:782,height:24,color:rgb(.92,.93,.97)});
    ['ПІБ','Група','Курс','•','N','HV','Без відм.','Чернетки','Показник / увага'].forEach((v,i)=>draw(v,columns[i]+3,473,8));
    let y=450;
    const fit=(value:string,width:number)=>{let v=value;while(font.widthOfTextAtSize(v,8)>width&&v.length>1)v=v.slice(0,-1);return v===value?v:v.slice(0,-1)+'…';};
    for(const s of students.slice(pageIndex*maxRows,(pageIndex+1)*maxRows)){
      const vals=[s.fullName,s.groupName,String(s.course),String(s.stats.PRESENT),String(s.stats.N),String(s.stats.HV),String(s.stats.unmarked),String(s.stats.pending),`${percent(s.stats.percentage)}${s.stats.below50?' · Критичний <50%':s.stats.below70?' · Увага <70%':''}`];
      vals.forEach((v,i)=>draw(fit(v,widths[i]),columns[i]+3,y,8,i===8&&s.stats.below50?rgb(.68,.15,.2):rgb(.12,.17,.26)));
      page.drawLine({start:{x:30,y:y-6},end:{x:812,y:y-6},thickness:.35,color:rgb(.86,.88,.92)});y-=16;
    }
    if(!students.length)draw('За обраними фільтрами студентів немає.',33,440,10);
    draw('PRESENT / (PRESENT + N) × 100. HV виключено; відсутність даних не дорівнює 100%.',30,65,8);
    draw(`Підтверджені відмітки завершених нескасованих занять.${synthetic?' Синтетичні дані.':''} Не офіційний документ МНАУ.`,30,49,8);
    draw(`Сторінка ${pageIndex+1} / ${pageCount}`,720,28,8);
  }
  return new Uint8Array(await doc.save());
}
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');

export async function reportPreview(user:Principal,facultyId:string,f:ReportFilters,kind:ReportKind) {
  requireReportFaculty(user,facultyId);
  const faculty=await db.faculty.findUnique({where:{id:facultyId}});
  if(!faculty)throw new HttpError(404,'Факультет не знайдено.');
  const filters:ReportFilters={from:f.from,to:f.to,course:f.course,faculty:facultyId,specialty:f.specialty,group:f.group,student:f.student,threshold:f.threshold};
  if(filters.specialty&&!await db.specialty.findFirst({where:{id:filters.specialty,facultyId}}))throw new HttpError(404,'Спеціальність поза межами факультету.');
  if(filters.group&&!await db.group.findFirst({where:{id:filters.group,specialtyId:filters.specialty,specialty:{facultyId}}}))throw new HttpError(404,'Група не належить обраній спеціальності або факультету.');
  if(filters.student&&!await db.student.findFirst({where:{id:filters.student,groupId:filters.group,group:{specialtyId:filters.specialty,specialty:{facultyId}}}}))throw new HttpError(404,'Студент не належить обраній області звіту.');
  const all=await analytics(user,filters);
  const students=all.students.filter(s=>(!filters.student||s.id===filters.student)&&(!filters.threshold||(s.stats.percentage!==null&&s.stats.percentage<filters.threshold))).sort((a,b)=>a.fullName.localeCompare(b.fullName,'uk',{sensitivity:'base',numeric:true})||a.id.localeCompare(b.id));
  const studentIds=new Set(students.map(s=>s.id));
  const groups=all.groups.filter(g=>students.some(s=>s.groupId===g.id)).map(g=>({...g,students:g.students.filter(s=>studentIds.has(s.id)),stats:metrics(sumCounts(students.filter(s=>s.groupId===g.id).map(s=>s.stats)))}));
  const specialties=all.specialties.filter(s=>groups.some(g=>g.specialtyId===s.id)).map(s=>{const sg=groups.filter(g=>g.specialtyId===s.id);return {...s,groupCount:sg.length,studentCount:sg.reduce((sum,g)=>sum+g.students.length,0),stats:metrics(sumCounts(sg.map(g=>g.stats)))};});
  const data:Analytics={...all,students,groups,specialties,stats:metrics(sumCounts(students.map(s=>s.stats))),below70:students.filter(s=>s.stats.below70).length,below50:students.filter(s=>s.stats.below50).length};
  const realStudents=students.length?await db.student.count({where:{id:{in:[...studentIds]},isSynthetic:false}}):0;
  const curatorAssignments=await db.curatorAssignment.findMany({where:{groupId:{in:groups.map(g=>g.id)},user:{active:true,roles:{some:{roleId:'CURATOR'}}}},select:{userId:true,groupId:true,user:{select:{name:true}},group:{select:{name:true}}},orderBy:[{groupId:'asc'},{userId:'asc'}]});
  const curators=curatorAssignments.map(a=>({id:a.userId,name:a.user.name,groupId:a.groupId,groupName:a.group.name}));
  const rows=students.map(s=>({id:s.id,fullName:s.fullName,groupId:s.groupId,groupName:s.groupName,course:s.course,specialtyName:s.specialtyName,stats:s.stats}));
  const scope=[faculty.name,filters.specialty?all.specialties.find(s=>s.id===filters.specialty)?.name:undefined,filters.group?all.groups.find(g=>g.id===filters.group)?.name:undefined,filters.student?all.students.find(s=>s.id===filters.student)?.fullName:undefined,filters.threshold?`Нижче ${filters.threshold}%`:undefined].filter(Boolean).join(' · ');
  // Include document labels and every exported cell, so renamed profiles cannot reuse stale files.
  const fingerprint=digest(JSON.stringify({kind,filters,faculty:faculty.name,rows,curators,synthetic:realStudents===0}));
  const summary:ReportSummary={fingerprint,scope,curators,students:students.length,groups:groups.length,stats:data.stats,below70:students.filter(s=>s.stats.below70).map(s=>({id:s.id,name:s.fullName,group:s.groupName,percentage:s.stats.percentage!,critical:s.stats.below50})),below50:data.below50,synthetic:realStudents===0,rows};
  return {data,filters,faculty,summary};
}

export async function createReport(user:Principal,facultyId:string,f:ReportFilters,kind:ReportKind,machine=false){
  const {data,filters,faculty,summary}=await reportPreview(user,facultyId,f,kind);
  const key=digest(JSON.stringify({kind,...filters}));
  let report=await db.report.findUnique({where:{key}});
  const previous=report?.summary as {fingerprint?:string}|null;
  if(report?.state==='READY'&&previous?.fingerprint===summary.fingerprint)return {id:report.id,state:report.state,reused:true};
  if(report?.state==='PENDING'&&report.updatedAt.getTime()>Date.now()-5*60*1000)return {id:report.id,state:report.state,reused:true};
  if(report){const claim=await db.report.updateMany({where:{id:report.id,updatedAt:report.updatedAt},data:{state:'PENDING',error:null}});if(claim.count!==1)return {id:report.id,state:'PENDING' as const,reused:true};}
  else{try{report=await db.report.create({data:{key,facultyId,createdById:machine?null:user.id,kind,fromDate:filters.from,toDate:filters.to,filters:JSON.parse(JSON.stringify(filters)) as Prisma.InputJsonValue,state:'PENDING'}});}catch(e){const existing=await db.report.findUnique({where:{key}});if(existing)return {id:existing.id,state:existing.state,reused:true};throw e;}}
  try{
    const csvBytes=csv(data,filters),pdfBytes=await pdf(data,filters,faculty.name,kind,summary.synthetic);
    await db.report.update({where:{id:report.id},data:{state:'READY',error:null,csv:csvBytes,pdf:pdfBytes,alertKey:digest(key+JSON.stringify(summary.below70.map(s=>s.id).sort())),summary:JSON.parse(JSON.stringify(summary)) as Prisma.InputJsonValue}});
    return {id:report.id,state:'READY' as const,reused:false};
  }catch(e){await db.report.update({where:{id:report.id},data:{state:'FAILED',error:'Не вдалося сформувати файли. Повторіть запуск.'}});throw e;}
}
export async function machineUser(request:Request):Promise<Principal>{
  const configured=process.env.REPORT_MACHINE_TOKEN;
  if(!configured||!/^[a-f0-9]{64}$/.test(configured))throw new HttpError(503,'Машинний доступ не налаштовано.');
  const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
  if(!timingSafeEqual(Buffer.from(digest(configured),'hex'),Buffer.from(digest(supplied),'hex')))throw new HttpError(401,'Неавторизований службовий запит.');
  const faculty=await db.faculty.findUnique({where:{slug:process.env.REPORT_FACULTY_SLUG??'management'}});if(!faculty)throw new HttpError(503,'Факультет звітності не налаштовано.');
  return {id:'machine-reports',name:'Report automation',email:'',active:true,roles:[{roleId:'DEAN_OFFICE'}],teacher:null,student:null,starostaAssignments:[],curatorAssignments:[],deanAssignments:[{facultyId:faculty.id}]};
}

export {reportPeriod,reportBody,readReportBody,parseReportKind} from './report-input';
