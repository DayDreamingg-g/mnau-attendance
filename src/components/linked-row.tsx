'use client';

import {useRouter} from 'next/navigation';
import type {ReactNode} from 'react';

/** The primary cell keeps a real Link for keyboard access, copy-link and no-JS use. */
export function LinkedRow({href,children}:{href:string;children:ReactNode}) {
  const router=useRouter();
  return <tr className="linked-row" onClick={event=>{
    if(event.defaultPrevented||event.button!==0) return;
    const target=event.target as HTMLElement;
    if(target.closest('a,button,input,select,textarea,[role="button"],[role="combobox"]')) return;
    if(window.getSelection()?.toString()) return;
    if(event.metaKey||event.ctrlKey||event.shiftKey) window.open(href,'_blank','noopener,noreferrer');
    else router.push(href);
  }}>{children}</tr>;
}
