'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {CustomSelect} from '@/components/custom-select';

type Option={id:string;name:string};
type ProfileOption=Option&{userId:string|null};
type AdminUser=Option&{roles:string[];teacherId:string|null;studentId:string|null;starostaGroupIds:string[];curatorGroupIds:string[];deanFacultyIds:string[]};
const roles=[
  {id:'DEVELOPER',name:'Розробник · уся система'},
  {id:'STUDENT',name:'Студент · власний профіль'},
  {id:'ADMIN',name:'Адміністратор · уся система'},
  {id:'DEAN_OFFICE',name:'Деканат'},
  {id:'CURATOR',name:'Куратор'},
  {id:'TEACHER',name:'Викладач'},
  {id:'STAROSTA',name:'Староста'},
];
const actions=[
  {value:'RESET_PASSWORD',label:'Створити новий випадковий пароль'},
  {value:'ENABLE',label:'Увімкнути обліковий запис'},
  {value:'DISABLE',label:'Вимкнути обліковий запис'},
  {value:'ASSIGN_CURATOR',label:'Призначити групу куратору'},
  {value:'REMOVE_CURATOR',label:'Зняти групу куратора'},
  {value:'ASSIGN_DEAN',label:'Призначити факультет деканату'},
  {value:'REMOVE_DEAN',label:'Зняти факультет деканату'},
  {value:'ADD_ROLE',label:'Додати роль'},
  {value:'REMOVE_ROLE',label:'Зняти роль'},
  {value:'ASSIGN_TEACHER',label:'Зв’язати профіль викладача'},
  {value:'REMOVE_TEACHER',label:'Від’єднати профіль викладача'},
  {value:'ASSIGN_STAROSTA',label:'Зв’язати профіль старости'},
  {value:'REMOVE_STAROSTA',label:'Від’єднати профіль старости'},
  {value:'REVOKE_SESSIONS',label:'Відкликати всі сесії'},
];
const selectOptions=(options:Option[])=>options.map(o=>({value:o.id,label:o.name}));

export function AdminForm({actorId,users,groups,faculties,teachers,demo}:{actorId:string;users:AdminUser[];groups:Option[];faculties:Option[];teachers:ProfileOption[];demo:boolean}){
  const router=useRouter();
  const [userId,setUserId]=useState(users[0]?.id??'');
  const [action,setAction]=useState('ASSIGN_CURATOR');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false);
  const inFlight=useRef(false);
  const user=users.find(u=>u.id===userId);
  let targets:Option[]=[];
  if(user){
    if(action==='ADD_ROLE')targets=roles.filter(r=>!user.roles.includes(r.id));
    else if(action==='REMOVE_ROLE')targets=roles.filter(r=>user.roles.includes(r.id)&&!(['ADMIN','DEVELOPER'].includes(r.id)&&userId===actorId));
    else if(action==='ASSIGN_CURATOR')targets=groups.filter(g=>!user.curatorGroupIds.includes(g.id));
    else if(action==='REMOVE_CURATOR')targets=groups.filter(g=>user.curatorGroupIds.includes(g.id));
    else if(action==='ASSIGN_DEAN')targets=faculties.filter(f=>!user.deanFacultyIds.includes(f.id));
    else if(action==='REMOVE_DEAN')targets=faculties.filter(f=>user.deanFacultyIds.includes(f.id));
    else if(action==='ASSIGN_TEACHER')targets=teachers.filter(t=>(!t.userId||t.userId===userId)&&(!user.teacherId||t.id===user.teacherId));
    else if(action==='REMOVE_TEACHER')targets=teachers.filter(t=>t.id===user.teacherId);
    else if(action==='ASSIGN_STAROSTA')targets=groups.filter(g=>!user.starostaGroupIds.includes(g.id));
    else if(action==='REMOVE_STAROSTA')targets=groups.filter(g=>user.starostaGroupIds.includes(g.id));
    else targets=[{id:action==='REVOKE_SESSIONS'?'sessions':userId,name:action==='REVOKE_SESSIONS'?'Усі сесії користувача':'Обраний обліковий запис'}];
  }
  return <form className="admin-form pad" onSubmit={async e=>{
    e.preventDefault();
    if(inFlight.current||!targets.length)return;
    const fd=new FormData(e.currentTarget);
    inFlight.current=true;setBusy(true);setMessage('');
    try{
      const r=await fetch('/api/admin/assignments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(fd))});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error);
      setError(false);setMessage(data.password?'Новий пароль (показується один раз): '+data.password:data.changed?'Призначення оновлено. Зміну записано в аудит.':'Призначення вже має обраний стан.');router.refresh();
    }catch(e){setError(true);setMessage(e instanceof Error?e.message:'Не вдалося зберегти.');}
    finally{inFlight.current=false;setBusy(false);}
  }}>
    <label>Користувач<CustomSelect name="userId" label="Користувач" options={selectOptions(users)} value={userId} onChange={setUserId} disabled={busy} required/></label>
    <label>Дія<CustomSelect name="action" label="Дія" options={demo?[...actions,{value:'RESET_BETA_PASSWORD',label:'Скинути на beta-пароль'}]:actions} value={action} onChange={setAction} disabled={busy} required/></label>
    <label>Об’єкт<CustomSelect key={`${action}:${userId}:${targets.map(t=>t.id).join(',')}`} name="target" label="Об’єкт" options={selectOptions(targets)} defaultValue={targets[0]?.id??''} disabled={busy||!targets.length} required/></label>
    {!targets.length&&<p className="muted small full-row">Немає доступних об’єктів для цієї дії. Власну роль адміністратора зняти не можна.</p>}
    <label className="full-row">Причина зміни<input name="reason" required minLength={5} maxLength={500} disabled={busy}/></label>
    <p className="small muted full-row">Роль і область доступу призначаються окремо. Адміністратор має доступ до всієї системи. Інші ролі потребують відповідного профілю або призначення. Від’єднання зберігає профіль і навчальну історію.</p>
    {message&&<p className={`${error?'error-text':'form-success'} full-row`} role={error?'alert':'status'}>{message}</p>}
    <button className="button primary" disabled={busy||!targets.length}>{busy?'Збереження…':'Зберегти призначення'}</button>
  </form>;
}
