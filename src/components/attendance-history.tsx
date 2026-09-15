import {historyBatches} from '@/lib/attendance-history';
import {teacherIdentity} from '@/lib/teacher-identity';
import {dateLabel,timeLabel} from '@/lib/time';
import {Status,Empty} from './ui';
type Audit={id:string;actorId:string|null;lessonId:string|null;studentId:string|null;createdAt:Date;actor:{name:string}|null;oldStatus:string|null;newStatus:string|null;details:unknown;reason:string|null;source:string};
export function AttendanceHistory({audits,students}:{audits:Audit[];students:{id:string;name:string}[]}){
 if(!audits.length)return <Empty>Цей журнал ще не змінювали.</Empty>;
 return <div>{historyBatches(audits).map(batch=><section className="history-batch" key={batch[0].id}><header><strong>{batch[0].actor?teacherIdentity(batch[0].actor.name).name:'Технічний запуск'}</strong><span className="small muted">{dateLabel(batch[0].createdAt)} {timeLabel(batch[0].createdAt)} · Змін: {batch.length}</span></header><p className="small muted">{batch[0].reason??(batch[0].source==='AUTHORIZED_CORRECTION'?'Виправлення відміток':'Збереження журналу')}</p>{batch.map(a=><div className="history-change" key={a.id}><strong>{students.find(s=>s.id===a.studentId)?.name??'Журнал'}</strong><Status value={a.oldStatus}/><span aria-label="змінено на">→</span><Status value={a.newStatus}/>{a.reason!==batch[0].reason&&a.reason&&<span className="small">{a.reason}</span>}</div>)}</section>)}</div>;
}
