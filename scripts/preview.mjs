// Browser QA only. Start with MNAU_PREVIEW_TEST_DATABASE=true for a fresh PostgreSQL WASM test database.
import {spawn} from 'node:child_process';
import {cp} from 'node:fs/promises';
import {isolatedEnvironment,startTestDatabase,migrateTestDatabase,runNode,stopChild} from './test-runtime.mjs';
let database;
const testPreview=process.env.MNAU_PREVIEW_TEST_DATABASE==='true';
let env={...process.env,PORT:'4173',HOSTNAME:'0.0.0.0',NEXT_TELEMETRY_DISABLED:'1'};
if(testPreview){
  if(process.env.APP_ENV==='production')throw new Error('Test preview cannot run in a production environment.');
  env=isolatedEnvironment({PORT:'4173',HOSTNAME:'0.0.0.0',APP_ORIGIN:'http://localhost:4173',...(process.env.MNAU_PREVIEW_CS_BETA==='true'?{DEMO_DATE:'2026-09-14',SEED_TEST_ATTENDANCE:'false'}:{})});
  database=await startTestDatabase();
  try{
    await migrateTestDatabase(env);
    await runNode(['--import','tsx','prisma/seed.ts'],env);
    if(process.env.MNAU_PREVIEW_CS_BETA==='true'){
      await runNode(['--import','tsx','scripts/generate-semester-schedule.ts','--from=2026-09-14','--to=2026-09-27'],env);
      await runNode(['--import','tsx','scripts/prepare-cs-beta.ts'],env);
    }
    await cp('public','.next/standalone/public',{recursive:true});
    await cp('.next/static','.next/standalone/.next/static',{recursive:true});
  }catch(error){await database.close();throw error;}
}
const args=testPreview?['.next/standalone/server.js']:['node_modules/next/dist/bin/next','dev','--hostname','0.0.0.0','--port','4173'];
const next=spawn(process.execPath,args,{env,stdio:'inherit'});
let closing=false;
async function close(code){if(closing)return;closing=true;await stopChild(next);await database?.close();process.exit(code);}
process.on('SIGTERM',()=>close(0));
process.on('SIGINT',()=>close(0));
next.on('error',async error=>{console.error(error.message);await close(1);});
next.on('exit',code=>close(code??0));
