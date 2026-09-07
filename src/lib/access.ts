import type { Prisma } from '../generated/prisma/client';
import type { Principal } from './auth';
import { hasRole } from './auth';
import { HttpError } from './errors';
export function groupScope(u:Principal):Prisma.GroupWhereInput {
  if(hasRole(u,'ADMIN'))return {};
  const OR:Prisma.GroupWhereInput[]=[];
  if(hasRole(u,'DEAN_OFFICE'))OR.push({specialty:{facultyId:{in:u.deanAssignments.map(a=>a.facultyId)}}});
  if(hasRole(u,'CURATOR'))OR.push({id:{in:u.curatorAssignments.map(a=>a.groupId)}});
  if(hasRole(u,'TEACHER')&&u.teacher)OR.push({lessons:{some:{lesson:{teacherId:u.teacher.id}}}});
  if(hasRole(u,'STAROSTA')&&u.student)OR.push({id:u.student.groupId});
  return OR.length?{OR}:{id:{in:[]}};
}
export function lessonScope(u:Principal):Prisma.LessonWhereInput {
  if(hasRole(u,'ADMIN'))return {};
  const OR:Prisma.LessonWhereInput[]=[];
  if(hasRole(u,'DEAN_OFFICE'))OR.push({groups:{some:{group:{specialty:{facultyId:{in:u.deanAssignments.map(a=>a.facultyId)}}}}}});
  if(hasRole(u,'CURATOR'))OR.push({groups:{some:{groupId:{in:u.curatorAssignments.map(a=>a.groupId)}}}});
  if(hasRole(u,'TEACHER')&&u.teacher)OR.push({teacherId:u.teacher.id});
  if(hasRole(u,'STAROSTA')&&u.student)OR.push({starostaAllowed:true,groups:{some:{groupId:u.student.groupId}}});
  return OR.length?{OR}:{id:{in:[]}};
}
/** Keep a permission's lesson and group conditions in the same OR branch. */
export function rosterScope(u:Principal):Prisma.LessonStudentWhereInput {
  if(hasRole(u,'ADMIN'))return {};
  const OR:Prisma.LessonStudentWhereInput[]=[];
  if(hasRole(u,'DEAN_OFFICE'))OR.push({student:{group:{specialty:{facultyId:{in:u.deanAssignments.map(a=>a.facultyId)}}}}});
  if(hasRole(u,'CURATOR'))OR.push({student:{groupId:{in:u.curatorAssignments.map(a=>a.groupId)}}});
  if(hasRole(u,'TEACHER')&&u.teacher)OR.push({lesson:{teacherId:u.teacher.id}});
  if(hasRole(u,'STAROSTA')&&u.student)OR.push({student:{groupId:u.student.groupId},lesson:{starostaAllowed:true}});
  return OR.length?{OR}:{studentId:{in:[]}};
}
export function lessonGroupScope(u:Principal):Prisma.LessonGroupWhereInput {
  if(hasRole(u,'ADMIN'))return {};
  const OR:Prisma.LessonGroupWhereInput[]=[];
  if(hasRole(u,'DEAN_OFFICE'))OR.push({group:{specialty:{facultyId:{in:u.deanAssignments.map(a=>a.facultyId)}}}});
  if(hasRole(u,'CURATOR'))OR.push({groupId:{in:u.curatorAssignments.map(a=>a.groupId)}});
  if(hasRole(u,'TEACHER')&&u.teacher)OR.push({lesson:{teacherId:u.teacher.id}});
  if(hasRole(u,'STAROSTA')&&u.student)OR.push({groupId:u.student.groupId,lesson:{starostaAllowed:true}});
  return OR.length?{OR}:{groupId:{in:[]}};
}
export function groupScopeForLesson(u:Principal,lessonId:string):Prisma.GroupWhereInput {
  return {lessons:{some:{AND:[{lessonId},lessonGroupScope(u)]}}};
}
export function lessonScopeForGroup(u:Principal,group:{id:string;specialty:{facultyId:string}}):Prisma.LessonWhereInput {
  if(canCorrectGroup(u,group))return {};
  const OR:Prisma.LessonWhereInput[]=[];
  if(hasRole(u,'TEACHER')&&u.teacher)OR.push({teacherId:u.teacher.id});
  if(hasRole(u,'STAROSTA')&&u.student?.groupId===group.id)OR.push({starostaAllowed:true});
  return OR.length?{OR}:{id:{in:[]}};
}
export function canCorrectGroup(u:Principal,group:{id:string;specialty:{facultyId:string}}){
  return hasRole(u,'ADMIN') || (hasRole(u,'DEAN_OFFICE')&&u.deanAssignments.some(a=>a.facultyId===group.specialty.facultyId)) || (hasRole(u,'CURATOR')&&u.curatorAssignments.some(a=>a.groupId===group.id));
}
export function reportScope(u:Principal):Prisma.ReportWhereInput {
  if(hasRole(u,'ADMIN'))return {};
  if(hasRole(u,'DEAN_OFFICE'))return {facultyId:{in:u.deanAssignments.map(a=>a.facultyId)}};
  return {id:{in:[]}};
}
export function requireReportFaculty(u:Principal,facultyId:string){if(!hasRole(u,'ADMIN')&&!(hasRole(u,'DEAN_OFFICE')&&u.deanAssignments.some(a=>a.facultyId===facultyId)))throw new HttpError(403,'Немає доступу до звітності факультету.');}
export function requireAdmin(u:Principal){if(!hasRole(u,'ADMIN'))throw new HttpError(403,'Потрібні права адміністратора.');}
