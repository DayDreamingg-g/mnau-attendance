import {attendanceModeLabel} from '@/lib/attendance-mode';
export function attendanceStatusLabel(status:string|null|undefined){
  return status==='PRESENT'?'Присутній':status==='N'?'Відсутній':status==='HV'?'Поважна причина':'Не відмічено';
}
export function JournalRowState({dirty,status,previous}:{dirty:boolean;status:string|null;previous?:{status:string|null;attendanceMode?:string|null}}){
  return <span className="journal-row-state muted small">{dirty?<><strong>Змінено</strong><span>Було: {attendanceStatusLabel(previous?.status)}{previous?.status==='PRESENT'?' · '+attendanceModeLabel(previous.attendanceMode):''}</span></>:status===null?'Не відмічено':'Збережено'}</span>;
}
