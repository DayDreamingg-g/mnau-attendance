import {z} from 'zod';
export type AttendanceMode='ONLINE'|'OFFLINE';
export const journalRowSchema=z.object({
  studentId:z.string().min(1).max(100),
  status:z.enum(['PRESENT','N','HV']).nullable(),
  attendanceMode:z.enum(['ONLINE','OFFLINE']).nullable().optional(),
}).strict().refine(row=>row.status==='PRESENT'||row.attendanceMode==null,{
  message:'Формат присутності доступний лише для PRESENT.',path:['attendanceMode'],
});
// Missing mode from an older client preserves an existing PRESENT refinement.
// Explicit null clears it; leaving PRESENT always clears it.
export function resolveAttendanceMode(row:{status:string|null;attendanceMode?:AttendanceMode|null},oldMode:AttendanceMode|null=null){
  return row.status==='PRESENT'?(row.attendanceMode===undefined?oldMode:row.attendanceMode):null;
}
export function attendanceModeLabel(mode:unknown){return mode==='ONLINE'?'Онлайн':mode==='OFFLINE'?'Офлайн':'Формат не вказано';}
export function auditModeChange(details:unknown){
  if(!details||typeof details!=='object'||!('oldAttendanceMode' in details)||!('newAttendanceMode' in details))return null;
  const d=details as {oldAttendanceMode:unknown;newAttendanceMode:unknown};
  if(d.oldAttendanceMode===d.newAttendanceMode)return null;
  return {before:attendanceModeLabel(d.oldAttendanceMode),after:attendanceModeLabel(d.newAttendanceMode)};
}
