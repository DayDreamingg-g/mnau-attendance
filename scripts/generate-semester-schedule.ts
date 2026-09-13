import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {DateTime} from 'luxon';
import {db} from '../src/lib/db';
import {atKyiv,demoEnabled,effectiveNow,ZONE} from '../src/lib/time';
import {CS_GROUP_IDS,readCSData,stableId,teacherKey,type CSCell} from '../src/lib/cs-beta-data';
import type {Prisma} from '../src/generated/prisma/client';
const bells=[['08:30','09:50'],['10:05','11:25'],['11:55','13:15'],['13:30','14:50'],['15:05','16:25'],['16:40','18:00'],['18:10','19:10'],['19:20','20:20']];
const days=['MON','TUE','WED','THU','FRI'];
const argument=(name:string)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.split('=').slice(1).join('=');
export function weekHalf(date:string,baseMonday='2026-09-14'){
  const day=DateTime.fromISO(date,{zone:ZONE}).startOf('week');
  const base=DateTime.fromISO(baseMonday,{zone:ZONE}).startOf('week');
  const weeks=Math.round(day.diff(base,'days').days/7);
  return ((weeks%2)+2)%2===0?'lower':'upper';
}
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function generateSemesterSchedule(options:{from?:string;to?:string}={}){
  if(!demoEnabled()||process.env.APP_ENV==='production')throw new Error('Schedule import requires APP_ENV=demo and DEMO_MODE=true.');
  const database=await db.$queryRaw<{name:string}[]>`SELECT current_database() AS name`;
  if(database[0]?.name!=='mnau_attendance')throw new Error('Wrong database; generation blocked.');
  if(process.argv.includes('--replace'))throw new Error('--replace is retired: calendar synchronization preserves lessons and history.');
  const mapping=JSON.parse(await readFile('source-data/cs-beta/week-mapping.json','utf8')) as {baseMonday:string;baseHalf:string;nextMonday:string;nextHalf:string};
  if(mapping.baseMonday!=='2026-09-14'||mapping.baseHalf!=='lower')throw new Error('The approved base-week mapping has changed. Review it before generation.');
  console.log('BASE WEEK MAPPING: '+mapping.baseMonday+' lower / DENOMINATOR; '+mapping.nextMonday+' upper / NUMERATOR. Weekly alternation anchored to those dates.');
  const from=DateTime.fromISO(options.from??argument('from')??'2026-09-01',{zone:ZONE});
  const to=DateTime.fromISO(options.to??argument('to')??'2027-01-31',{zone:ZONE});
  if(!from.isValid||!to.isValid||from>to||to.diff(from,'days').days>220)throw new Error('Invalid calendar range; maximum 220 days.');
  const {cells}=await readCSData();
  const now=effectiveNow().toJSDate();
  let created=0,existing=0,rosterAdded=0,cancelledObsolete=0;
  await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(9132026)::text`;
    for(const id of [...CS_GROUP_IDS].sort())await tx.$queryRaw`SELECT "id" FROM "Group" WHERE "id"=${id} FOR UPDATE`;
    if(await tx.group.count({where:{id:{in:[...CS_GROUP_IDS]}}})!==5)throw new Error('Run normal db:seed before schedule generation.');
    const teacherIds=new Map<string,string>();
    const sourceCells:CSCell[]=[];
    for(const cell of cells){
      if(!cell.subject||!cell.building||!cell.room)throw new Error('Unresolved source cell: '+cell.id);
      await tx.sourceRecord.upsert({where:{id:cell.id},create:{id:cell.id,file:cell.file,page:cell.page,raw:cell.raw,bbox:json(cell.bbox),data:json({...cell,weekMapping:mapping}),issues:json(cell.issues)},update:{data:json({...cell,weekMapping:mapping})}});
      await tx.subject.upsert({where:{id:stableId('subject',cell.subject.toLocaleLowerCase('uk'))},create:{id:stableId('subject',cell.subject.toLocaleLowerCase('uk')),name:cell.subject,source:json({file:cell.file,page:cell.page,cell:cell.sourceCell,raw:cell.raw})},update:{}});
      await tx.building.upsert({where:{id:cell.building},create:{id:cell.building,abbreviation:cell.building,name:cell.building,confirmed:false,source:{file:cell.file,page:cell.page,cell:cell.sourceCell,note:'Original building designation; address not inferred.'}},update:{}});
      if(cell.teacher){
        const key=teacherKey(cell.teacher);
        if(!teacherIds.has(key)){
          const match=(await tx.teacher.findMany()).find(t=>teacherKey(t.displayName)===key);
          const teacher=match??await tx.teacher.create({data:{id:stableId('teacher',cell.teacher),displayName:cell.teacherDisplayName??cell.teacher,source:json({file:cell.file,page:cell.page,cell:cell.sourceCell,raw:cell.raw})}});
          teacherIds.set(key,teacher.id);
        }
      }
      sourceCells.push(cell);
    }
    const students=await tx.student.findMany({where:{groupId:{in:[...CS_GROUP_IDS]},active:true},select:{id:true,groupId:true,joinedAt:true,isSynthetic:true}});
    // Retire superseded generated CS calendar entries, preserving every row and mark.
    // Shared entries with another specialty keep their other group's calendar.
    const obsolete=await tx.lesson.findMany({where:{synthetic:true,cancelled:false,startAt:{gte:now},groups:{some:{groupId:{in:[...CS_GROUP_IDS]}},every:{groupId:{in:[...CS_GROUP_IDS]}}},OR:[{id:{startsWith:'schedule-'}},{id:{startsWith:'demo-'}}]},select:{id:true}});
    for(const lesson of obsolete){
      await tx.lesson.update({where:{id:lesson.id},data:{cancelled:true,version:{increment:1}}});
      await tx.auditLog.create({data:{lessonId:lesson.id,objectType:'Lesson',objectId:lesson.id,source:'CS_CALENDAR_SYNC',reason:'Застаріле synthetic заняття замінене актуальним PDF-календарем; історію збережено.',details:{cancelled:true}}});
      cancelledObsolete++;
    }
    for(let date=from;date<=to;date=date.plus({days:1})){
      if(date.weekday>5)continue;
      const iso=date.toISODate()!,half=weekHalf(iso,mapping.baseMonday);
      for(const cell of sourceCells){
        if(cell.weekday!==days[date.weekday-1]||(cell.splitCell&&cell.splitPart!==half))continue;
        const startAt=atKyiv(iso,bells[cell.pairNumber-1][0]),endAt=atKyiv(iso,bells[cell.pairNumber-1][1]);
        const id='cs-calendar-'+iso+'-'+cell.id;
        if(await tx.lesson.findUnique({where:{id}})){existing++;continue;}
        const members=students.filter(s=>cell.groups.includes(s.groupId)&&(endAt>now||s.joinedAt<=startAt&&!s.isSynthetic));
        await tx.lesson.create({data:{id,startAt,endAt,pairNumber:cell.pairNumber,bellId:'bell-'+cell.pairNumber,subjectId:stableId('subject',cell.subject!.toLocaleLowerCase('uk')),teacherId:cell.teacher?teacherIds.get(teacherKey(cell.teacher)):null,buildingId:cell.building!,room:cell.room!,sourceId:cell.id,synthetic:false,kind:cell.groups.length>1?'Спільне заняття за розкладом':'Заняття за розкладом',weekPattern:cell.splitCell?(half==='lower'?'DENOMINATOR':'NUMERATOR'):'EVERY_WEEK',groups:{create:cell.groups.map(groupId=>({groupId}))},roster:{create:members.map(s=>({studentId:s.id,groupId:s.groupId}))}}});
        created++;rosterAdded+=members.length;
      }
    }
  },{maxWait:15000,timeout:180000});
  const summary={from:from.toISODate(),to:to.toISODate(),created,existing,rosterAdded,cancelledObsolete,baseWeek:mapping};
  console.log(JSON.stringify(summary,null,2));
  return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)generateSemesterSchedule().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());
