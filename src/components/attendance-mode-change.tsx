import {auditModeChange} from '@/lib/attendance-mode';
export function AttendanceModeChange({details}:{details:unknown}){
  const change=auditModeChange(details);
  return change?<span className="small muted">{change.before} → {change.after}</span>:null;
}
