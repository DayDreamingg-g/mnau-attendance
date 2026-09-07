import {requireApi} from '@/lib/auth';
import {reportPreview,reportPeriod,parseReportKind} from '@/lib/reports';
import {apiError,HttpError} from '@/lib/errors';
export async function GET(request:Request){try{const u=await requireApi(),query=new URL(request.url).searchParams;for(const key of query.keys())if(query.getAll(key).length>1)throw new HttpError(400,'Фільтр не може повторюватися.');const body=Object.fromEntries(query),kind=parseReportKind(body.kind);if(!body.faculty)throw new HttpError(400,'Оберіть факультет.');const {summary,filters}=await reportPreview(u,body.faculty,reportPeriod(kind,body),kind);return Response.json({summary,filters,kind},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return apiError(e);}}
