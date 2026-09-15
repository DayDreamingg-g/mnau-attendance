import type {ReportFilters,ReportSummary} from '@/lib/report-types';
import {readableRange} from '@/lib/report-presentation';
import {teacherIdentity} from '@/lib/teacher-identity';
import {percent} from '@/lib/metrics';
import {Panel} from './ui';
import {ReportTables} from './report-tables';
export function ReportPreview({summary,filters}:{summary:ReportSummary;filters:ReportFilters;maxRows?:number;path?:string}){
 const teacher=summary.teacher??(new Set(summary.lessons?.map(l=>l.teacher)).size===1?{name:teacherIdentity(summary.lessons![0].teacher).name,position:''}:null);
 return <Panel title={teacher?.name??'Підсумки звіту'}><div className="report-summary stack"><p className="muted">{teacher?.position&&teacher.position+' · '}{readableRange(filters.from,filters.to)}</p><div className="stats-grid">{[['Відвідуваність',percent(summary.stats?.percentage??null)],['Студенти',summary.students],['Пари',summary.lessonCount??'—'],['Не відмічено',summary.stats?.unmarked??'—']].map(([label,value])=><div className="stat-card" key={label}><p>{label}</p><strong>{value}</strong></div>)}</div><p className="small muted">Нижче 70%: {summary.below70.length} · Нижче 50%: {summary.below50} · Груп: {summary.groups}</p>{!teacher&&summary.scope&&<p className="small muted">{summary.scope}</p>}</div><ReportTables summary={summary} filters={filters}/></Panel>;
}
