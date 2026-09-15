'use client';
import {useEffect,useId,useRef} from 'react';
export function Dialog({title,subtitle,busy=false,onClose,children}:{title:string;subtitle?:string;busy?:boolean;onClose:()=>void;children:React.ReactNode}){
  const ref=useRef<HTMLDialogElement>(null),label=useId();
  useEffect(()=>{const dialog=ref.current!,previous=document.activeElement as HTMLElement|null;dialog.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{dialog.close();document.body.style.overflow=overflow;previous?.focus();};},[]);
  return <dialog ref={ref} className="app-dialog" aria-labelledby={label} onKeyDown={e=>{
    if(e.key!=='Tab')return;
    const controls=[...e.currentTarget.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,[tabindex]')].filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&!el.closest('[aria-hidden="true"]')&&el.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);
    if(!first){e.preventDefault();return;}
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} onClick={e=>{if(e.target===e.currentTarget&&!busy){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <header className="dialog-heading"><div><h2 id={label}>{title}</h2>{subtitle&&<p className="muted">{subtitle}</p>}</div><button type="button" className="button" aria-label="Закрити діалог" disabled={busy} onClick={onClose}>×</button></header>
    {children}
  </dialog>;
}
