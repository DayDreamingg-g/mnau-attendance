import Link from 'next/link';
import type {Filters, SortKey} from '@/lib/filters';
import {sortLink} from '@/lib/sorting';

export function SortHeader({label,sortKey,filters,path}:{label:string;sortKey:SortKey;filters:Filters;path:string}) {
  const active=filters.sort===sortKey;
  const descending=filters.order==='desc';
  return <th scope="col" aria-sort={active?(descending?'descending':'ascending'):'none'}>
    <Link href={sortLink(path,filters,sortKey)} title={`Сортувати: ${label}`} style={{display:'inline-flex',alignItems:'center',gap:7,fontWeight:600}}>
      <span>{label}</span><span aria-hidden="true" style={{fontSize:10,opacity:active?1:0.55}}>{active?(descending?'▼':'▲'):'↕'}</span>
    </Link>
  </th>;
}
