'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useState} from 'react';
import {activeNavigation} from '@/lib/navigation';
const labels:Record<string,string>={ADMIN:'Адміністратор',DEVELOPER:'Розробник',DEAN_OFFICE:'Деканат',CURATOR:'Куратор',TEACHER:'Викладач',STAROSTA:'Староста'};
export function Navigation({items,roles,workspace}:{items:{href:string;label:string;icon:string}[];roles:string[];workspace:string|null}){
  const path=usePathname(),router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const active=activeNavigation(path,items.map(i=>i.href));
  return <>{roles.length>1&&<label className="workspace-select">Робочий простір<select value={workspace??''} disabled={busy} onChange={async e=>{if(!e.target.value)return;setBusy(true);try{const r=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'WORKSPACE',workspace:e.target.value})});const result=await r.json();if(!r.ok)throw new Error(result.error);router.push(result.destination);router.refresh();}catch(e){setError(e instanceof Error?e.message:'Помилка');}finally{setBusy(false);}}}><option value="">Оберіть простір</option>{roles.map(r=><option value={r} key={r}>{labels[r]}</option>)}</select></label>}<nav className="side-nav">{items.map(i=><Link key={i.href} href={i.href} aria-current={i.href===active?'page':undefined} className={i.href===active?'active':''}><span>{i.icon}</span>{i.label}</Link>)}</nav>{error&&<p role="alert">{error}</p>}</>;
}
