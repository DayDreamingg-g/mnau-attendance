import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/lib/db';
import {principalSelect} from '../src/lib/auth';
import {journal} from '../src/lib/journal';
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3001';
const origin=process.env.APP_ORIGIN!;
try{
  const user=await db.user.findUniqueOrThrow({where:{email:'teacher@test.com'},select:principalSelect});
  const lesson=await db.lesson.findFirstOrThrow({where:{id:{startsWith:'demo-live-'},teacherId:user.teacher!.id}});
  const before=await journal(user,lesson.id);
  const row=before.rows.find(r=>r.editable)!;
  const status=row.status==='N'?'PRESENT':'N';
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({email:'teacher@test.com',password:'Test1234!'})});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie')!.split(';')[0];
  const response=await fetch(base+'/api/lessons/'+lesson.id,{method:'POST',headers:{origin,cookie,'Content-Type':'application/json'},body:JSON.stringify({version:before.lesson.version,requestId:randomUUID(),mode:'CONFIRM',rows:[{studentId:row.id,status}]})});
  assert.equal(response.status,200,await response.clone().text());
  assert.equal((await journal(user,lesson.id)).rows.find(r=>r.id===row.id)!.status,status);
  assert.ok(await db.auditLog.findFirst({where:{lessonId:lesson.id,studentId:row.id,newStatus:status}}));
  console.log('HTTP journal save persists and is audited after all six n8n CLI workflows and their database have stopped.');
}finally{await db.$disconnect();}
