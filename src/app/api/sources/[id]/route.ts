import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {requireApi} from '@/lib/auth';
import {canViewSources,groupScope,lessonScope} from '@/lib/access';
import {db} from '@/lib/db';
import {apiError,HttpError} from '@/lib/errors';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
 const u=await requireApi(),{id}=await params;
 const asset=await db.sourceAsset.findUnique({where:{id}});
 if(asset){
  const ids=Array.isArray(asset.groupIds)?asset.groupIds.filter((x):x is string=>typeof x==='string'):[];
  if(!canViewSources(u)||!ids.length||await db.group.count({where:{AND:[groupScope(u),{id:{in:ids}}]}})!==ids.length)throw new HttpError(403,'Повний файл містить групи поза вашою областю доступу.');
  return new Response(new Uint8Array(asset.content),{headers:{'Content-Type':asset.mimeType,'Content-Disposition':`attachment; filename="source.docx"; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 const record=await db.sourceRecord.findFirst({where:{id,lessons:{some:lessonScope(u)}}});
 if(!record)throw new HttpError(404,'Джерело недоступне.');
 if(!/^[1-4]-kurs(?: \(1\))?\.pdf$/.test(record.file))return Response.json({file:record.file,page:record.page,fields:record.data,issues:record.issues},{headers:{'Cache-Control':'private, no-store'}});
 const file=await readFile(path.join(process.cwd(),'source-data/cs-beta',record.file));
 return new Response(file,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="schedule.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return apiError(e);}}
