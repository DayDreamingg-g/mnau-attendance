import {checkOrigin,requireApi} from '@/lib/auth';
import {journal,saveJournal} from '@/lib/journal';
import {apiError,HttpError} from '@/lib/errors';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const data=await journal(await requireApi(),(await params).id);return Response.json({id:data.lesson.id,version:data.lesson.version,state:data.lesson.journalState,rows:data.rows,canConfirm:data.canConfirm,needsReason:data.needsReason});}catch(e){return apiError(e);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{checkOrigin(request);const user=await requireApi();if(Number(request.headers.get('content-length')??0)>100000)throw new HttpError(413,'Запит завеликий.');const result=await saveJournal(user,(await params).id,await request.json());return Response.json({ok:true,...result});}catch(e){return apiError(e);}}
