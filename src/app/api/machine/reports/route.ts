import {machineUser,readReportBody} from '@/lib/reports';
import {reportAutomation} from '@/lib/report-automation';
import {apiError,HttpError} from '@/lib/errors';
export const maxDuration=120;
export async function POST(request:Request){
  let operation='UNPARSED';
  try{
    const user=await machineUser(request),body=await readReportBody(request);
    operation=body.action===undefined?'REPORT':['REPORT','WEEKLY_CURATORS','ALERT70','ALERT50'].includes(String(body.action))?String(body.action):'INVALID';
    const result=await reportAutomation(user,body);
    // Workflows opt into HTTP retry when another execution still owns the report lease.
    if(body.requireReady===true&&result.state==='PENDING')return Response.json({...result,error:'Звіт ще формується. Повторіть запит через 5 секунд.'},{status:503,headers:{'Retry-After':'5'}});
    return Response.json(result,{status:result.state==='PENDING'?202:200});
  }catch(e){console.error('Report automation failed',{operation,status:e instanceof HttpError?e.status:503});return apiError(e);}
}
