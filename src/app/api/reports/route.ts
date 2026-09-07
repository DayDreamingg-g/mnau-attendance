import {checkOrigin,requireApi} from '@/lib/auth';
import {createReport,reportPeriod,readReportBody,parseReportKind} from '@/lib/reports';
import {apiError,HttpError} from '@/lib/errors';
export const maxDuration=120;
export async function POST(request:Request){try{checkOrigin(request);const u=await requireApi();const body=await readReportBody(request);const kind=parseReportKind(body.kind);if(typeof body.faculty!=='string'||!body.faculty)throw new HttpError(400,'Оберіть факультет.');const result=await createReport(u,body.faculty,reportPeriod(kind,body),kind);return Response.json(result,{status:result.state==='PENDING'?202:200});}catch(e){return apiError(e);}}
