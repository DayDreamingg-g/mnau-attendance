import {roleLabels} from '@/lib/role-labels';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {DateTime} from 'luxon';
import {requireUser,isManager} from '@/lib/auth';
import {db} from '@/lib/db';
import {PageTitle,Panel,Empty} from '@/components/ui';
import {ActionForm} from '@/components/action-form';
import {ActionDialog} from '@/components/action-dialog';
import {atKyiv,timestampLabel} from '@/lib/time';
import {displayName} from '@/lib/display-name';
import {feedbackVisibility,feedbackStates as states} from '@/lib/feedback';

export default async function Feedback({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const u=await requireUser();if(!isManager(u))notFound();
  const p=await searchParams,page=Math.max(1,Math.min(10000,Number(p.page)||1));
  const state=p.state&&Object.hasOwn(states,p.state)?p.state:undefined,showDeleted=p.deleted==='1';
  const from=p.from&&/^\d{4}-\d{2}-\d{2}$/.test(p.from)&&DateTime.fromISO(p.from).isValid?atKyiv(p.from,'00:00:00'):undefined;
  const items=await db.feedback.findMany({
    where:{...feedbackVisibility(showDeleted),state,createdAt:from?{gte:from}:undefined,roles:p.role?{array_contains:[p.role]}:undefined},
    include:{user:{select:{name:true,email:true}},deletedBy:{select:{name:true}}},orderBy:{createdAt:'desc'},skip:(page-1)*30,take:30,
  });
  const pageLink=(next:number)=>'?'+new URLSearchParams({...Object.fromEntries(Object.entries(p).filter((entry):entry is [string,string]=>entry[1]!==undefined)),page:String(next)});
  return <>
    <PageTitle title="Відгуки" description="Повідомлення користувачів про роботу сайту."/>
    <form className="filters">
      <label>Від дати<input name="from" type="date" defaultValue={p.from}/></label>
      <label>Роль<select name="role" defaultValue={p.role??''}><option value="">Усі</option>{['TEACHER','STAROSTA','CURATOR','DEAN_OFFICE','ADMIN','DEVELOPER'].map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}</select></label>
      <label>Стан<select name="state" defaultValue={state??''}><option value="">Усі</option>{Object.entries(states).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label className="check-label"><input name="deleted" type="checkbox" value="1" defaultChecked={showDeleted}/>Показати видалені</label>
      <button className="button">Застосувати</button>
    </form>
    <div className="section-space"><Panel title="Повідомлення">
      {!items.length?<Empty>Відгуків за цими фільтрами немає.</Empty>:items.map(f=><details className="source-record" key={f.id}>
        <summary><span className="feedback-summary"><span className="status">{f.deletedAt?'Видалено':states[f.state as keyof typeof states]}</span><strong>{displayName(f.user.name)}</strong><span className="small muted">{Array.isArray(f.roles)?f.roles.map(r=>roleLabels[String(r)]??String(r)).join(', '):'—'}</span><time dateTime={f.createdAt.toISOString()}>{timestampLabel(f.createdAt)}</time></span></summary>
        <div className="pad stack">
          <p>{f.user.email} · {f.workspace?roleLabels[f.workspace]??f.workspace:'Спільний простір'}</p>
          <Link className="text-link" href={f.page}>Сторінка звернення</Link><p className="feedback-text">{f.text}</p>
          {f.deletedAt?<div><p>Видалено: {timestampLabel(f.deletedAt)} · {f.deletedBy?displayName(f.deletedBy.name):'—'}</p><p>Причина: {f.deleteReason}</p><p>Попередній стан: {states[f.state as keyof typeof states]}</p></div>:<>
            <ActionForm url="/api/admin/release" values={{action:'FEEDBACK_STATE',id:f.id}} label="Змінити стан"><label>Стан<select name="state" defaultValue={f.state}>{Object.entries(states).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label></ActionForm>
            <ActionDialog title="Видалити" url="/api/admin/release" values={{action:'FEEDBACK_DELETE',id:f.id}} label="Видалити відгук" danger confirm>
              <p><strong>{displayName(f.user.name)}</strong> · {timestampLabel(f.createdAt)}</p>
              <p className="feedback-text">{f.text}</p>
              <p>Відгук буде приховано зі списку. Історія залишиться в аудиті.</p>
              <label>Причина видалення<textarea name="reason" required minLength={5} maxLength={500}/></label>
            </ActionDialog>
          </>}
        </div>
      </details>)}
    </Panel></div>
    <div className="tabs">{page>1&&<Link href={pageLink(page-1)}>Попередня</Link>}{items.length===30&&<Link href={pageLink(page+1)}>Наступна</Link>}</div>
  </>;
}
