import Link from 'next/link';
import type {Search} from '@/lib/filters';

/** Preserve the current GET context, including future scope filters, across searches. */
export function teacherSearchContext(params:Search){
  return Object.entries(params).flatMap(([name,value])=>
    name==='date'||name==='q'||name==='page'||value===undefined?[]:
      (Array.isArray(value)?value:[value]).map(item=>({name,value:item})));
}
export function TeacherSearch({params,date,q,today}:{params:Search;date:string;q:string;today:string}){
  const context=teacherSearchContext(params);
  const query=new URLSearchParams(context.map(({name,value})=>[name,value]));
  query.set('date',date);if(q)query.set('q',q);
  const pastQuery=new URLSearchParams(query);pastQuery.set('past','1');
  const todayQuery=new URLSearchParams(query);todayQuery.delete('past');todayQuery.set('date',today);
  const past=params.past==='1';
  return <form className="filters" action="/teacher" method="get">
    {context.map(({name,value},i)=><input key={i} type="hidden" name={name} value={value}/>)}
    <label>Дата<input type="date" name="date" defaultValue={date}/></label>
    <label className="filter-wide">Група або дисципліна<input name="q" defaultValue={q} placeholder="Пошук занять…"/></label>
    <button className="button primary">Знайти</button>
    <Link className={`button${!past?' active':''}`} aria-current={!past?'page':undefined} href={'/teacher?'+todayQuery}>Сьогодні</Link>
    <Link className={`button${past?' active':''}`} aria-current={past?'page':undefined} href={'/teacher?'+pastQuery}>Минулі заняття</Link>
  </form>;
}
