import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {percent} from './metrics';
import {readableRange} from './report-presentation';
import type {ReportSummary,ReportFilters} from './report-types';

// Landscape A4; rows wrap and continue safely across repeated table headers.
export async function reportPdf(summary:ReportSummary,f:ReportFilters){
  const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
  const font=await doc.embedFont(await readFile(path.join(process.cwd(),'public/fonts/DejaVuSans.ttf')),{subset:true});
  doc.setTitle(`TEST · MNAU Attendance · ${f.from}–${f.to}`);doc.setAuthor('MNAU Attendance');
  const ink=rgb(.12,.17,.26),muted=rgb(.36,.41,.49),border=rgb(.82,.85,.9),tint=rgb(.94,.96,.98);
  let page=doc.addPage([842,595]),y=561;
  const text=(value:string,x:number,top:number,size=9)=>page.drawText(value,{x,y:top-size,size,font,color:ink});
  function wrap(value:unknown,width:number,size:number){
    const result:string[]=[];
    for(const paragraph of String(value??'').replace(/[\u0000-\u0009\u000b-\u001f]/g,' ').split('\n')){
      let line='';for(const word of paragraph.split(/ +/u)){const joined=line?line+' '+word:word;if(font.widthOfTextAtSize(joined,size)<=width){line=joined;continue;}if(line)result.push(line);line='';for(const char of word){if(font.widthOfTextAtSize(line+char,size)>width&&line){result.push(line);line='';}line+=char;}}
      result.push(line);
    }return result;
  }
  function paragraph(value:string,size=9){for(const line of wrap(value,774,size)){if(y<50){page=doc.addPage([842,595]);y=561;}text(line,34,y,size);y-=size+4;}y-=5;}
  paragraph('TEST · MNAU Attendance',18);
  if(summary.teacher)paragraph([summary.teacher.name,summary.teacher.position].filter(Boolean).join(' · '),11);
  else if(summary.scope)paragraph(summary.scope,10);
  paragraph(readableRange(f.from,f.to),11);
  const cards=[['Студентів',String(summary.students)],['Груп',String(summary.groups)],['Відвідуваність',percent(summary.stats.percentage)],['Нижче 70% / 50%',`${summary.below70.length} / ${summary.below50}`]];
  for(const [i,[label,value]] of cards.entries()){const x=34+i*196;page.drawRectangle({x,y:y-48,width:186,height:48,color:tint,borderColor:border,borderWidth:.5});text(label,x+10,y-8,8);text(value,x+10,y-24,12);}y-=61;
  paragraph('PRESENT / (PRESENT + N) × 100. HV та невідмічені виключено. Онлайн / офлайн уточнюють PRESENT.',8);
  paragraph(`Формат не вказано: ${Math.max(0,summary.stats.PRESENT-(summary.stats.ONLINE??0)-(summary.stats.OFFLINE??0))}. Незавершених журналів: ${summary.incompleteLessons??0}.`,8);
  const students=f.view==='STUDENTS';
  const headers=students?['ПІБ','Група','Всього\nзанять','PRESENT','N','HV','Онлайн','Офлайн','Не\nвідмічено','Показник %']:['Дата / час','Пара','Дисципліна','Група','Склад','PRESENT','N','HV','Онлайн','Офлайн','Не\nвідмічено','Показник %'];
  const weights=students?[202,79,57,57,32,32,49,49,62,65]:[83,30,165,66,42,54,28,28,48,48,58,60];
  const widths=weights.map(w=>w*774/weights.reduce((a,b)=>a+b,0));
  function paint(lines:string[][],height:number,header=false,striped=false){
    let x=34;for(const [i,width] of widths.entries()){page.drawRectangle({x,y:y-height,width,height,color:header?tint:striped?rgb(.98,.985,.99):rgb(1,1,1),borderColor:border,borderWidth:.5});for(const [j,line] of lines[i].entries())text(line,x+5,y-6-j*12,header?8:8.3);x+=width;}y-=height;
  }
  const headLines=headers.map((h,i)=>wrap(h,widths[i]-10,8));
  const headHeight=Math.max(...headLines.map(l=>l.length))*12+12;
  function nextPage(){page=doc.addPage([842,595]);y=561;text(`TEST · ${students?'Студенти':'Пари'} · ${f.from}–${f.to}`,34,y,9);y-=24;paint(headLines,headHeight,true);}
  if(y<headHeight+70)nextPage();else paint(headLines,headHeight,true);
  function row(cells:unknown[],index:number){
    const lines=cells.map((c,i)=>wrap(c,widths[i]-10,8.3));
    let remaining=Math.max(...lines.map(l=>l.length)),offset=0;
    while(remaining>0){if(y<78)nextPage();const take=Math.min(remaining,Math.floor((y-46-12)/12));paint(lines.map(l=>l.slice(offset,offset+take)),take*12+12,false,index%2===1);offset+=take;remaining-=take;if(remaining>0)nextPage();}
  }
  const cells=(s:ReportSummary['stats'])=>[s.PRESENT,s.N,s.HV,s.ONLINE??0,s.OFFLINE??0,s.unmarked,percent(s.percentage)];
  if(students){
    const rows=[...(summary.rows??[])].sort((a,b)=>(a.stats.percentage??Infinity)-(b.stats.percentage??Infinity)||a.fullName.localeCompare(b.fullName,'uk'));
    rows.forEach((s,i)=>row([s.fullName,s.groupName,s.stats.expected,...cells(s.stats)],i));
    row(['Підсумок','',summary.stats.expected,...cells(summary.stats)],rows.length);
  }else{
    const lessons=summary.lessons??[];
    lessons.forEach((l,i)=>row([l.date.split('-').reverse().join('.')+'\n'+l.time,l.pair,[l.subject,...(summary.teacher?[]:[l.teacher]),...(l.onlineUrl?['Онлайн-посилання: '+l.onlineUrl]:[])].join('\n'),l.group,l.stats.expected,...cells(l.stats)],i));
    row(['Підсумок','','','',summary.stats.expected,...cells(summary.stats)],lessons.length);
  }
  for(const [i,p] of doc.getPages().entries())p.drawText(`TEST · Не офіційний журнал · Сторінка ${i+1} / ${doc.getPageCount()}`,{x:34,y:24,size:8,font,color:muted});
  return Buffer.from(await doc.save());
}
