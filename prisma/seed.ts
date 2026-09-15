import {assertLegacyFixture} from '../src/lib/beta-operations';
import 'dotenv/config';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { DateTime } from 'luxon';
import { db } from '../src/lib/db';
import { atKyiv,demoEnabled,today,ZONE } from '../src/lib/time';
import { teacherKey } from '../src/lib/cs-beta-data';
import {isCSSpecialty} from '../src/lib/cs-structure';
import { journalStateForRoster } from '../src/lib/journal-state';
import type { Prisma,RoleCode,StatusCode } from '../src/generated/prisma/client';
type SourceGroup={id:string;name:string;course:number;specialty:string;source:Prisma.InputJsonObject};
type Cell={id:string;file:string;page:number;bbox:number[];raw:string;groups:string[];weekday:string|null;pairNumber:number|null;splitCell:boolean;subject:string|null;teacher:string|null;building:string|null;room:string|null;issues:string[];usableForSyntheticDemo:boolean};
const id=(prefix:string,value:string)=>prefix+'-'+createHash('sha256').update(value).digest('hex').slice(0,16);
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const bellTimes=[['08:30','09:50'],['10:05','11:25'],['11:55','13:15'],['13:30','14:50'],['15:05','16:25'],['16:40','18:00'],['18:10','19:10'],['19:20','20:20']];
async function main(){
  assertLegacyFixture();
  if(!demoEnabled())throw new Error('Seed requires APP_ENV=demo and DEMO_MODE=true. Production demo seeding is forbidden.');
  await db.$queryRaw`SELECT current_database(), current_schema()`;
  const groups=JSON.parse(await readFile('source-data/groups.json','utf8')) as SourceGroup[];
  const cells=JSON.parse(await readFile('source-data/schedule-cells.json','utf8')) as Cell[];
  const roleLabels:Record<RoleCode,string>={ADMIN:'Адміністратор',DEVELOPER:'Розробник',STUDENT:'Студент',DEAN_OFFICE:'Деканат',CURATOR:'Куратор',TEACHER:'Викладач',STAROSTA:'Староста'};
  for(const [role,label] of Object.entries(roleLabels))await db.role.upsert({where:{id:role as RoleCode},create:{id:role as RoleCode,label},update:{}});
  for(const [code,label] of [['PRESENT','Присутній / присутня'],['N','Без поважної причини'],['HV','Поважна причина']] as const)await db.attendanceStatus.upsert({where:{code},create:{code,label},update:{}});
  const faculty=await db.faculty.upsert({where:{slug:'management'},create:{id:'faculty-management',slug:'management',name:'Факультет менеджменту',sourceUrl:'https://www.mnau.edu.ua/faculty-men/'},update:{}});
  await db.faculty.upsert({where:{slug:'accounting-finance'},create:{id:'faculty-accounting-finance',slug:'accounting-finance',name:'Обліково-фінансовий факультет',sourceUrl:'https://www.mnau.edu.ua/faculty-off/'},update:{}});
  const refs:Record<string,{code:string;url:string}>={"Комп'ютерні науки":{code:'122',url:'https://www.mnau.edu.ua/faculty-men/opc-122-kn/'},'Менеджмент':{code:'073',url:'https://www.mnau.edu.ua/faculty-men/opc_073_men/'},'Економіка':{code:'051',url:'https://www.mnau.edu.ua/faculty-men/'},'Публічне управління та адміністрування':{code:'281',url:'https://www.mnau.edu.ua/faculty-men/'},'Готельно- ресторанна справа':{code:'241',url:'https://www.mnau.edu.ua/faculty-men/opc-241-grs/'},'Туризм і рекреація':{code:'242',url:'https://www.mnau.edu.ua/faculty-men/opc_242/'}};
  for(const g of groups){
    // PDF header and cohort boundary are retained. Do not infer intake year or map modern codes from course.
    const canonical=isCSSpecialty(g.specialty)?(await db.specialty.findMany({orderBy:{id:'asc'}})).find(s=>isCSSpecialty(s.name)):undefined;
    const sid=canonical?.id??id('specialty',g.specialty+(isCSSpecialty(g.specialty)?'':g.course<=2?':junior':':senior'));
    const ref=refs[g.specialty];
    await db.specialty.upsert({where:{id:sid},create:{id:sid,name:g.specialty.replace('Готельно- ресторанна','Готельно-ресторанна'),code:null,codeNote:ref?`Довідковий код на сторінці МНАУ: ${ref.code}. Код цього набору потребує підтвердження.`:'Код цього набору не вказаний у PDF.',facultyId:faculty.id,source:json({pdf:g.source,facultyUrl:faculty.sourceUrl,programReference:ref??null,cohortBand:g.course<=2?'1–2 курс':'3–4 курс'})},update:{}});
    await db.group.upsert({where:{id:g.id},create:{id:g.id,name:g.name,course:g.course,specialtyId:sid,source:json(g.source)},update:{}});
  }
  for(const [abbr,name,address] of [['гк','Головний корпус','вул. Георгія Гонгадзе, 9'],['м','Корпус менеджменту','вул. Георгія Гонгадзе, 3А'],['карп','Корпус на вул. Карпенка','вул. Карпенка, 73'],['кр',null,null]] as const)await db.building.upsert({where:{id:abbr},create:{id:abbr,abbreviation:abbr,name,address,confirmed:abbr!=='кр',source:{type:abbr==='кр'?'PDF; unresolved':'User-provided building directory'}},update:{}});
  for(let i=0;i<8;i++)await db.bell.upsert({where:{id:`bell-${i+1}`},create:{id:`bell-${i+1}`,pairNumber:i+1,startTime:bellTimes[i][0],endTime:bellTimes[i][1],source:'User-provided bell schedule; Europe/Kyiv'},update:{}});
  for(const cell of cells){
    await db.sourceRecord.upsert({where:{id:cell.id},create:{id:cell.id,file:cell.file,page:cell.page,raw:cell.raw,bbox:json(cell.bbox),data:json(cell),issues:json(cell.issues)},update:{}});
    if(cell.teacher&&!(await db.teacher.findMany({select:{displayName:true}})).some(t=>teacherKey(t.displayName)===teacherKey(cell.teacher!)))await db.teacher.upsert({where:{id:id('teacher',cell.teacher)},create:{id:id('teacher',cell.teacher),displayName:cell.teacher,source:json({sourceId:cell.id,file:cell.file,page:cell.page,raw:cell.raw})},update:{}});
    if(cell.subject)await db.subject.upsert({where:{id:id('subject',cell.subject.toLocaleLowerCase('uk'))},create:{id:id('subject',cell.subject.toLocaleLowerCase('uk')),name:cell.subject,source:json({sourceId:cell.id,file:cell.file,page:cell.page,raw:cell.raw})},update:{}});
  }
  const betaPrepared=!!await db.systemState.findUnique({where:{id:'cs-beta'}});
  const last=['Коваленко','Бондаренко','Мельник','Шевченко','Ткаченко','Кравченко','Олійник','Романенко','Савченко','Поліщук','Коваль','Мороз','Левченко','Бойко','Петренко','Василенко','Дорошенко','Марченко','Лисенко','Павленко','Сидоренко','Захарченко','Іваненко','Клименко','Руденко','Терещенко','Гончар','Черненко','Яременко','Козак','Демченко'];
  const first=['Софія','Максим','Анна','Артем','Марія','Данило','Вікторія','Олександр','Дарина','Дмитро','Катерина','Михайло','Вероніка','Андрій','Олена'];
  const middle=['Олександрівна','Віталійович','Ігорівна','Сергійович','Андріївна','Миколайович','Петрівна','Олегович','Богданівна','Іванович','Вікторівна','Юрійович','Тарасівна','Романович','Дмитрівна'];
  for(let gi=0;gi<groups.length;gi++)for(let si=0;si<15;si++){
    const g=groups[gi];if(betaPrepared&&/^Кн /i.test(g.name))continue;const nameIndex=(si+gi)%15;
    await db.student.upsert({where:{id:`${g.id}-student-${si+1}`},create:{id:`${g.id}-student-${si+1}`,fullName:`${last[(si*3+gi)%last.length]} ${first[nameIndex]} ${middle[nameIndex]}`,groupId:g.id,phone:null,isSynthetic:true},update:{}});
  }
  const passwordHash=await bcrypt.hash('Test1234!',12);
  async function createUser(email:string,name:string,roles:RoleCode[]){
    const existing=await db.user.findUnique({where:{email}});if(existing)return {user:existing,created:false};
    return {user:await db.user.create({data:{mustChangePassword:false,email,name,passwordHash,roles:{create:roles.map(roleId=>({roleId}))}}}),created:true};
  }
  await createUser('admin@test.com','Адміністратор демо',['ADMIN']);
  const dean=await createUser('dean@test.com','Деканат · демо',['DEAN_OFFICE']);
  if(dean.created)await db.deanAssignment.create({data:{userId:dean.user.id,facultyId:faculty.id}});
  const kn=groups.find(g=>g.name==='Кн 2/1')!;
  const curator=await createUser('curator@test.com','Куратор · демо',['CURATOR']);
  if(curator.created)await db.curatorAssignment.create({data:{userId:curator.user.id,groupId:kn.id}});
  const starosta=betaPrepared?null:await createUser('starosta@test.com','Староста · демо',['STAROSTA']);
  if(starosta?.created){await db.student.update({where:{id:`${kn.id}-student-1`},data:{userId:starosta.user.id}});await db.starostaAssignment.create({data:{userId:starosta.user.id,groupId:kn.id}});}
  const teachers=await db.teacher.findMany({orderBy:{displayName:'asc'}});
  const accountList=[];
  const knownGroupIds=new Set(groups.map(g=>g.id));
  const usable=cells.filter(c=>c.usableForSyntheticDemo && c.subject && c.teacher && c.building && c.room && c.groups.every(g=>knownGroupIds.has(g)));
  const existingLessons=await db.lesson.findMany({include:{groups:true}});
  const occupied=new Set<string>();
  function keys(date:string,pair:number,teacher:string,building:string,room:string,gids:string[]){return [`${date}:${pair}:teacher:${teacher}`,`${date}:${pair}:room:${building}:${room}`,...gids.map(g=>`${date}:${pair}:group:${g}`)];}
  for(const l of existingLessons){if(!l.cancelled)for(const k of keys(DateTime.fromJSDate(l.startAt).setZone(ZONE).toISODate()!,l.pairNumber,l.teacherId??'',l.buildingId,l.room,l.groups.map(g=>g.groupId)))occupied.add(k);}
  async function addLesson(lessonId:string,gids:string[],date:string,template:Cell,history:number|null,cancelled=false){
    if(await db.lesson.findUnique({where:{id:lessonId}}))return;
    const teacherId=template.teacher?(await db.teacher.findMany({select:{id:true,displayName:true}})).find(t=>teacherKey(t.displayName)===teacherKey(template.teacher!))?.id??null:null;
    let pair=1;
    for(;pair<=8;pair++)if(!keys(date,pair,teacherId??'',template.building!,template.room!,gids).some(k=>occupied.has(k)))break;
    if(pair>8)throw new Error(`No collision-free slot for ${lessonId}`);
    if(!cancelled)for(const k of keys(date,pair,teacherId??'',template.building!,template.room!,gids))occupied.add(k);
    const students=await db.student.findMany({where:{groupId:{in:gids},active:true,...(date<today()?{isSynthetic:true}:{})},orderBy:{id:'asc'}});
    const past=date<today();const incomplete=history===6;const empty=history===7;
    await db.$transaction(async tx=>{
      await tx.lesson.create({data:{id:lessonId,startAt:atKyiv(date,bellTimes[pair-1][0]),endAt:atKyiv(date,bellTimes[pair-1][1]),pairNumber:pair,bellId:`bell-${pair}`,subjectId:id('subject',template.subject!.toLocaleLowerCase('uk')),teacherId,buildingId:template.building!,room:template.room!,sourceId:template.id,synthetic:true,cancelled,kind:gids.length>1?'Спільна демонстраційна лекція':'Демонстраційне заняття',weekPattern:template.splitCell?'У джерелі є поділ клітинки; схема тижнів не підтверджена':null,journalState:'EMPTY',groups:{create:gids.map(groupId=>({groupId}))},roster:{create:students.map(s=>({studentId:s.id}))}}});
      if(process.env.MNAU_TEST_ISOLATED==='true' && process.env.SEED_TEST_ATTENDANCE==='true' && past && history!==null && !empty && !cancelled){
        const marks=students.flatMap((s,i)=>{
          if(i%15===14 || (incomplete&&i%3===0))return [];
          let statusCode:StatusCode='PRESENT';
          if(i%15<2)statusCode=history%4===0?'PRESENT':'N';
          else if(i%15===2)statusCode=history%3===0?'PRESENT':'N';
          else if(i%15===3)statusCode=history%4===0?'PRESENT':'HV';
          else if(i%15===4)statusCode='HV';
          else if((i+history)%9===0)statusCode='N';
          return [{studentId:s.id,lessonId,statusCode,confirmed:true,isDemo:true}];
        });
        await tx.attendance.createMany({data:marks});
        await tx.lesson.update({where:{id:lessonId},data:{journalState:journalStateForRoster(students.length,marks)}});
        await tx.auditLog.createMany({data:marks.map(m=>({lessonId,studentId:m.studentId,objectType:'Attendance',objectId:`${lessonId}:${m.studentId}`,oldStatus:null,newStatus:m.statusCode,reason:'Синтетична демонстраційна історія',source:'DEMO_SEED'}))});
      }
    });
  }
  for(let gi=0;gi<groups.length;gi++){
    const g=groups[gi];if(betaPrepared&&/^Кн /i.test(g.name))continue;const options=usable.filter(c=>c.groups.includes(g.id));
    if(!options.length)throw new Error('Missing source candidates for '+g.name);
    for(let h=0;h<8;h++){
      const date=DateTime.fromISO(today(),{zone:ZONE}).minus({days:28-Math.floor(h/2)*7-(h%2)*2}).toISODate()!;
      await addLesson(`demo-history-${g.id}-${h}`,[g.id],date,options[(gi+h)%options.length],h);
    }
    const liveTemplate=g.id===kn.id?options.find(c=>c.subject==='Програмування на С++')??options[0]:options[(gi*3)%options.length];
    await addLesson(`demo-live-${g.id}`,[g.id],today(),liveTemplate,null);
    await addLesson(`demo-future-${g.id}`,[g.id],DateTime.fromISO(today(),{zone:ZONE}).plus({days:7}).toISODate()!,options[0],null);
    if(gi%4===0)await addLesson(`demo-cancelled-${g.id}`,[g.id],DateTime.fromISO(today(),{zone:ZONE}).minus({days:1}).toISODate()!,options[0],null,true);
  }
  const joint=usable.find(c=>c.groups.length===2 && c.raw.includes('ОСНОВИ ІТ-'));
  if(joint&&!betaPrepared)await addLesson('demo-joint-kn3',joint.groups,today(),joint,null);
  for(let i=0;i<teachers.length;i++){
    const t=teachers[i];if(t.userId)continue;
    if(!await db.lesson.count({where:{teacherId:t.id}}))continue;
    const email=teacherKey(t.displayName)===teacherKey('Пархоменко О.Ю.')?'teacher@test.com':`teacher-${String(i+1).padStart(2,'0')}@test.com`;
    const account=await createUser(email,`${t.displayName} · демо`,['TEACHER']);
    if(account.created)await db.teacher.update({where:{id:t.id},data:{userId:account.user.id}});
    accountList.push({email,teacher:t.displayName});
  }
  await mkdir('runtime',{recursive:true});await writeFile('runtime/demo-accounts.json',JSON.stringify(accountList,null,2));
  const counts={faculties:await db.faculty.count(),groups:await db.group.count(),students:await db.student.count(),teachers:await db.teacher.count(),subjects:await db.subject.count(),lessons:await db.lesson.count(),attendance:await db.attendance.count(),sourceRecords:await db.sourceRecord.count()};
  console.log(JSON.stringify(counts));
}
main().finally(()=>db.$disconnect());
