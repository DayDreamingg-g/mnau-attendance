import {requireUser} from '@/lib/auth';
import {groupScope,studentScope,lessonScope} from '@/lib/access';
import {db} from '@/lib/db';
import {PageTitle,Panel} from '@/components/ui';
import type {Search} from '@/lib/filters';
export default async function Sources({searchParams}:{searchParams:Promise<Search>}){
  const u=await requireUser(),p=await searchParams,q=typeof p.q==='string'?p.q.slice(0,100):'';
  const groups=await db.group.findMany({where:groupScope(u),select:{id:true}});
  const records=await db.sourceRecord.findMany({where:{AND:[q?{raw:{contains:q,mode:'insensitive'}}:{},{OR:[{lessons:{some:lessonScope(u)}},...groups.map(g=>({data:{path:['groups'],array_contains:[g.id]}}))]}]},orderBy:[{file:'asc'},{id:'asc'}]});
  const students=await db.student.findMany({where:{AND:[studentScope(u),{isSynthetic:false},q?{fullName:{contains:q,mode:'insensitive'}}:{}]},select:{id:true,fullName:true,source:true},orderBy:{fullName:'asc'}});
  const teachers=await db.teacher.findMany({where:{lessons:{some:lessonScope(u)},...(q?{displayName:{contains:q,mode:'insensitive'}}:{})},select:{id:true,displayName:true,source:true},orderBy:{displayName:'asc'}});
  return <><PageTitle eyebrow="ПОХОДЖЕННЯ ДАНИХ" title="Джерела даних" description="Кожне заняття посилається на PDF, сторінку та клітинку; студент — на вихідне ПІБ у DOCX."/>
    <Panel title="Computer Science beta"><div className="pad stack"><p>Реальний roster: КН 1/1 — 17, КН 3/1 — 20, КН 3/2 — 21 студент з наданого списку. КН 2/1 та КН 4/1 заповнюють старости.</p><p>14–20.09.2026: нижня половина (DENOMINATOR). 21–27.09.2026: верхня (NUMERATOR). Далі — чергування від цієї базової дати.</p><p>Варіанти імен Пархоменко та Богатенкової об’єднані за підтвердженням власника проєкту. Оригінальний текст збережено. «Вакансія» не є викладачем.</p><p>Демонстраційні відмітки мають окрему позначку DEMO; імпорт реальних студентів не створює відвідуваність.</p></div></Panel>
    <form className="filters section-space"><label>Пошук<input name="q" defaultValue={q}/></label><button className="button primary">Знайти</button></form>
    <Panel title={'Студенти · '+students.length}>{students.map(s=><details className="source-record" key={s.id}><summary>{s.fullName}</summary><pre>{JSON.stringify(s.source,null,2)}</pre></details>)}</Panel>
    <div className="section-space"><Panel title={'Викладачі · '+teachers.length}>{teachers.map(t=><details className="source-record" key={t.id}><summary>{t.displayName}</summary><pre>{JSON.stringify(t.source,null,2)}</pre></details>)}</Panel></div>
    <Panel title={'Вихідні клітинки · '+records.length}>{records.map(r=><details className="source-record" key={r.id}><summary>{r.file} · стор. {r.page} · {r.raw.split('\n')[0]}</summary><pre>{r.raw}</pre><p className="small muted">Клітинка: {JSON.stringify(r.bbox)}</p>{Array.isArray(r.issues)&&r.issues.map((issue,i)=><p key={i}>{String(issue)}</p>)}</details>)}</Panel></>;
}
