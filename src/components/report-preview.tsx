import Link from 'next/link';
import {SortHeader} from './sort-header';
import {sortRows} from '@/lib/sorting';
import {filterLink,type SortKey} from '@/lib/filters';
import {percent} from '@/lib/metrics';
import type {ReportFilters,ReportSummary} from '@/lib/report-types';
import {Panel,Percentage,Empty} from './ui';
export function ReportPreview({summary,filters,maxRows,path}:{summary:ReportSummary;filters:ReportFilters;maxRows?:number;path?:string}){
  const sorted=sortRows(summary.rows??[],filters,{report_student:s=>s.fullName,report_group:s=>s.groupName,report_percentage:s=>s.stats.percentage,present:s=>s.stats.PRESENT,n:s=>s.stats.N,hv:s=>s.stats.HV,unmarked:s=>s.stats.unmarked,pending:s=>s.stats.pending});
  const rows=maxRows?sorted.slice(0,maxRows):sorted;
  const headers:[string,SortKey][]=[['Студент / студентка','report_student'],['Група','report_group'],['•','present'],['N','n'],['HV','hv'],['Не відмічено','unmarked'],['Показник','report_percentage']];
  return <Panel title="Збережений звіт · TEST">
    {!!summary.curators?.length&&<p className="panel-description">Куратори: {summary.curators.map(c=>`${c.name} (${c.groupName})`).join('; ')}.</p>}
    {summary.scope&&<p className="panel-description">{summary.scope}</p>}
    <p className="panel-description">{filters.from} → {filters.to} · {summary.students} студентів · {summary.groups} груп · Показник: <Percentage value={summary.stats?.percentage??null}/></p>
    {summary.stats&&<p className="panel-description">• {summary.stats.PRESENT} · N {summary.stats.N} · HV {summary.stats.HV} · Не відмічено: {summary.stats.unmarked} · Заповнення: {percent(summary.stats.completion)}</p>}
    <p className="panel-description">Нижче 70%: {summary.below70.length}, з них нижче 50%: {summary.below50}.{summary.synthetic?' Дані студентів синтетичні.':''}</p>
    {!!summary.lessons?.length&&<><p className="panel-description">Занять: {summary.lessonCount} · Студент × заняття: {summary.stats.expected} · Незавершених журналів: {summary.incompleteLessons}</p><div className="table-scroll"><table><thead><tr>{['Дата / пара','Дисципліна / викладач','Група','Склад','PRESENT','N','HV','Не відмічено','Показник','Онлайн'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{summary.lessons.map(l=><tr key={l.lessonId+':'+l.groupId}><td><Link href={filterLink('/teacher/lessons/'+l.lessonId,filters)}>{l.date} · {l.pair}<span className="table-secondary">{l.time}</span></Link></td><td>{l.subject}<span className="table-secondary">{l.teacher}</span></td><td>{l.group}</td><td>{l.stats.expected}</td><td>{l.stats.PRESENT}</td><td>{l.stats.N}</td><td>{l.stats.HV}</td><td>{l.stats.unmarked}</td><td><Percentage value={l.stats.percentage}/></td><td>{l.onlineUrl?<a href={l.onlineUrl} target="_blank" rel="noopener noreferrer">Відкрити ↗</a>:'—'}</td></tr>)}</tbody></table></div></>}
    {rows?.length?<div className="table-scroll"><table><thead><tr>{headers.map(([label,key])=>path?<SortHeader key={key} label={label} sortKey={key} filters={filters} path={path}/>:<th key={key} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(s=><tr key={s.groupId+':'+s.id}><td><Link className="row-link" href={filterLink(`/students/${s.id}`,filters)}>{s.fullName}</Link></td><td><Link className="row-link" href={filterLink(`/groups/${s.groupId}`,filters,{group:s.groupId})}>{s.groupName}</Link></td><td>{s.stats.PRESENT}</td><td className="danger">{s.stats.N}</td><td className="info">{s.stats.HV}</td><td>{s.stats.unmarked}</td><td><Percentage value={s.stats.percentage}/></td></tr>)}</tbody></table></div>:summary.students>0?<p className="muted">Звіт попередньої версії. Оновіть його, щоб побачити повний перегляд.</p>:<Empty/>}
    {maxRows&&summary.students>maxRows&&<p className="panel-description">Показано перші {maxRows} із {summary.students} студентів. PDF і CSV міститимуть усю вибірку.</p>}
  </Panel>;
}
