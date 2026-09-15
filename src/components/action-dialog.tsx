'use client';
import {useState} from 'react';
import {Dialog} from './dialog';
import {ActionForm} from './action-form';
export function ActionDialog({title,label,danger=false,...props}:React.ComponentProps<typeof ActionForm>&{title:string;danger?:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 return <><button className={`button ${danger?'danger':''}`} onClick={()=>setOpen(true)}>{title}</button>{open&&<Dialog title={title} busy={busy} onClose={()=>setOpen(false)}><ActionForm {...props} label={label} danger={danger} onBusy={setBusy} onSaved={()=>setOpen(false)} onCancel={()=>setOpen(false)}/></Dialog>}</>;
}
