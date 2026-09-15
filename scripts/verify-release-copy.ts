// Acceptance against an explicitly isolated PostgreSQL clone, never the live TEST database.
import 'dotenv/config';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {db} from '../src/lib/db';
import {importCompleteCSRoster} from './import-complete-cs-roster';
import {backfillCSHistory} from './backfill-cs-history';
import {readCSData,stableId} from '../src/lib/cs-beta-data';
import {CS_GROUP_IDS} from '../src/lib/cs-beta-data';
import {createReport} from '../src/lib/reports';
import {principalSelect} from '../src/lib/auth';
const url=new URL(process.env.DATABASE_URL!);
if(url.hostname!=='127.0.0.1'||!['5544','5545'].includes(url.port)||process.env.RELEASE_COPY_CHECK!=='true')throw new Error('Requires an explicitly isolated release clone on localhost:5544 or localhost:5545.');
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
try{
 const {students}=await readCSData(),keys=students.flatMap(s=>s.legacy?[stableId('cs-roster',s.legacy.sha256+':'+s.legacy.index)]:[]);
 const studentSnapshot=()=>db.student.findMany({where:{importKey:{in:keys}},orderBy:{id:'asc'}});
 const marks=await db.attendance.findMany({orderBy:[{lessonId:'asc'},{studentId:'asc'}]});
 const users=await db.user.findMany({select:{id:true,passwordHash:true,teacher:{select:{id:true}},roles:{orderBy:{roleId:'asc'}}},orderBy:{id:'asc'}});
 const before=hash(await studentSnapshot());assert.equal((await studentSnapshot()).length,58);
 const already=await db.rosterSourceRow.count();
 const dry=await importCompleteCSRoster();assert.equal(dry.added,already?0:70);
 const imported=await importCompleteCSRoster(true);assert.equal(imported.added,already?0:70);assert.equal(hash(await studentSnapshot()),before);
 const counts={students:await db.student.count(),users:await db.user.count(),roster:await db.lessonStudent.count()};
 const repeated=await importCompleteCSRoster(true);assert.equal(repeated.added,0);assert.equal(repeated.linked,128);assert.deepEqual({students:await db.student.count(),users:await db.user.count(),roster:await db.lessonStudent.count()},counts);
 const unchanged=await db.user.findMany({select:{id:true,passwordHash:true,teacher:{select:{id:true}},roles:{orderBy:{roleId:'asc'}}},orderBy:{id:'asc'}});assert.equal(hash(users),hash(unchanged));
 // A cleared manual journal is still manual. Use an explicit fixture event on this clone only.
 const fixture=await db.auditLog.findFirst({where:{reason:'Isolated acceptance fixture: previously cleared manual journal'}});
 const cleared=fixture?.lessonId?await db.lesson.findUniqueOrThrow({where:{id:fixture.lessonId}}):await db.lesson.findFirstOrThrow({where:{id:{startsWith:'cs-calendar-'},startAt:{gte:new Date('2026-09-01'),lt:new Date('2026-09-14')},attendance:{none:{}},auditLogs:{none:{}},cancelled:false,groups:{some:{groupId:{in:CS_GROUP_IDS}}}}});
 if(!fixture)await db.auditLog.create({data:{lessonId:cleared.id,objectType:'Lesson',objectId:cleared.id,source:'JOURNAL_SAVE',reason:'Isolated acceptance fixture: previously cleared manual journal'}});
 const simulation=await backfillCSHistory();assert.equal(simulation.replayed,false);
 const generated=await backfillCSHistory(true);assert.equal(generated.replayed,false);
 assert.equal(await db.attendance.count({where:{lessonId:cleared.id}}),0);
 const batchMarks=await db.attendance.findMany({where:{source:'BETA_BACKFILL'},orderBy:[{lessonId:'asc'},{studentId:'asc'}]});
 assert.ok(batchMarks.length>0);assert.equal(await db.attendance.count({where:{source:'BETA_BACKFILL',lesson:{OR:[{startAt:{lt:new Date('2026-08-31T21:00:00Z')}},{startAt:{gte:new Date('2026-09-14T21:00:00Z')}}]}}}),0);
 const repeatHistory=await backfillCSHistory(true);assert.equal(repeatHistory.replayed,true);assert.equal(hash(batchMarks),hash(await db.attendance.findMany({where:{source:'BETA_BACKFILL'},orderBy:[{lessonId:'asc'},{studentId:'asc'}]})));
 for(const original of marks)assert.deepEqual(await db.attendance.findUnique({where:{studentId_lessonId:{studentId:original.studentId,lessonId:original.lessonId}}}),original);
 const admin=await db.user.findUniqueOrThrow({where:{email:'release-fixture@example.invalid'},select:principalSelect});
 const group=await db.group.findUniqueOrThrow({where:{id:CS_GROUP_IDS[0]},include:{specialty:true}});
 const report=await createReport(admin,group.specialty.facultyId,{from:'2026-09-01',to:'2026-09-14'},'WEEKLY');
 const saved=await db.report.findUniqueOrThrow({where:{id:report.id}});assert.equal(saved.state,'READY');assert.ok(saved.pdf&&saved.csv&&saved.xlsx);
 await mkdir('runtime/acceptance',{recursive:true});
 await writeFile('runtime/acceptance/report.pdf',saved.pdf);await writeFile('runtime/acceptance/report.csv',saved.csv);await writeFile('runtime/acceptance/report.xlsx',saved.xlsx);await writeFile('runtime/acceptance/report-summary.json',JSON.stringify(saved.summary,null,2));
 const results={environment:'Isolated PostgreSQL clone localhost:'+url.port,import:{...imported,ids:undefined},repeatImport:{added:repeated.added,linked:repeated.linked,unchangedCounts:counts},preservation:{legacyIDs:58,originalAttendance:marks.length,userHashesAndRolesUnchanged:true},backfill:generated,repeatBackfill:repeatHistory,report:{id:report.id,pdfBytes:saved.pdf.length,csvBytes:saved.csv.length,xlsxBytes:saved.xlsx.length}};
 await writeFile('runtime/acceptance/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await db.$disconnect();}
