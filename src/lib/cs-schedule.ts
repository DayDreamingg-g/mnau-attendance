import {DateTime} from 'luxon';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readCSData,stableId,teacherKey,type CSCell} from './cs-beta-data';
import {CS_SOURCE_GROUPS,csName,resolveCSGroups} from './cs-structure';
import {scheduleWeek,SCHEDULE_WEEK_BASE} from './schedule-week';
import {atKyiv,ZONE,effectiveNow} from './time';
import {journalStateFromCounts} from './journal-state';
import type {Prisma} from '../generated/prisma/client';

const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const bells=[['08:30','09:50'],['10:05','11:25'],['11:55','13:15'],['13:30','14:50'],['15:05','16:25']];
const subjectKey=(value:string)=>value.toLocaleLowerCase('uk').replace(/\s+/g,' ').trim().replace(/\s*\.$/,'');
export async function verifyCSSource(){
  const data=await readCSData();
  for(const file of new Set(data.cells.map(c=>c.file))){
    const hash=createHash('sha256').update(await readFile('source-data/cs-beta/'+file)).digest('hex');
    if(data.cells.some(c=>c.file===file&&c.sha256!==hash))throw new Error('PDF checksum differs from extracted data: '+file+'. Run scripts/extract-cs-beta.py.');
  }
  return data;
}
export function expandCSCalendar(cells:CSCell[],from='2026-09-01',to='2027-01-31'){
  const first=DateTime.fromISO(from,{zone:ZONE}),last=DateTime.fromISO(to,{zone:ZONE});
  if(!first.isValid||!last.isValid||first>last||last.diff(first,'days').days>220)throw new Error('Invalid semester range.');
  const result:{id:string;date:string;cells:CSCell[];groups:string[];cell:CSCell;weekPattern:string}[]=[];
  for(let date=first;date<=last;date=date.plus({days:1})){
    if(date.weekday>5)continue;
    const iso=date.toISODate()!,week=scheduleWeek(iso);
    const selected=cells.filter(c=>c.weekday===['MON','TUE','WED','THU','FRI'][date.weekday-1]&&(!c.splitCell||(c.splitPart==='upper'?'NUMERATOR':'DENOMINATOR')===week));
    const slots=new Set<string>();
    const physical=new Map<string,CSCell[]>();
    for(const cell of selected){
      for(const group of cell.groups){const key=group+':'+cell.pairNumber;if(slots.has(key))throw new Error('PDF conflict '+iso+' '+key);slots.add(key);}
      const key=JSON.stringify([cell.pairNumber,subjectKey(cell.subject!),cell.teacher?teacherKey(cell.teacher):cell.id,cell.building,cell.room]);
      physical.set(key,[...physical.get(key)??[],cell]);
    }
    for(const source of physical.values()){
      const list=source.sort((a,b)=>a.id.localeCompare(b.id)),cell=list[0];
      result.push({id:'cs-calendar-'+iso+'-'+cell.id,date:iso,cells:list,cell,groups:[...new Set(list.flatMap(c=>c.groups))].sort(),weekPattern:cell.splitCell?week:'EVERY_WEEK'});
    }
  }
  for(const group of new Set(cells.flatMap(c=>c.groups)))if(!result.some(l=>l.groups.includes(group)))throw new Error('Zero semester lessons: '+group);
  return result;
}

