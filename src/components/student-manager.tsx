'use client';
import {useState,useRef} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {Dialog} from './dialog';
type Student={id:string;fullName:string;phone:string|null;active:boolean;isSynthetic:boolean;userId:string|null;sourceType?:string};
type Props={groupId:string;groupName:string;students:Student[];transferGroups:{id:string;name:string}[];canCreateAccount:boolean;canDelete:boolean};
type Tab='PROFILE'|'TRANSFER'|'ARCHIVE'|'ACCOUNT';
export function StudentManager({groupId,groupName,students,transferGroups,canCreateAccount,canDelete}:Props){
  const router=useRouter(),inFlight=useRef(false);
  const [editing,setEditing]=useState<string|null>(null),[tab,setTab]=useState<Tab>('PROFILE'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[archived,setArchived]=useState(false);
  const [credentials,setCredentials]=useState<{email:string;password:string}|null>(null),[copied,setCopied]=useState('');
  const selected=students.find(s=>s.id===editing);
  function open(id:string){setEditing(id);setTab('PROFILE');setError('');setMessage('');setCredentials(null);}
  function close(){if(!busy){setEditing(null);setCredentials(null);setError('');setCopied('');}}
  async function submit(event:React.FormEvent<HTMLFormElement>,action:string){
    event.preventDefault();if(inFlight.current)return;
    const data=Object.fromEntries(new FormData(event.currentTarget));
    const account=action==='ACCOUNT';
    const body=account?{...data,studentId:selected!.id}:{...data,action,groupId,...(selected?{studentId:selected.id}:{}),...(action==='DELETE'?{confirmDelete:data.confirmDelete==='on'}:{})};
    inFlight.current=true;setBusy(true);setError('');setMessage('');
    try{
      const response=await fetch(account?'/api/students/accounts':'/api/students',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json();if(!response.ok)throw new Error(result.error??'Не вдалося зберегти.');
      if(account){setCredentials({email:result.email,password:result.password});setEditing(null);}
      else{setEditing(null);setMessage(action==='ADD'?'Студента додано.':action==='ARCHIVE'?'Студента архівовано.':action==='DELETE'?'Студента видалено.':'Зміни збережено.');}
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'Помилка з’єднання.');}finally{inFlight.current=false;setBusy(false);}
  }
  const reason=<label>Причина / джерело зміни<input name="reason" required minLength={5} maxLength={500} disabled={busy}/></label>;
  const buttons=(label:string)=><div className="dialog-actions"><button className="button primary" disabled={busy}>{busy?'Збереження…':label}</button><button type="button" className="button" disabled={busy} onClick={close}>Скасувати</button></div>;
  const visible=students.filter(s=>s.active||archived);
  return <div className="pad stack" aria-busy={busy}>
    <div className="roster-toolbar"><button className="button primary" disabled={busy} onClick={()=>open('new')}>+ Додати студента</button><label className="inline-check"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>Показати архівованих</label></div>
    {message&&<p className="form-success" role="status">{message}</p>}
    {!visible.length?<p>У групі ще немає студентів.</p>:<div className="table-scroll"><table><thead><tr><th>ПІБ</th><th>Телефон</th><th>Стан</th><th>Джерело</th><th>Дії</th></tr></thead><tbody>{visible.map(s=><tr key={s.id} className="student-manage-row" onClick={()=>open(s.id)}><td><button type="button" className="text-link student-name" onClick={e=>{e.stopPropagation();open(s.id);}}>{s.fullName}</button></td><td>{s.phone??'Не вказано'}</td><td>{s.active?'Активний':'Архівований'}</td><td>{s.isSynthetic?'Демонстраційний список':s.sourceType==='MANUAL'?'Ручне додавання':'Офіційний список'}</td><td><button className="button" aria-label={'Керувати: '+s.fullName} onClick={e=>{e.stopPropagation();open(s.id);}}>Керувати</button></td></tr>)}</tbody></table></div>}
    {editing&&<Dialog title={selected?.fullName??'Додати студента'} subtitle={groupName} busy={busy} onClose={close}>
      {selected&&<div className="dialog-tabs" aria-label="Дії зі студентом">{([['PROFILE','Профіль'],['TRANSFER','Переведення'],['ARCHIVE','Архівування'],['ACCOUNT','Обліковий запис']] as [Tab,string][]).filter(([key])=>key!=='TRANSFER'||transferGroups.length>0).map(([key,label])=><button className={'button '+(tab===key?'primary':'')} type="button" key={key} aria-pressed={tab===key} disabled={busy} onClick={()=>{setTab(key);setError('');}}>{label}</button>)}</div>}
      {error&&<p className="error-text" role="alert">{error}</p>}
      {tab==='PROFILE'&&<form className="dialog-form" key={editing+tab} onSubmit={e=>submit(e,selected?'EDIT':'ADD')}><label>ПІБ *<input name="fullName" autoFocus required minLength={2} maxLength={200} defaultValue={selected?.fullName??''} disabled={busy}/></label><label>Телефон (необов’язково)<input name="phone" type="tel" maxLength={40} defaultValue={selected?.phone??''} disabled={busy}/></label>{reason}{buttons(selected?'Зберегти':'Додати')}{selected&&<Link className="text-link" href={'/students/'+selected.id}>Відкрити відвідуваність студента</Link>}</form>}
      {selected&&tab==='TRANSFER'&&<form className="dialog-form" onSubmit={e=>submit(e,'TRANSFER')}><p>Поточна група: <strong>{groupName}</strong></p><label>Нова група<select name="targetGroupId" required disabled={busy||!selected.active}>{transferGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><p className="muted small">Минулі відмітки та склад журналів зберігаються. Майбутні заняття оновляться.</p>{reason}{buttons('Підтвердити переведення')}</form>}
      {selected&&tab==='ARCHIVE'&&<div className="stack"><form className="dialog-form" onSubmit={e=>submit(e,selected.active?'ARCHIVE':'RESTORE')}><p>Архівування приховує студента з активного списку та зберігає його навчальну історію.</p>{reason}{buttons(selected.active?'Архівувати студента':'Відновити студента')}</form>{canDelete&&<details className="danger-section"><summary>Видалити назавжди</summary><form className="dialog-form" onSubmit={e=>submit(e,'DELETE')}><p>Лише для помилкового запису без навчальної історії. Пов’язаний порожній обліковий запис також буде видалено.</p>{reason}<label className="inline-check"><input name="confirmDelete" type="checkbox" required/>Підтверджую остаточне видалення студента</label>{buttons('Видалити назавжди')}</form></details>}</div>}
      {selected&&tab==='ACCOUNT'&&(selected.userId?<p>Обліковий запис уже створено.</p>:!canCreateAccount?<p>Для створення облікового запису зверніться до куратора.</p>:!selected.active?<p>Спочатку відновіть студента.</p>:<form className="dialog-form" onSubmit={e=>submit(e,'ACCOUNT')}><label>Email<input name="email" type="email" required maxLength={200} disabled={busy}/></label><label>Причина створення<input name="reason" required minLength={5} maxLength={500} disabled={busy}/></label>{buttons('Створити обліковий запис')}</form>)}
    </Dialog>}
    {credentials&&<Dialog title="Обліковий запис створено" onClose={close}><div className="credential-card stack"><p>Email: <strong>{credentials.email}</strong></p><p>Тимчасовий пароль: <code>{credentials.password}</code></p><p className="muted small">Збережіть пароль зараз. Після закриття він більше не відображатиметься.</p><div className="dialog-actions">{([['email','Копіювати email'],['password','Копіювати пароль']] as const).map(([key,label])=><button className="button" key={key} onClick={async()=>{try{await navigator.clipboard.writeText(credentials[key]);setCopied('Скопійовано.');}catch{setCopied('Не вдалося скопіювати. Виділіть і скопіюйте вручну.');}}}>{label}</button>)}<button className="button primary" onClick={close}>Готово</button></div>{copied&&<p role="status">{copied}</p>}</div></Dialog>}
  </div>;
}
