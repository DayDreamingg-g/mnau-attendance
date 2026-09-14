import type {Prisma} from '../generated/prisma/client';
import {HttpError} from './errors';
import {effectiveNow} from './time';
export async function hardDeleteStudent(tx:Prisma.TransactionClient,studentId:string,allowEmptySnapshots=false){
  const student=await tx.student.findUniqueOrThrow({where:{id:studentId}});
  const marks=await tx.attendance.count({where:{studentId}});
  const historical=await tx.lessonStudent.count({where:{studentId,lesson:allowEmptySnapshots?{OR:[{submissions:{some:{}}},{journalState:{not:'EMPTY'}}]}:{startAt:{lte:effectiveNow().toJSDate()}}}});
  if(marks||historical||student.importKey)throw new HttpError(409,'Студент має навчальну історію або офіційний імпорт. Доступне лише архівування.');
  if(student.userId){
    const user=await tx.user.findUniqueOrThrow({where:{id:student.userId},include:{roles:true,teacher:true,starostaAssignments:true,curatorAssignments:true,deanAssignments:true,_count:{select:{auditLogs:true,submissions:true,reports:true}}}});
    if(user.teacher||user.roles.some(r=>r.roleId!=='STUDENT')||user.starostaAssignments.length||user.curatorAssignments.length||user.deanAssignments.length||user._count.auditLogs||user._count.submissions||user._count.reports)throw new HttpError(409,'Обліковий запис має власну історію. Доступне лише архівування.');
  }
  const affected=await tx.lessonStudent.findMany({where:{studentId},select:{lessonId:true}});
  await tx.lessonStudent.deleteMany({where:{studentId}});
  await tx.student.delete({where:{id:studentId}});
  if(student.userId){
    await tx.session.deleteMany({where:{userId:student.userId}});
    await tx.userRole.deleteMany({where:{userId:student.userId}});
    await tx.user.delete({where:{id:student.userId}});
  }
  return {student,lessonIds:affected.map(r=>r.lessonId)};
}
