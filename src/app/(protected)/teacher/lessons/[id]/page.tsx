import {teacherIdentity} from '@/lib/teacher-identity';
import {AttendanceHistory} from '@/components/attendance-history';


import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {journal} from '@/lib/journal';
import {OnlineLink} from '@/components/online-link';
import {canEditOnline} from '@/lib/lesson-online';
import {HttpError} from '@/lib/errors';
import {dateLabel,timeLabel} from '@/lib/time';
import {parseFilters,filterLink,type Search} from '@/lib/filters';
import {JournalEditor} from '@/components/journal-editor';
import {PageTitle,Panel,Breadcrumbs} from '@/components/ui';
export default async function Lesson({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Search>}){const u=await requireUser();const f=parseFilters(await searchParams);let data;try{data=await journal(u,(await params).id);}catch(e){if(e instanceof HttpError&&e.status===404)notFound();throw e;}const l=data.lesson;const contextStudent=data.rows.find(row=>row.id===f.student);return <><Breadcrumbs items={[{label:'Мої групи',href:filterLink('/groups',f,{student:undefined})},...l.groups.map(g=>({label:g.group.name,href:filterLink(`/groups/${g.group.id}`,f,{group:g.group.id,student:undefined})})),...(contextStudent?[{label:contextStudent.name,href:filterLink(`/students/${contextStudent.id}`,f)}]:[]),{label:'Журнал заняття'}]}/><PageTitle eyebrow={`${dateLabel(l.startAt)} · ${l.pairNumber} ПАРА · ${timeLabel(l.startAt)}–${timeLabel(l.endAt)}`} title={l.subject.name} description={`${l.teacher?teacherIdentity(l.teacher.displayName,l.teacher.position).name:'Викладача не призначено'} · ${l.groups.map(g=>g.group.name).join(' + ')} · ${l.building.abbreviation} ${l.room}`}/><p className="muted small section-space">{l.cancelled?'Заняття скасовано. ':''}{l.synthetic?'Синтетичне заняття. Ім’я викладача не означає його участі у цій демонстрації. ':''}{l.source?`Основа довідника: ${l.source.file}, стор. ${l.source.page}.`:''}</p><OnlineLink lessonId={l.id} initialUrl={l.onlineUrl} version={l.version} editable={!l.term?.archivedAt&&canEditOnline(u,l)}/><JournalEditor lessonId={l.id} initialVersion={l.version} rows={data.rows} canConfirm={data.canConfirm} needsReason={data.needsReason} filters={f}/><div className="section-space"><Panel title="Історія виправлень"><p className="panel-description">Останні 200 змін. Одне збереження об’єднує відмітки зі спільною причиною.</p><AttendanceHistory audits={data.audits} students={data.rows}/></Panel></div></>;}
