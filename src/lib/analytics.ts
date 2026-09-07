import {db} from './db';
import type {Principal} from './auth';
import {groupScope,lessonScope,rosterScope,lessonGroupScope} from './access';
import {emptyCounts,metrics,sumCounts} from './metrics';
import {range,type Filters} from './filters';
import {effectiveNow} from './time';
import type {Prisma} from '../generated/prisma/client';
export async function analytics(user:Principal,f:Filters){
  const groupWhere:Prisma.GroupWhereInput={AND:[groupScope(user),{course:f.course,id:f.group,specialtyId:f.specialty,specialty:f.faculty?{facultyId:f.faculty}:undefined}]};
  const groups=await db.group.findMany({where:groupWhere,include:{specialty:{include:{faculty:true}},students:{select:{id:true,fullName:true,groupId:true},orderBy:{fullName:'asc'}}},orderBy:[{course:'asc'},{name:'asc'}]});
  const ids=groups.map(g=>g.id);
  const lessonWhere:Prisma.LessonWhereInput={AND:[lessonScope(user),{groups:{some:{AND:[{groupId:{in:ids}},lessonGroupScope(user)]}},startAt:range(f),endAt:{lte:effectiveNow().toJSDate()},cancelled:false,subjectId:f.subject}]};
  const lessons=await db.lesson.findMany({where:lessonWhere,select:{id:true,groups:{where:lessonGroupScope(user),select:{groupId:true}},roster:{where:{AND:[{student:{groupId:{in:ids}}},rosterScope(user)]},select:{studentId:true,attendance:{select:{statusCode:true,confirmed:true}}}}}});
  const countMap=new Map(groups.flatMap(g=>g.students.map(s=>[s.id,emptyCounts()] as const)));
  for(const lesson of lessons)for(const r of lesson.roster){const c=countMap.get(r.studentId);if(!c)continue;if(!r.attendance)c.unmarked++;else if(!r.attendance.confirmed)c.pending++;else c[r.attendance.statusCode]++;}
  const students=groups.flatMap(g=>g.students.map(s=>({...s,groupName:g.name,course:g.course,specialtyId:g.specialtyId,specialtyName:g.specialty.name,facultyId:g.specialty.facultyId,stats:metrics(countMap.get(s.id)!)})));
  const enrichedGroups=groups.map(g=>({...g,lessonCount:lessons.filter(l=>l.groups.some(lg=>lg.groupId===g.id)).length,stats:metrics(sumCounts(g.students.map(s=>countMap.get(s.id)!)))}));
  const specialties=Array.from(new Map(groups.map(g=>[g.specialtyId,g.specialty])).values()).map(s=>{const sg=enrichedGroups.filter(g=>g.specialtyId===s.id);return {...s,groupCount:sg.length,studentCount:sg.reduce((n,g)=>n+g.students.length,0),stats:metrics(sumCounts(sg.map(g=>g.stats)))};});
  return {groups:enrichedGroups,specialties,students,lessonCount:lessons.length,stats:metrics(sumCounts(students.map(s=>s.stats))),below70:students.filter(s=>s.stats.below70).length,below50:students.filter(s=>s.stats.below50).length};
}
export type Analytics=Awaited<ReturnType<typeof analytics>>;
export async function filterOptions(user:Principal){
  const groups=await db.group.findMany({where:groupScope(user),select:{id:true,name:true,specialty:{select:{id:true,name:true,faculty:{select:{id:true,name:true,slug:true}}}}},orderBy:{name:'asc'}});
  const faculties=Array.from(new Map(groups.map(g=>[g.specialty.faculty.id,g.specialty.faculty])).values());
  return {groups,specialties:Array.from(new Map(groups.map(g=>[g.specialty.id,g.specialty])).values()),faculties};
}
