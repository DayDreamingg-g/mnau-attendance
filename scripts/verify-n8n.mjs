import 'dotenv/config';
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const redact=(value)=>process.env.REPORT_MACHINE_TOKEN?value.replaceAll(process.env.REPORT_MACHINE_TOKEN,'[REDACTED]'):value;
const bin=process.env.N8N_TEST_BIN;if(!bin)throw new Error('Set N8N_TEST_BIN to a locally installed n8n CLI.');
const db=await PGlite.create();const server=new PGLiteSocketServer({db,host:'127.0.0.1',port:5544,maxConnections:32});await server.start();
const folder=path.resolve('runtime/n8n-verification-'+randomUUID());await mkdir(folder,{recursive:true});
const env={...process.env,DB_TYPE:'postgresdb',DB_POSTGRESDB_HOST:'127.0.0.1',DB_POSTGRESDB_PORT:'5544',DB_POSTGRESDB_DATABASE:'postgres',DB_POSTGRESDB_USER:'postgres',DB_POSTGRESDB_PASSWORD:'unused',DB_POSTGRESDB_SCHEMA:'public',N8N_USER_FOLDER:folder,N8N_ENCRYPTION_KEY:randomBytes(32).toString('hex'),N8N_DIAGNOSTICS_ENABLED:'false',N8N_VERSION_NOTIFICATIONS_ENABLED:'false',N8N_PERSONALIZATION_ENABLED:'false',GENERIC_TIMEZONE:'Europe/Kyiv',N8N_LOG_LEVEL:'info',N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS:'true'};
async function run(args,input){return new Promise((resolve,reject)=>{const c=spawn(process.execPath,[bin,...args],{env,stdio:['pipe','pipe','pipe']});let output='';c.stdout.on('data',d=>output+=d);c.stderr.on('data',d=>output+=d);c.on('error',reject);c.on('exit',code=>code===0?resolve(output):reject(new Error(`n8n ${args[0]} failed (${code}): ${redact(output.slice(-4000))}`)));c.stdin.end(input);});}
try{
  await new Promise((resolve,reject)=>{const c=spawn('python',['scripts/n8n-import-memory.py'],{env:{...env,N8N_NODE_BIN:process.execPath,N8N_LOG_LEVEL:'error'},stdio:'inherit'});c.on('exit',code=>code===0?resolve():reject(new Error('n8n credential import failed')));});
  const files=(await readdir('n8n')).filter(file=>file.endsWith('.json')).sort();
  if(files.length!==6)throw new Error('Expected six workflow exports.');
  for(const [index,name] of files.entries()){
    const workflow=JSON.parse(await readFile(`n8n/${name}`,'utf8'));workflow.id=`MNAUVerify${String(index).padStart(6,'0')}`;
    const http=workflow.nodes.find(n=>n.type==='n8n-nodes-base.httpRequest');http.parameters.url=`${process.env.TEST_BASE_URL??'http://127.0.0.1:3001'}/api/machine/reports`;http.credentials={httpHeaderAuth:{id:'attendance-machine-test',name:'Attendance machine verification'}};
    const file=path.join(folder,name);await writeFile(file,JSON.stringify(workflow));await run(['import:workflow',`--input=${file}`]);
    const output=await run(['execute',`--id=${workflow.id}`,'--rawOutput']);
    if(!output.includes('READY'))throw new Error('n8n output did not contain a READY report: '+redact(output.slice(-1000)));
    console.log(`n8n ${name} completed READY through the machine endpoint.`);
    const repeated=await run(['execute',`--id=${workflow.id}`,'--rawOutput']);
    if(!repeated.includes('READY')||!/"reused"\s*:\s*true/.test(repeated))throw new Error(`Repeated ${name} did not return a persisted result.`);
  }
  const tables=(await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map(r=>r.table_name);
  if(tables.includes('Attendance'))throw new Error('Application migrations contaminated the n8n database.');
  console.log(`n8n internal database contains ${tables.length} tables and no application Attendance table.`);
}finally{await server.stop();await new Promise(resolve=>setTimeout(resolve,100));await db.close();}
