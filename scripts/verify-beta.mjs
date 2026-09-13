import {spawn} from 'node:child_process';
import {cp,mkdir,writeFile} from 'node:fs/promises';
import {isolatedEnvironment,startTestDatabase,migrateTestDatabase,runNode,stopChild} from './test-runtime.mjs';
const env=isolatedEnvironment({DEMO_DATE:'2026-09-14',SEED_TEST_ATTENDANCE:'false'});
const database=await startTestDatabase();
let web,logs='';
try{
  await migrateTestDatabase(env);
  await runNode(['--import','tsx','prisma/seed.ts'],env);
  await cp('public','.next/standalone/public',{recursive:true});
  await cp('.next/static','.next/standalone/.next/static',{recursive:true});
  web=spawn(process.execPath,['.next/standalone/server.js'],{env,stdio:['ignore','pipe','pipe']});
  web.stdout.on('data',data=>{logs+=data;});web.stderr.on('data',data=>{logs+=data;process.stderr.write(data);});
  for(let i=0;i<40;i++){
    try{if((await fetch(env.TEST_BASE_URL+'/api/health')).ok)break;}catch{}
    if(i===39)throw new Error('Beta verification server did not start');
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  await runNode(['--import','./scripts/assert-isolated-test.mjs','--import','tsx','--test','--test-concurrency=1','tests/beta/beta.test.ts'],env);
}catch(error){console.error(error);process.exitCode=1;}finally{
  await mkdir('test-results',{recursive:true});await writeFile('test-results/beta-server.log',logs);
  await stopChild(web);await database.close();
}
