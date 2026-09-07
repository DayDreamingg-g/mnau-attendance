'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export function LogoutButton(){const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');return <div><button className="button ghost" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/auth/logout',{method:'POST'});if(!r.ok&&r.status!==401)throw new Error();router.replace('/login');router.refresh();}catch{setError('Не вдалося вийти. Спробуйте ще раз.');setBusy(false);}}}>{busy?'Вихід…':'Вийти ↗'}</button>{error&&<p role="alert" className="error-text">{error}</p>}</div>;}
