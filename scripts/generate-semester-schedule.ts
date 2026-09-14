import 'dotenv/config';
import {pathToFileURL} from 'node:url';
import {db} from '../src/lib/db';
import {demoEnabled} from '../src/lib/time';
import {syncCSSchedule} from '../src/lib/cs-schedule';
import {resolveCSGroups} from '../src/lib/cs-structure';
export {weekHalf} from '../src/lib/schedule-week';
export async function generateSemesterSchedule(options:{from?:string;to?:string}={}){
  if(!demoEnabled()||process.env.APP_ENV==='production')throw new Error('Schedule import requires APP_ENV=demo and DEMO_MODE=true.');
  const database=await db.$queryRaw<{name:string}[]>`SELECT current_database() AS name`;
  if(database[0]?.name!=='mnau_attendance')throw new Error('Wrong database; generation blocked.');
  const result=await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(9132026)::text`;
    for(const g of (await resolveCSGroups(tx)).sort((a,b)=>a.id.localeCompare(b.id)))await tx.$queryRaw`SELECT "id" FROM "Group" WHERE "id"=${g.id} FOR UPDATE`;
    return syncCSSchedule(tx,options);
  },{maxWait:15000,timeout:180000});
  console.log(JSON.stringify(result,null,2));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)generateSemesterSchedule().catch(error=>{console.error(error instanceof Error?error.message:'Schedule failed');process.exitCode=1;}).finally(()=>db.$disconnect());
