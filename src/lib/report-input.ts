import {readJson} from './request-body';
import {DateTime} from 'luxon';
import {HttpError} from './errors';
import {parseFilters} from './filters';
import {today,ZONE} from './time';
import type {ReportKind,ReportFilters} from './report-types';
export function parseReportKind(value:unknown):ReportKind {
  if(value!=='DAILY'&&value!=='WEEKLY'&&value!=='MONTHLY')throw new HttpError(400,'Оберіть тип звіту.');
  return value;
}

export function reportBody(value:unknown):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400,'Некоректний запит звіту.');
  return value as Record<string,unknown>;
}

export function reportPeriod(kind:ReportKind,body:Record<string,unknown>):ReportFilters{
  const now=DateTime.fromISO(today(),{zone:ZONE});
  const period=kind==='MONTHLY'?now.minus({months:1}):kind==='WEEKLY'?now.minus({weeks:1}):now;
  const defaults=kind==='DAILY'?{from:today(),to:today()}:{from:period.startOf(kind==='WEEKLY'?'week':'month').toISODate()!,to:period.endOf(kind==='WEEKLY'?'week':'month').toISODate()!};
  const search:Record<string,string>={...defaults};
  for(const k of ['from','to','course','specialty','group','threshold','subject','term','scope'])if(body[k]!==undefined){if(typeof body[k]!=='string'&&typeof body[k]!=='number')throw new HttpError(400,'Некоректні фільтри звіту.');search[k]=String(body[k]);}
  if(body.student!==undefined&&(typeof body.student!=='string'||body.student.length>100))throw new HttpError(400,'Некоректний студент.');
  return {...parseFilters(search),student:typeof body.student==='string'&&body.student?body.student:undefined};
}

export async function readReportBody(request:Request):Promise<Record<string,unknown>> {
  try{return reportBody(await readJson(request));}catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,'Некоректний JSON запиту.');}
}
