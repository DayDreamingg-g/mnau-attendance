import {reportXlsx} from '@/lib/report-files';
import type {ReportFilters,ReportSummary} from '@/lib/report-types';
import {assertSavedReportAccess} from '@/lib/report-access';
import {requireApi} from '@/lib/auth';
import {reportScope} from '@/lib/access';
import {db} from '@/lib/db';
import {apiError,HttpError} from '@/lib/errors';
export async function GET(_request:Request,{params}:{params:Promise<{id:string;format:string}>}){try{const u=await requireApi(),{id,format}=await params;if(format!=='pdf'&&format!=='csv'&&format!=='xlsx')throw new HttpError(404,'Формат не знайдено.');const r=await db.report.findFirst({where:{AND:[{id,state:'READY'},reportScope(u)]},select:{filters:true,facultyId:true,summary:true,csv:true,pdf:true,xlsx:true,fromDate:true,toDate:true}});if(!r)throw new HttpError(404,'Файл недоступний.');await assertSavedReportAccess(u,r);const bytes=r[format]??(format==='xlsx'&&r.summary?reportXlsx(r.summary as unknown as ReportSummary,r.filters as ReportFilters):null);if(!bytes)throw new HttpError(404,'Файл недоступний.');return new Response(new Uint8Array(bytes),{headers:{'Content-Type':format==='pdf'?'application/pdf':format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="attendance-${r.fromDate}-${r.toDate}.${format}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return apiError(e);}}
