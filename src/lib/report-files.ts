import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {xlsx} from './xlsx';
import type {ReportSummary,ReportFilters} from './report-types';
import {percent} from './metrics';
export function csvEscape(value:unknown){let text=String(value??'');if(/^[\s\u0000-\u001f]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function reportTable(summary:ReportSummary,f:ReportFilters){
  if(f.view==='STUDENTS')return [['Контекст','Від','До','ПІБ','Група','Усього пар','PRESENT','N','HV','Не відмічено','Показник %'],...summary.rows.map(s=>['TEST',f.from,f.to,s.fullName,s.groupName,s.stats.expected,s.stats.PRESENT,s.stats.N,s.stats.HV,s.stats.unmarked,s.stats.percentage??'Немає даних']),['TEST',f.from,f.to,'Підсумок','',summary.stats.expected,summary.stats.PRESENT,summary.stats.N,summary.stats.HV,summary.stats.unmarked,summary.stats.percentage??'Немає даних']];
  return [['Контекст','Від','До','Викладач','Дисципліна','Група','Дата','Час','Пара','Студент × заняття','PRESENT','N','HV','Не відмічено','Показник %','Онлайн-посилання'],
    ...(summary.lessons??[]).map(l=>['TEST',f.from,f.to,l.teacher,l.subject,l.group,l.date,l.time,l.pair,l.stats.expected,l.stats.PRESENT,l.stats.N,l.stats.HV,l.stats.unmarked,l.stats.percentage??'Немає даних',l.onlineUrl??'']),
    ['TEST',f.from,f.to,'Підсумок','','','','','',summary.stats.expected,summary.stats.PRESENT,summary.stats.N,summary.stats.HV,summary.stats.unmarked,summary.stats.percentage??'Немає даних','']];
}
export function reportXlsx(summary:ReportSummary,f:ReportFilters){return xlsx([{name:'Заняття',rows:reportTable(summary,{...f,view:'LESSONS'})},{name:'Студенти',rows:[['TEST','ПІБ','Група','PRESENT','N','HV','Не відмічено','Показник %'],...(summary.rows??[]).map(s=>['TEST',s.fullName,s.groupName,s.stats.PRESENT,s.stats.N,s.stats.HV,s.stats.unmarked,s.stats.percentage??'Немає даних'])]}]);}
export async function reportFiles(summary:ReportSummary,f:ReportFilters){
  const table=reportTable(summary,f),csv=Buffer.from('\ufeff'+table.map(r=>r.map(csvEscape).join(';')).join('\r\n'),'utf8');
  const workbook=reportXlsx(summary,f);
  const doc=await PDFDocument.create();doc.registerFontkit(fontkit);const font=await doc.embedFont(await readFile(path.join(process.cwd(),'public/fonts/DejaVuSans.ttf')),{subset:true});
  doc.setTitle(`TEST · MNAU Attendance · ${f.from}–${f.to}`);doc.setAuthor('MNAU Attendance');
  let page=doc.addPage([842,595]),y=560;
  function text(value:string,size=10){
    const words=value.replace(/[\u0000-\u001f]/g,' ').split(' ');let line='';const lines:string[]=[];
    for(const word of words){for(const part of word.match(/.{1,90}/gu)??['']){if(font.widthOfTextAtSize(line+' '+part,size)>774&&line){lines.push(line);line=part;}else line+=(line?' ':'')+part;}}if(line)lines.push(line);
    for(const line of lines){if(y<48){page=doc.addPage([842,595]);y=560;}page.drawText(line,{x:34,y,size,font,color:rgb(.12,.17,.26)});y-=size+5;}
  }
  text('TEST · MNAU Attendance',18);
  if(summary.teacher)text([summary.teacher.name,summary.teacher.position].filter(Boolean).join(' · '),12);
  text(`${f.from} — ${f.to} · ${summary.scope}`,11);
  text(`Унікальних студентів: ${summary.students} · Занять: ${summary.lessonCount??0} · Студент × заняття: ${summary.stats.expected}`);
  text(`PRESENT: ${summary.stats.PRESENT} · N: ${summary.stats.N} · HV: ${summary.stats.HV} · Не відмічено: ${summary.stats.unmarked} · ${percent(summary.stats.percentage)}`);
  text(`PRESENT / (PRESENT + N) × 100. HV та невідмічені виключено. Незавершених журналів: ${summary.incompleteLessons??0}.`,9);y-=10;
  if(f.view==='STUDENTS'){for(const s of [...summary.rows].sort((a,b)=>(a.stats.percentage??Infinity)-(b.stats.percentage??Infinity)||a.fullName.localeCompare(b.fullName,'uk'))){if(y<96){page=doc.addPage([842,595]);y=560;}text(s.fullName+' · '+s.groupName,11);text(`Усього пар: ${s.stats.expected} · PRESENT ${s.stats.PRESENT} · N ${s.stats.N} · HV ${s.stats.HV} · Не відмічено ${s.stats.unmarked} · ${percent(s.stats.percentage)}`,9);y-=8;}}
  else for(const l of summary.lessons??[]){
    if(y<138){page=doc.addPage([842,595]);y=560;}
    text(`${l.date} · ${l.time} · ${l.pair} пара · ${l.group}`,11);text(`${l.subject} · ${l.teacher}`,10);
    text(`Склад: ${l.stats.expected} · PRESENT ${l.stats.PRESENT} · N ${l.stats.N} · HV ${l.stats.HV} · Не відмічено ${l.stats.unmarked} · ${percent(l.stats.percentage)}`,9);
    if(l.onlineUrl)text('Онлайн: '+l.onlineUrl,8);y-=10;
  }
  for(const [i,p] of doc.getPages().entries())p.drawText(`TEST · Не офіційний журнал · Сторінка ${i+1} / ${doc.getPageCount()}`,{x:34,y:24,size:8,font});
  return {csv,pdf:Buffer.from(await doc.save()),xlsx:workbook};
}
