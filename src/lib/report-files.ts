import {xlsx} from './xlsx';
import {reportPdf} from './report-pdf';
import type {ReportSummary,ReportFilters} from './report-types';
export function csvEscape(value:unknown){let text=String(value??'');if(/^[\s\u0000-\u001f]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export const reportCountHeaders=['PRESENT','N','HV','Онлайн','Офлайн','Не відмічено','Показник %'];
export function reportCountCells(s:ReportSummary['stats']){return [s.PRESENT,s.N,s.HV,s.ONLINE??0,s.OFFLINE??0,s.unmarked,s.percentage??'Немає даних'];}
export function sortedReportStudents(summary:ReportSummary){return [...(summary.rows??[])].sort((a,b)=>(a.stats.percentage??Infinity)-(b.stats.percentage??Infinity)||a.fullName.localeCompare(b.fullName,'uk'));}
export function reportTable(summary:ReportSummary,f:ReportFilters){
  if(f.view==='STUDENTS')return [['Контекст','Від','До','ПІБ','Група','Всього занять',...reportCountHeaders],
    ...sortedReportStudents(summary).map(s=>['TEST',f.from,f.to,s.fullName,s.groupName,s.stats.expected,...reportCountCells(s.stats)]),
    ['TEST',f.from,f.to,'Підсумок','',summary.stats.expected,...reportCountCells(summary.stats)]];
  return [['Контекст','Від','До','Викладач','Дисципліна','Група','Дата','Час','Пара','Студент × заняття',...reportCountHeaders,'Онлайн-посилання'],
    ...(summary.lessons??[]).map(l=>['TEST',f.from,f.to,l.teacher,l.subject,l.group,l.date,l.time,l.pair,l.stats.expected,...reportCountCells(l.stats),l.onlineUrl??'']),
    ['TEST',f.from,f.to,'Підсумок','','','','','',summary.stats.expected,...reportCountCells(summary.stats),'']];
}
export function reportXlsx(summary:ReportSummary,f:ReportFilters){return xlsx([
  {name:'Заняття',rows:reportTable(summary,{...f,view:'LESSONS'})},
  {name:'Студенти',rows:reportTable(summary,{...f,view:'STUDENTS'})},
]);}
export async function reportFiles(summary:ReportSummary,f:ReportFilters){
  const csv=Buffer.from('\ufeff'+reportTable(summary,f).map(r=>r.map(csvEscape).join(';')).join('\r\n'),'utf8');
  return {csv,pdf:await reportPdf(summary,f),xlsx:reportXlsx(summary,f)};
}
