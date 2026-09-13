'use client';
import {useState,useRef} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
type Student={id:string;fullName:string;phone:string|null;active:boolean;isSynthetic:boolean;userId:string|null};
type Props={groupId:string;students:Student[];transferGroups:{id:string;name:string}[];canCreateAccount:boolean};
export function StudentManager({groupId,students,transferGroups,canCreateAccount}:Props){
  const router=useRouter(),inFlight=useRef(false);
  const [editing,setEditing]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false),[credentials,setCredentials]=useState('');
  const selected=students.find(s=>s.id===editing);
  async function submit(event:React.FormEvent<HTMLFormElement>,account=false){
    event.preventDefault();if(inFlight.current)return;
    const form=event.currentTarget,data=Object.fromEntries(new FormData(form));
    if(data.action==='ARCHIVE'&&!window.confirm('Архівувати студента? Історія відвідуваності залишиться.'))return;
    inFlight.current=true;setBusy(true);setMessage('');setCredentials('');
    try{
      const response=await fetch(account?'/api/students/accounts':'/api/students',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(account?data:{...data,groupId})});
      const result=await response.json();if(!response.ok)throw new Error(result.error??'Не вдалося зберегти.');
      setError(false);setMessage('Збережено. Зміну внесено до журналу аудиту.');
      if(result.password)setCredentials(result.email+' · '+result.password);else setEditing(null);
      router.refresh();
    }catch(e){setError(true);setMessage(e instanceof Error?e.message:'Помилка з’єднання.');}finally{inFlight.current=false;setBusy(false);}
  }
  return <div className="pad stack" aria-busy={busy}>
    <div><button className="button primary" disabled={busy} onClick={()=>{setEditing('new');setCredentials('');}}>+ Додати студента</button></div>
    {!students.length&&<p>У групі ще немає студентів.</p>}
    <div className="table-scroll"><table><thead><tr><th>ПІБ</th><th>Телефон</th><th>Стан</th><th>Джерело</th><th/></tr></thead><tbody>{students.map(s=><tr key={s.id}><td><Link href={'/students/'+s.id}>{s.fullName}</Link></td><td>{s.phone??'Не вказано'}</td><td>{s.active?'Активний':'Архівований'}</td><td>{s.isSynthetic?'Демонстраційний список':'Реальні дані roster'}</td><td><button className="button" disabled={busy} onClick={()=>{setEditing(s.id);setCredentials('');}}>Керувати</button></td></tr>)}</tbody></table></div>
    {editing&&<form key={editing} className="admin-form" onSubmit={submit}>
      {selected&&<input type="hidden" name="studentId" value={selected.id}/>}
      <label>Дія<select name="action" disabled={busy} defaultValue={selected?'EDIT':'ADD'}>{selected?<><option value="EDIT">Редагувати ПІБ / телефон</option><option value={selected.active?'ARCHIVE':'RESTORE'}>{selected.active?'Архівувати':'Відновити'}</option>{transferGroups.length>0&&selected.active&&<option value="TRANSFER">Перевести до іншої групи</option>}</>:<option value="ADD">Додати студента</option>}</select></label>
      <label>ПІБ<input name="fullName" required minLength={2} maxLength={200} defaultValue={selected?.fullName??''} disabled={busy}/></label>
      <label>Телефон (необов’язково)<input name="phone" type="tel" maxLength={40} defaultValue={selected?.phone??''} disabled={busy}/></label>
      {selected&&transferGroups.length>0&&<label>Група для переведення<select name="targetGroupId" disabled={busy}>{transferGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
      <label className="full-row">Причина / джерело зміни<input name="reason" required minLength={5} maxLength={500} disabled={busy}/></label>
      <div><button className="button primary" disabled={busy}>{busy?'Збереження…':'Зберегти'}</button> <button type="button" className="button" disabled={busy} onClick={()=>setEditing(null)}>Скасувати</button></div>
    </form>}
    {selected&&canCreateAccount&&selected.active&&!selected.userId&&<form className="admin-form" onSubmit={e=>submit(e,true)}><input type="hidden" name="studentId" value={selected.id}/><label>Email облікового запису<input name="email" type="email" required disabled={busy}/></label><label>Причина створення<input name="reason" required minLength={5} maxLength={500} disabled={busy}/></label><button className="button" disabled={busy}>Створити обліковий запис студента</button></form>}
    {message&&<p className={error?'error-text':'form-success'} role={error?'alert':'status'}>{message}</p>}
    {credentials&&<p role="status">Нові дані входу (показуються один раз): <code>{credentials}</code></p>}
  </div>;
}
