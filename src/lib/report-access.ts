import {db} from './db';
import {isManager,hasRole,type Principal} from './auth';
import {lessonScope,lessonGroupScope} from './access';
import type {ReportSummary} from './report-types';
import type {Prisma} from '../generated/prisma/client';
import {HttpError} from './errors';
export async function assertSavedReportAccess(user:Principal,report:{facultyId:string;summary:Prisma.JsonValue|null}){
  if(isManager(user)||hasRole(user,'DEAN_OFFICE')&&user.deanAssignments.some(a=>a.facultyId===report.facultyId))return;
  const summary=report.summary as unknown as ReportSummary|null;
  if(!summary?.lessons?.length)throw new HttpError(404,'Звіт недоступний у поточній області доступу.');
  const unique=new Map(summary.lessons.map(l=>[l.lessonId+':'+l.groupId,l]));
  const accessible=await db.lessonGroup.findMany({where:{AND:[{OR:[...unique.values()].map(l=>({lessonId:l.lessonId,groupId:l.groupId}))},lessonGroupScope(user),{lesson:lessonScope(user)}]},select:{lessonId:true,groupId:true}});
  if(accessible.length!==unique.size)throw new HttpError(404,'Звіт недоступний у поточній області доступу.');
}
