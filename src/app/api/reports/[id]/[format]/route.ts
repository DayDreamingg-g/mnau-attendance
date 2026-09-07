import {requireApi} from '@/lib/auth';
import {reportScope} from '@/lib/access';
import {db} from '@/lib/db';
import {apiError,HttpError} from '@/lib/errors';
export async function GET(_request:Request,{params}:{params:Promise<{id:string;format:string}>}){try{const u=await requireApi(),{id,format}=await params;if(format!=='pdf'&&format!=='csv')throw new HttpError(404,'Формат не знайдено.');const r=await db.report.findFirst({where:{AND:[{id,state:'READY'},reportScope(u)]},select:{csv:true,pdf:true,fromDate:true,toDate:true}});if(!r||!r[format])throw new HttpError(404,'Файл недоступний.');return new Response(new Uint8Array(r[format]),{headers:{'Content-Type':format==='pdf'?'application/pdf':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="attendance-${r.fromDate}-${r.toDate}.${format}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return apiError(e);}}
