'use client';
import {useState} from 'react';
import {Dialog} from './dialog';
import {AdminForm} from './admin-form';
export function AccountActions(props:React.ComponentProps<typeof AdminForm>){const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);return <><button className="button" onClick={()=>setOpen(true)}>Керувати обліковим записом</button>{open&&<Dialog busy={busy} title="Ролі, доступ і безпека" onClose={()=>setOpen(false)}><AdminForm {...props} onBusy={setBusy}/></Dialog>}</>;}
