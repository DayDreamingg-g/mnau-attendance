// Isolated test harness: all child processes share the test server's network namespace.
import {spawn} from 'node:child_process';
import {isolatedEnvironment,startTestDatabase,migrateTestDatabase,stopChild} from './test-runtime.mjs';
const database=await startTestDatabase();
const env=isolatedEnvironment();
const commands=process.argv.slice(2);
let child;
try{
  await migrateTestDatabase(env);
  for(const command of commands){
    console.log('Running test stage:',command);
    const result=await new Promise((resolve,reject)=>{child=spawn(process.platform==='win32'?'npm.cmd':'npm',['run',command],{stdio:'inherit',env,shell:process.platform==='win32'});child.on('error',reject);child.on('exit',resolve);});
    if(result!==0){process.exitCode=Number(result)||1;break;}
  }
}finally{await stopChild(child);await database.close();}
