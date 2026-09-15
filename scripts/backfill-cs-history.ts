import 'dotenv/config';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DateTime} from 'luxon';
import {db} from '../src/lib/db';
import {verifyCSSource,expandCSCalendar} from '../src/lib/cs-schedule';
import {CS_SOURCE_GROUPS,csName} from '../src/lib/cs-structure';
import {stableId,teacherKey} from '../src/lib/cs-beta-data';
import {atKyiv,ZONE,dayOf} from '../src/lib/time';
import {metrics,emptyCounts,sumCounts} from '../src/lib/metrics';
import {assertBetaDatabase,json,operationMode} from '../src/lib/beta-operations';
import type {StatusCode} from '../src/generated/prisma/client';

export const BACKFILL={from:'2026-09-01',to:'2026-09-14',seed:'mnau-cs-september-v1',algorithm:'profile-sha256-v1',sourceHash:'1d1bb732983c0193d99940e80dd741007758925fb5e46315b39f05f15b201d6b'} as const;
const batchId='cs-history-20260901-20260914-v1';
const random=(key:string)=>createHash('sha256').update(BACKFILL.seed+':'+key).digest().readUInt32BE(0)/4294967296;
const times=[['08:30','09:50'],['10:05','11:25'],['11:55','13:15'],['13:30','14:50'],['15:05','16:25']];
const normalized=(s:string)=>s.toLocaleLowerCase('uk').replace(/\s+/g,' ').trim().replace(/\s*\.$/,'');
export async function backfillCSHistory(apply=false){
  const {cells,students}=await verifyCSSource();
  if(students.some(s=>s.source.sha256!==BACKFILL.sourceHash))throw new Error('Backfill source version is not the authorized DOCX.');
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(9152026)::text`;
    const {database,groups}=await assertBetaDatabase(tx);
    const prior=await tx.backfillBatch.findUnique({where:{id:batchId}});
    if(prior)return {mode:apply?'apply':'dry-run',database,replayed:true,changed:0,result:prior.result};
    for(const g of [...groups].sort((a,b)=>a.id.localeCompare(b.id)))await tx.$queryRaw`SELECT id FROM "Group" WHERE id=${g.id} FOR UPDATE`;
    const sourceId='roster-'+BACKFILL.sourceHash;
    const rows=await tx.rosterSourceRow.findMany({where:{sourceId},include:{student:true},orderBy:{row:'asc'}});
    if(rows.length!==128)throw new Error('Import all 128 official source rows before history generation.');
    const map=new Map(CS_SOURCE_GROUPS.map(g=>[g.id,groups.find(x=>csName(x.name)===csName(g.name))!.id]));
    const calendar=expandCSCalendar(cells.map(c=>({...c,groups:c.groups.map(g=>map.get(g)!)})),BACKFILL.from,BACKFILL.to);
    const existing=await tx.lesson.findMany({where:{startAt:{gte:atKyiv(BACKFILL.from,'00:00'),lte:atKyiv(BACKFILL.to,'23:59:59.999')},groups:{some:{groupId:{in:groups.map(g=>g.id)}}}},include:{groups:true,subject:true}});
    const teachers=await tx.teacher.findMany();
    const rank=[...rows].sort((a,b)=>random('profile:'+a.row)-random('profile:'+b.row));
    const ranks=new Map(rank.map((r,i)=>[r.studentId,i]));
    const counts=new Map(rows.map(r=>[r.studentId,emptyCounts()]));
    const skipped:{lessonId:string;reason:string}[]=[],createdLessons:string[]=[],filled:string[]=[];
    const now=DateTime.now().setZone(ZONE),currentDay=now.toISODate()!;
    const plans=[];
    for(const item of calendar){
      const atSlot=existing.filter(l=>!l.cancelled&&dayOf(l.startAt)===item.date&&l.pairNumber===item.cell.pairNumber&&l.groups.some(g=>item.groups.includes(g.groupId)));
      if(atSlot.length>1)throw new Error('Competing lessons at '+item.id+'; schedule review required.');
      const lesson=atSlot[0]??existing.find(l=>l.id===item.id);
      if(lesson&&(JSON.stringify(lesson.groups.map(g=>g.groupId).sort())!==JSON.stringify(item.groups)||normalized(lesson.subject.name)!==normalized(item.cell.subject!)))throw new Error('Schedule differs from verified PDF at '+lesson.id);
      const id=lesson?.id??item.id,startAt=atKyiv(item.date,times[item.cell.pairNumber-1][0]),endAt=atKyiv(item.date,times[item.cell.pairNumber-1][1]);
      if(lesson)await tx.$queryRaw`SELECT id FROM "Lesson" WHERE id=${id} FOR UPDATE`;
      const current=lesson?await tx.lesson.findUniqueOrThrow({where:{id},include:{term:true,attendance:true,submissions:true,auditLogs:true,roster:true}}):null;
      const term=await tx.academicTerm.findFirst({where:{facultyId:groups[0].specialty.facultyId,fromDate:{lte:item.date},toDate:{gte:item.date},confirmedAt:{not:null}}});
      let reason='';
      if(item.date>=currentDay||endAt>now.toJSDate()||current&&current.endAt>now.toJSDate())reason='CURRENT_OR_UNFINISHED';
      else if(current?.cancelled)reason='CANCELLED';
      else if(!term||term.archivedAt||current?.term?.archivedAt)reason='ARCHIVED_OR_UNCONFIRMED_TERM';
      else if(current&&(current.attendance.length||current.submissions.length||current.journalState!=='EMPTY'||current.auditLogs.some(a=>!['CS_CALENDAR_SYNC','CS_BETA_REPAIR','SEED','DEMO_SEED'].includes(a.source))))reason='MANUAL_OR_UNKNOWN_HISTORY';
      if(reason){skipped.push({lessonId:id,reason});continue;}
      const members=rows.filter(r=>item.groups.includes(r.groupId));
      // Historical membership is specific to this simulation, not joinedAt/current group.
      const marks=members.map(r=>{
        const position=ranks.get(r.studentId)!,p=position<4?.30:position<12?.58:.895;
        const value=random(item.id+':'+r.row),status:StatusCode=value<p?'PRESENT':value<p+.05?'HV':'N';
        counts.get(r.studentId)![status]++;
        return {studentId:r.studentId,groupId:r.groupId,status};
      });
      const cell=item.cell,subjectId=stableId('subject',normalized(cell.subject!));
      const resolvedTeachers=cell.teacher?teachers.filter(t=>teacherKey((t.source as {originalDisplayName?:string}|null)?.originalDisplayName??(t.source as {originalTeacher?:string;teacher?:string})?.originalTeacher??(t.source as {teacher?:string})?.teacher??t.displayName)===teacherKey(cell.teacher!)):[];
      if(cell.teacher&&resolvedTeachers.length!==1)throw new Error('Cannot resolve stable teacher provenance for '+id);
      if(current&&(current.startAt.getTime()!==startAt.getTime()||current.endAt.getTime()!==endAt.getTime()||current.teacherId!==(resolvedTeachers[0]?.id??null)))throw new Error('Untouched lesson differs from verified time/teacher grid: '+id);
      const scheduleSourceId=item.cells.length===1?cell.id:stableId('cs-shared',item.cells.map(c=>c.id).join(':'));
      const bell=await tx.bell.findFirst({where:{pairNumber:cell.pairNumber},orderBy:{id:'asc'}});
      if(!current&&(!bell||!await tx.sourceRecord.findUnique({where:{id:scheduleSourceId}})||!await tx.subject.findUnique({where:{id:subjectId}})||!await tx.building.findUnique({where:{id:cell.building!}})))throw new Error('Missing schedule dictionaries for '+id+'; explicit source review required.');
      plans.push({item,id,current,term:term!,startAt,endAt,marks,subjectId,teacherId:resolvedTeachers[0]?.id??null,scheduleSourceId,bell});
      filled.push(id);if(!current)createdLessons.push(id);
    }
    const statistics=metrics(sumCounts([...counts.values()])),individual=[...counts].map(([id,c])=>({id,...metrics(c)}));
    if(!plans.length)throw new Error('No eligible untouched historical lessons. No batch created.');
    const below70=individual.filter(s=>s.below70).length,below50=individual.filter(s=>s.below50).length;
    if(!below70||!below50)throw new Error('Actual generated results do not contain required <70% and <50% profiles; batch not applied.');
    const result={...BACKFILL,batchId,database,mode:apply?'apply':'dry-run',replayed:false,officialStudents:128,filledLessons:filled.length,createdLessons:createdLessons.length,skippedManual:skipped.filter(s=>s.reason==='MANUAL_OR_UNKNOWN_HISTORY').length,skipped,statistics,below70,below50,distribution:{PRESENT:statistics.PRESENT/statistics.marked*100,N:statistics.N/statistics.marked*100,HV:statistics.HV/statistics.marked*100},changed:statistics.marked};
    if(!apply)return result;
    await tx.backfillBatch.create({data:{id:batchId,algorithm:BACKFILL.algorithm,seed:BACKFILL.seed,fromDate:BACKFILL.from,toDate:BACKFILL.to,sourceId,parameters:{profiles:[{count:4,PRESENT:.30,N:.65,HV:.05},{count:8,PRESENT:.58,N:.37,HV:.05},{count:116,PRESENT:.895,N:.055,HV:.05}],clock:ZONE},result:json(result)}});
    for(const p of plans){
      if(!p.current){
        const cell=p.item.cell;
        await tx.lesson.create({data:{id:p.id,startAt:p.startAt,endAt:p.endAt,pairNumber:cell.pairNumber,subjectId:p.subjectId,teacherId:p.teacherId,buildingId:cell.building!,room:cell.room!,bellId:p.bell!.id,sourceId:p.scheduleSourceId,termId:p.term.id,synthetic:false,kind:p.item.groups.length>1?'Спільне заняття за розкладом':'Заняття за розкладом',weekPattern:p.item.weekPattern,groups:{create:p.item.groups.map(groupId=>({groupId}))}}});
      }
      // Locks remain held from the eligibility check through all marks and provenance.
      // Independent manual rows were rejected above; retain extra existing members unmarked.
      await tx.lessonStudent.createMany({data:p.marks.map(m=>({lessonId:p.id,studentId:m.studentId,groupId:m.groupId})),skipDuplicates:true});
      for(const m of p.marks)if(p.current?.roster.some(r=>r.studentId===m.studentId&&r.groupId!==m.groupId))await tx.lessonStudent.update({where:{lessonId_studentId:{lessonId:p.id,studentId:m.studentId}},data:{groupId:m.groupId}});
      await tx.attendance.createMany({data:p.marks.map(m=>({lessonId:p.id,studentId:m.studentId,statusCode:m.status,confirmed:true,isDemo:true,source:'BETA_BACKFILL',batchId}))});
      const expected=await tx.lessonStudent.count({where:{lessonId:p.id}});
      await tx.lesson.update({where:{id:p.id},data:{version:{increment:1},journalState:expected===p.marks.length?'CONFIRMED':'DRAFT'}});
      await tx.auditLog.create({data:{lessonId:p.id,objectType:'Lesson',objectId:p.id,source:'BETA_BACKFILL',reason:'Погоджена випадкова TEST-історія 01–14.09.2026; технічний запуск.',details:{batchId,algorithm:BACKFILL.algorithm,rows:p.marks.length}}});
    }
    await tx.auditLog.create({data:{objectType:'BackfillBatch',objectId:batchId,source:'BETA_BACKFILL',details:json(result)}});
    return result;
  },{maxWait:30000,timeout:180000});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await backfillCSHistory(operationMode()),null,2));}catch(e){console.error(e instanceof Error?e.message:'History generation failed');process.exitCode=1;}finally{await db.$disconnect();}}
