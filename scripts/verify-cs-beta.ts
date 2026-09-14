import 'dotenv/config';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {CS_GROUP_COUNTS,isCSSpecialty,resolveCSGroups,csName} from '../src/lib/cs-structure';
import {readCSData,teacherKey,teacherEmail} from '../src/lib/cs-beta-data';
import {principalSelect} from '../src/lib/auth';
import {groupScope} from '../src/lib/access';
import {effectiveNow} from '../src/lib/time';
try{
  const groups=await resolveCSGroups(db),ids=groups.map(g=>g.id),specialties=(await db.specialty.findMany()).filter(s=>isCSSpecialty(s.name));
  assert.equal(specialties.length,1);assert.ok(groups.every(g=>g.specialtyId===specialties[0].id));
  const counts=Object.fromEntries(await Promise.all(groups.map(async g=>[csName(g.name),await db.student.count({where:{groupId:g.id,active:true,isSynthetic:false}})])));
  assert.deepEqual(counts,CS_GROUP_COUNTS);assert.equal(await db.student.count({where:{groupId:{in:ids},isSynthetic:true,active:true}}),0);
  assert.equal(await db.student.count({where:{fullName:'Test Test Test'}}),0);assert.equal(await db.user.count({where:{email:'123@1561s.com'}}),0);
  const {cells}=await readCSData();
  const teachers=[];
  for(const key of new Set(cells.flatMap(c=>c.teacher?[teacherKey(c.teacher)]:[]))){
    const source=cells.find(c=>c.teacher&&teacherKey(c.teacher)===key)!;
    const email=teacherEmail(source.teacher!),u=await db.user.findUniqueOrThrow({where:{email},select:principalSelect});
    assert.ok(u.active&&u.teacher&&u.roles.some(r=>r.roleId==='TEACHER'),email);
    const lessonCount=await db.lesson.count({where:{teacherId:u.teacher.id,cancelled:false,groups:{some:{groupId:{in:ids}}}}});assert.ok(lessonCount,email);
    const assigned=await db.group.findMany({where:groupScope(u),select:{name:true}});
    if(key===teacherKey('Пархоменко О.Ю.'))assert.ok(!assigned.some(g=>csName(g.name)==='КН 4/1'));
    teachers.push({teacher:source.teacherDisplayName,email,lessonCount,groups:assigned.map(g=>g.name)});
  }
  assert.equal(teachers.length,19);
  const lessons=await db.lesson.findMany({where:{cancelled:false,groups:{some:{groupId:{in:ids}}}},include:{groups:true}}),slots=new Set<string>();
  for(const l of lessons)for(const g of l.groups.filter(g=>ids.includes(g.groupId))){const slot=g.groupId+':'+l.startAt.toISOString().slice(0,10)+':'+l.pairNumber;assert.ok(!slots.has(slot),slot);slots.add(slot);}
  const calendar=groups.map(g=>({group:csName(g.name),lessons:lessons.filter(l=>l.groups.some(lg=>lg.groupId===g.id)).length}));for(const g of calendar)assert.ok(g.lessons,g.group);
  const shared=await db.lesson.findFirstOrThrow({
    where:{cancelled:false,startAt:{gt:effectiveNow().toJSDate()},AND:[
      {groups:{some:{group:{name:'КН 3/1'}}}},
      {groups:{some:{group:{name:'КН 3/2'}}}},
    ]},include:{_count:{select:{roster:true}}},
  });assert.equal(shared._count.roster,41);
  console.log(JSON.stringify({specialty:specialties[0].name,groups:groups.length,students:counts,calendar,teachers,sharedRoster:shared._count.roster,realStudentAttendance:await db.attendance.count({where:{student:{groupId:{in:ids},isSynthetic:false}}})},null,2));
}finally{await db.$disconnect();}
