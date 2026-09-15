import type {ReportFilters,ReportSummary} from '@/lib/report-types';
import {readableRange} from '@/lib/report-presentation';
import {teacherIdentity} from '@/lib/teacher-identity';
import {percent} from '@/lib/metrics';
import {Panel} from './ui';
import {ReportTables} from './report-tables';
export function ReportPreview({summary,filters}:{summary:ReportSummary;filters:ReportFilters;maxRows?:number;path?:string}){
 const teacher=summary.teacher??(new Set(summary.lessons?.map(l=>l.teacher)).size===1?{name:teacherIdentity(summary.lessons![0].teacher).name,position:''}:null);
 return <Panel title={teacher?.name??'Підсумки звіту'}><div className="report-summary stack"><p className="muted">{teacher?.position&&teacher.position+' · '}{readableRange(filters.from,filters.to)}</p><dl className="report-summary-grid">{[['Відвідуваність',percent(summary.stats?.percentage??null)],['Студентів',summary.students],['Груп',summary.groups],['Пар',summary.lessonCount??'—'],['Нижче 70%',summary.below70.length],['Нижче 50%',summary.below50]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="small muted">Онлайн і офлайн уточнюють PRESENT. Формат не вказано: {Math.max(0,summary.stats.PRESENT-(summary.stats.ONLINE??0)-(summary.stats.OFFLINE??0))}.</p>{!teacher&&summary.scope&&<p className="small muted">{summary.scope}</p>}</div><ReportTables summary={summary} filters={filters}/></Panel>;
}
