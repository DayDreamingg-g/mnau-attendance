import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {canViewSources} from '@/lib/access';
import {betaUIScope} from '@/lib/beta-ui';
import {db} from '@/lib/db';
import {PageTitle,Panel} from '@/components/ui';
import {dateLabel,timeLabel} from '@/lib/time';
import type {Search} from '@/lib/filters';
const labels:Record<string,string>={IMPORT:'Імпорт',MANUAL:'Ручне додавання',TRANSFER:'Переведення',ARCHIVE:'Архівовано'};
export default async function Sources({searchParams}:{searchParams:Promise<Search>}){
  const u=await requireUser();if(!canViewSources(u))notFound();
  const p=await searchParams,q=typeof p.q==='string'?p.q.slice(0,100):'',type=typeof p.type==='string'&&p.type in labels?p.type:'';
  const groups=await db.group.findMany({where:betaUIScope(u),select:{id:true,name:true}}),ids=groups.map(g=>g.id);
  const records=await db.sourceRecord.findMany({where:{lessons:{some:{cancelled:false,groups:{some:{groupId:{in:ids}}}}},...(q?{raw:{contains:q,mode:'insensitive'}}:{})},orderBy:[{file:'asc'},{id:'asc'}]});
  const allStudents=await db.student.findMany({where:{groupId:{in:ids},isSynthetic:false,...(q?{fullName:{contains:q,mode:'insensitive'}}:{})},select:{id:true,fullName:true,source:true,active:true},orderBy:{fullName:'asc'}});
  const changes=await db.auditLog.findMany({where:{groupId:{in:ids},objectType:'Student'},include:{actor:{select:{name:true}}},orderBy:{createdAt:'desc'}});
  const students=allStudents.filter(s=>{const source=s.source as {type?:string}|null;return !type||type==='IMPORT'&&(source?.type??'IMPORT')==='IMPORT'||type==='MANUAL'&&source?.type==='MANUAL'||type==='ARCHIVE'&&!s.active||type==='TRANSFER'&&changes.some(c=>c.studentId===s.id&&(c.details as {action?:string}|null)?.action==='TRANSFER');});
  const imported=allStudents.filter(s=>(s.source as {type?:string}|null)?.type!=='MANUAL').length,manual=allStudents.length-imported;
  return <><PageTitle eyebrow="ПОХОДЖЕННЯ ДАНИХ" title="Джерела даних" description="Офіційні списки, ручні зміни та вихідні клітинки розкладу."/>
    <Panel title="Комп’ютерні науки · beta"><div className="pad stack"><p>Імпорт зі списку груп: <strong>{imported}</strong>. Ручне додавання: <strong>{manual}</strong>. Архівовано: <strong>{allStudents.filter(s=>!s.active).length}</strong>.</p><p>14–20.09.2026 — знаменник (нижня половина). 21–27.09.2026 — чисельник (верхня половина). Далі тижні чергуються.</p></div></Panel>
    <form className="filters section-space"><label>Пошук<input name="q" defaultValue={q}/></label><label>Джерело / зміна<select name="type" defaultValue={type}><option value="">Усі</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button className="button primary">Знайти</button></form>
    <Panel title={'Студенти · '+students.length}>{students.map(s=>{const source=s.source as {type?:string;actualFile?:string;file?:string;page?:number;rawName?:string;actorName?:string;createdAt?:string;reason?:string}|null;const origin=source?.type==='MANUAL'?'MANUAL':'IMPORT';return <details className="source-record" key={s.id}><summary>{s.fullName} <span className="tag">{labels[origin]}</span>{!s.active&&<span className="tag">Архівовано</span>}</summary>{origin==='IMPORT'?<p>{source?.actualFile??source?.file??'Список груп'} · стор. {source?.page??'—'}<br/>Оригінальне ПІБ: {source?.rawName??s.fullName}</p>:<p>Додав: {source?.actorName??'Користувач'} · {source?.createdAt??'—'}<br/>Причина: {source?.reason??'Див. журнал змін'}</p>}{changes.filter(c=>c.studentId===s.id).map(c=>{const data=c.details as {action?:string;before?:{groupId?:string};after?:{groupId?:string}}|null;const groupName=(id?:string)=>groups.find(g=>g.id===id)?.name??'Інша група';return <p className="source-event" key={c.id}><span className="tag">{labels[data?.action??'']??'Зміна'}</span> {c.actor?.name??'Відновлення beta'} · {dateLabel(c.createdAt)} {timeLabel(c.createdAt)}{data?.action==='TRANSFER'&&<> · {groupName(data.before?.groupId)} → {groupName(data.after?.groupId)}</>}<br/>{c.reason}</p>;})}</details>;})}</Panel>
    <div className="section-space"><Panel title={'Вихідні клітинки розкладу · '+records.length}>{records.map(r=><details className="source-record" key={r.id}><summary>{r.file} · стор. {r.page} · {r.raw.split('\n')[0]}</summary><pre>{r.raw}</pre><p className="small muted">Клітинка: {JSON.stringify(r.bbox)}</p>{Array.isArray(r.issues)&&r.issues.map((issue,i)=><p key={i}>{String(issue)}</p>)}</details>)}</Panel></div></>;
}
