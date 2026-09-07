import {spawn} from 'node:child_process';
import {mkdir,writeFile,cp,readdir} from 'node:fs/promises';
import {isolatedEnvironment,startTestDatabase,migrateTestDatabase,runNode,stopChild} from './test-runtime.mjs';
const database=await startTestDatabase();
const env=isolatedEnvironment();
const run=args=>runNode(args,env);
let web,logs='';
try{
  await migrateTestDatabase(env);
  await run(['--import','tsx','prisma/seed.ts']);
  await run(['--import','tsx','scripts/check-database.ts']);
  await run(['--import','tsx','scripts/check-conflicts.ts']);
  await cp('public','.next/standalone/public',{recursive:true});
  await cp('.next/static','.next/standalone/.next/static',{recursive:true});
  web=spawn(process.execPath,['.next/standalone/server.js'],{env,stdio:['ignore','pipe','pipe']});web.stdout.on('data',d=>{logs+=d;process.stdout.write(d);});web.stderr.on('data',d=>{logs+=d;process.stderr.write(d);});
  for(let i=0;i<20;i++){try{const r=await fetch('http://127.0.0.1:3001/api/health',{signal:AbortSignal.timeout(1500)});if(r.ok)break;}catch{}if(i===19)throw new Error('Web server did not become healthy');await new Promise(resolve=>setTimeout(resolve,500));}
  if(process.env.VERIFY_N8N_ONLY!=='true'){
    const files=(await readdir('tests/integration')).filter(file=>file.endsWith('.test.ts')).sort();
    if(!files.length)throw new Error('No integration test files found');
    await run(['--import','./scripts/assert-isolated-test.mjs','--import','tsx','--test','--test-concurrency=1',...files.map(file=>`tests/integration/${file}`)]);
  }
  if(process.env.N8N_TEST_BIN){await run(['scripts/verify-n8n.mjs']);await run(['--import','tsx','scripts/check-n8n-outage.ts']);}
  console.log('Server integration verification completed against PostgreSQL WASM. Native Docker remains unverified.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/server.log',logs);await stopChild(web);await database.close();}