export async function syncCSSchedule(tx:Prisma.TransactionClient,options:{from?:string;to?:string}={}){
  const {cells}=await verifyCSSource(),groups=await resolveCSGroups(tx),ids=groups.map(g=>g.id);
  const sourceToDB=new Map(CS_SOURCE_GROUPS.map(s=>[s.id,groups.find(g=>csName(g.name)===csName(s.name))!.id]));
  const resolved=cells.map(c=>({...c,groups:c.groups.map(id=>sourceToDB.get(id)!)}));
  const calendar=expandCSCalendar(resolved,options.from,options.to),now=effectiveNow().toJSDate();
  const teacherIds=new Map((await tx.teacher.findMany()).map(t=>[teacherKey(t.displayName),t.id]));
  const students=await tx.student.findMany({where:{groupId:{in:ids},active:true}});
  const old=await tx.lesson.findMany({where:{groups:{some:{groupId:{in:ids}}}},include:{groups:true,subject:true,teacher:true,attendance:true,submissions:true,auditLogs:true,roster:true}});
  const signature=(date:string,pair:number,groupIds:string[],subject:string)=>JSON.stringify([date,pair,[...groupIds].sort(),subjectKey(subject)]);
  const history=(l:typeof old[number])=>{
    const exclusive=l.groups.every(g=>ids.includes(g.groupId));
    const members=new Set(l.roster.filter(r=>r.groupId&&ids.includes(r.groupId)).map(r=>r.studentId));
    return l.attendance.some(a=>exclusive||members.has(a.studentId))||exclusive&&l.submissions.length>0||l.auditLogs.some(a=>!['CS_CALENDAR_SYNC','CS_BETA_REPAIR','SEED','DEMO_SEED'].includes(a.source)&&(exclusive||a.studentId&&members.has(a.studentId)||a.groupId&&ids.includes(a.groupId)||!a.studentId&&!a.groupId));
  };
  const identity=(l:typeof old[number])=>signature(DateTime.fromJSDate(l.startAt,{zone:ZONE}).toISODate()!,l.pairNumber,l.groups.filter(g=>ids.includes(g.groupId)).map(g=>g.groupId),l.subject.name);
  const wanted=new Map(calendar.map(l=>[signature(l.date,l.cell.pairNumber,l.groups,l.cell.subject!),l]));
  const reused=new Map<string,typeof old[number]>();
  for(const lesson of old.filter(l=>!l.cancelled&&history(l))){
    const match=wanted.get(identity(lesson));
    if(!match||lesson.groups.some(g=>!ids.includes(g.groupId))||reused.has(match.id)||teacherKey(lesson.teacher?.displayName??'')!==teacherKey(match.cell.teacher??''))throw new Error('Ambiguous manual history; schedule repair blocked for '+lesson.id);
    reused.set(match.id,lesson);
  }
  let created=0,updated=0,retired=0;
  const kept=new Set<string>();
  const preparedSources=new Set<string>();
  for(const item of calendar){
    const {cell}=item;
    const sourceId=item.cells.length===1?cell.id:stableId('cs-shared',item.cells.map(c=>c.id).join(':'));
    const subjectId=stableId('subject',subjectKey(cell.subject!));
    if(!preparedSources.has(sourceId)){
      const source={...cell,groups:item.groups,weekMapping:SCHEDULE_WEEK_BASE,sourceCells:item.cells};
      await tx.sourceRecord.upsert({where:{id:sourceId},create:{id:sourceId,file:cell.file,page:cell.page,raw:item.cells.map(c=>c.raw).join('\n\n'),bbox:json(cell.bbox),data:json(source),issues:json(item.cells.flatMap(c=>c.issues))},update:{data:json(source)}});
      await tx.subject.upsert({where:{id:subjectId},create:{id:subjectId,name:cell.subject!,source:json({file:cell.file,page:cell.page,sourceCells:item.cells.map(c=>c.id)})},update:{}});
      await tx.building.upsert({where:{id:cell.building!},create:{id:cell.building!,abbreviation:cell.building!,source:{file:cell.file,page:cell.page}},update:{}});
      preparedSources.add(sourceId);
    }
    const bell=await tx.bell.findFirst({where:{pairNumber:cell.pairNumber},orderBy:{id:'asc'}});
    if(!bell)throw new Error('Missing bell for pair '+cell.pairNumber);
    if(cell.teacher&&!teacherIds.has(teacherKey(cell.teacher)))throw new Error('Missing canonical teacher '+cell.teacher);
    const startAt=atKyiv(item.date,bells[cell.pairNumber-1][0]),endAt=atKyiv(item.date,bells[cell.pairNumber-1][1]);
    const existing=reused.get(item.id)??old.find(l=>l.id===item.id);
    const id=existing?.id??item.id;kept.add(id);
    const values={startAt,endAt,pairNumber:cell.pairNumber,bellId:bell.id,subjectId,teacherId:cell.teacher?teacherIds.get(teacherKey(cell.teacher))!:null,buildingId:cell.building!,room:cell.room!,sourceId,synthetic:false,cancelled:false,kind:item.groups.length>1?'Спільне заняття за розкладом':'Заняття за розкладом',weekPattern:item.weekPattern};
    if(!existing){await tx.lesson.create({data:{id,...values,groups:{create:item.groups.map(groupId=>({groupId}))}}});created++;}
    else{
      const changed=Object.entries(values).some(([key,value])=>value instanceof Date?value.getTime()!==(existing[key as keyof typeof values] as Date)?.getTime():value!==existing[key as keyof typeof values]);
      if(changed){await tx.lesson.update({where:{id},data:{...values,version:{increment:1}}});updated++;}
      if(JSON.stringify(existing.groups.map(g=>g.groupId).sort())!==JSON.stringify(item.groups)){
        if(history(existing))throw new Error('Roster groups with history differ: '+id);
        await tx.lessonGroup.deleteMany({where:{lessonId:id}});
        await tx.lessonGroup.createMany({data:item.groups.map(groupId=>({lessonId:id,groupId}))});
      }
    }
    // Keep past snapshots and all marks. Only unmarked future membership can be removed.
    if(endAt>now){
      const eligible=students.filter(s=>item.groups.includes(s.groupId));
      const removed=startAt>now?await tx.lessonStudent.deleteMany({where:{lessonId:id,studentId:{notIn:eligible.map(s=>s.id)},attendance:null}}):{count:0};
      const added=await tx.lessonStudent.createMany({data:eligible.map(s=>({lessonId:id,studentId:s.id,groupId:s.groupId})),skipDuplicates:true});
      if(existing&&(removed.count||added.count)){
        const expected=await tx.lessonStudent.count({where:{lessonId:id}}),marked=await tx.attendance.count({where:{lessonId:id}}),confirmed=await tx.attendance.count({where:{lessonId:id,confirmed:true}});
        await tx.lesson.update({where:{id},data:{version:{increment:1},journalState:journalStateFromCounts(expected,marked,confirmed)}});updated++;
      }
    }
  }
  for(const lesson of old.filter(l=>!l.cancelled&&!kept.has(l.id))){
    if(!/^(cs-calendar-|demo-|schedule-)/.test(lesson.id))throw new Error('Unrecognized CS lesson; repair blocked: '+lesson.id);
    if(history(lesson))throw new Error('Unreconciled history '+lesson.id);
    if(lesson.groups.some(g=>!ids.includes(g.groupId))){
      await tx.lessonGroup.deleteMany({where:{lessonId:lesson.id,groupId:{in:ids}}});
      await tx.lessonStudent.deleteMany({where:{lessonId:lesson.id,groupId:{in:ids},attendance:null,lesson:{startAt:{gt:now}}}});
    }else await tx.lesson.update({where:{id:lesson.id},data:{cancelled:true,version:{increment:1}}});
    await tx.auditLog.create({data:{lessonId:lesson.id,objectType:'Lesson',objectId:lesson.id,source:'CS_BETA_REPAIR',reason:'Календар КН замінено за офіційними PDF; вихідний запис збережено.',details:{previousGroups:lesson.groups.map(g=>g.groupId)}}});retired++;
  }
  const diagnostic=groups.map(g=>({group:csName(g.name),weeklySourceCells:resolved.filter(c=>c.groups.includes(g.id)).length,uniqueSubjects:new Set(resolved.filter(c=>c.groups.includes(g.id)).map(c=>subjectKey(c.subject!))).size,semesterLessons:calendar.filter(l=>l.groups.includes(g.id)).length}));
  return {created,updated,retired,diagnostic};
}
