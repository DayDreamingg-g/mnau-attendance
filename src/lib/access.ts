import type { Prisma } from '../generated/prisma/client';
import { hasRole,isManager,starostaGroups,type Principal } from './auth';
import { HttpError } from './errors';
export function groupScope(u:Principal):Prisma.GroupWhereInput {
  if(isManager(u))return {};
  const OR:Prisma.GroupWhereInput[]=[];
  if(hasRole(u,'DEAN_OFFICE'))OR.push({specialty:{facultyId:{in:u.deanAssignments.map(a=>a.facultyId)}}});
  if(hasRole(u,'CURATOR'))OR.push({id:{in:u.curatorAssignments.map(a=>a.groupId)}});
  if(hasRole(u,'TEACHER')&&u.teacher)OR.push({lessons:{some:{lesson:{teacherId:u.teacher.id,cancelled:false}}}});
  if(starostaGroups(u).length)OR.push({id:{in:starostaGroups(u)}});
  return OR.length?{OR}:{id:{in:[]}};
}
export function studentScope(u:Principal):Prisma.StudentWhereInput {
  const OR:Prisma.StudentWhereInput[]=[{group:groupScope(u)}];
  if(hasRole(u,'STUDENT')&&u.student)OR.push({id:u.student.id});
  OR.push({roster:{some:rosterScope(u)}});
  return {OR};
}
export function lessonScope(u:Principal):Prisma.LessonWhereInput {
  if(isManager(u))return {};
  const OR:Prisma.LessonWhereInput[]=[];
  if(hasRole(u,'DEAN_OFFICE'))OR.push({groups:{some:{group:{specialty:{facultyId:{in:u.deanAssignments.map(a=>a.facultyId)}}}}}});
  if(hasRole(u,'CURATOR'))OR.push({groups:{some:{groupId:{in:u.curatorAssignments.map(a=>a.groupId)}}}});
  if(hasRole(u,'TEACHER')&&u.teacher)OR.push({teacherId:u.teacher.id});
  if(starostaGroups(u).length)OR.push({starostaAllowed:true,groups:{some:{groupId:{in:starostaGroups(u)}}}});
  if(hasRole(u,'STUDENT')&&u.student)OR.push({roster:{some:{studentId:u.student.id}}});
  return OR.length?{OR}:{id:{in:[]}};
}
export function rosterScope(u:Principal):Prisma.LessonStudentWhereInput {
  if(isManager(u))return {};
  const OR:Prisma.LessonStudentWhereInput[]=[];
  if(hasRole(u,'DEAN_OFFICE'))OR.push({group:{specialty:{facultyId:{in:u.deanAssignments.map(a=>a.facultyId)}}}});
  if(hasRole(u,'CURATOR'))OR.push({groupId:{in:u.curatorAssignments.map(a=>a.groupId)}});
  if(hasRole(u,'TEACHER')&&u.teacher)OR.push({lesson:{teacherId:u.teacher.id}});
  if(starostaGroups(u).length)OR.push({groupId:{in:starostaGroups(u)},lesson:{starostaAllowed:true}});
  if(hasRole(u,'STUDENT')&&u.student)OR.push({studentId:u.student.id});
  return OR.length?{OR}:{studentId:{in:[]}};
}
export function lessonGroupScope(u:Principal):Prisma.LessonGroupWhereInput {
  if(isManager(u))return {};
  const OR:Prisma.LessonGroupWhereInput[]=[];
  if(hasRole(u,'DEAN_OFFICE'))OR.push({group:{specialty:{facultyId:{in:u.deanAssignments.map(a=>a.facultyId)}}}});
  if(hasRole(u,'CURATOR'))OR.push({groupId:{in:u.curatorAssignments.map(a=>a.groupId)}});
  if(hasRole(u,'TEACHER')&&u.teacher)OR.push({lesson:{teacherId:u.teacher.id}});
  if(starostaGroups(u).length)OR.push({groupId:{in:starostaGroups(u)},lesson:{starostaAllowed:true}});
  if(hasRole(u,'STUDENT')&&u.student)OR.push({lesson:{roster:{some:{studentId:u.student.id}}},groupId:u.student.groupId});
  return OR.length?{OR}:{groupId:{in:[]}};
}
export function groupScopeForLesson(u:Principal,lessonId:string):Prisma.GroupWhereInput {
  return {lessons:{some:{AND:[{lessonId},lessonGroupScope(u)]}}};
}
export function lessonScopeForGroup(u:Principal,group:{id:string;specialty:{facultyId:string}}):Prisma.LessonWhereInput {
  if(canCorrectGroup(u,group))return {};
  const OR:Prisma.LessonWhereInput[]=[];
  if(hasRole(u,'TEACHER')&&u.teacher)OR.push({teacherId:u.teacher.id});
  if(starostaGroups(u).includes(group.id))OR.push({starostaAllowed:true});
  return OR.length?{OR}:{id:{in:[]}};
}
export function canCorrectGroup(u:Principal,group:{id:string;specialty:{facultyId:string}}){
  return isManager(u)||(hasRole(u,'DEAN_OFFICE')&&u.deanAssignments.some(a=>a.facultyId===group.specialty.facultyId))||(hasRole(u,'CURATOR')&&u.curatorAssignments.some(a=>a.groupId===group.id));
}
export function canManageStudents(u:Principal,group:{id:string;specialty:{facultyId:string}}){return canCorrectGroup(u,group)||starostaGroups(u).includes(group.id);}
export function canSeePhone(u:Principal,s:{id:string;group:{id:string;specialty:{facultyId:string}}}){return u.student?.id===s.id||canManageStudents(u,s.group);}
export function reportScope(u:Principal):Prisma.ReportWhereInput {
  if(isManager(u))return {};
  if(hasRole(u,'DEAN_OFFICE'))return {facultyId:{in:u.deanAssignments.map(a=>a.facultyId)}};
  return {createdById:u.id};
}
export function requireReportFaculty(u:Principal,facultyId:string){if(!isManager(u)&&!(hasRole(u,'DEAN_OFFICE')&&u.deanAssignments.some(a=>a.facultyId===facultyId))&&!hasRole(u,'TEACHER')&&!hasRole(u,'CURATOR')&&!hasRole(u,'STAROSTA'))throw new HttpError(403,'Немає доступу до звітності факультету.');}
export function requireAdmin(u:Principal){if(!isManager(u))throw new HttpError(403,'Потрібні права адміністратора або розробника.');}
export function canViewSources(u:Principal){return isManager(u)||hasRole(u,'CURATOR')||hasRole(u,'DEAN_OFFICE');}
