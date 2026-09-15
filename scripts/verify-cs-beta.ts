import 'dotenv/config';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {CS_GROUP_COUNTS,isCSSpecialty,resolveCSGroups,csName} from '../src/lib/cs-structure';
import {readCSData,stableId} from '../src/lib/cs-beta-data';

// Official provenance is fixed; current membership is allowed to evolve. Read-only.
try{
  const groups=await resolveCSGroups(db),ids=groups.map(g=>g.id);
  const specialties=(await db.specialty.findMany()).filter(s=>isCSSpecialty(s.name));
  assert.equal(specialties.length,1);assert.ok(groups.every(g=>g.specialtyId===specialties[0].id));
  const {students}=await readCSData(),sourceId='roster-'+students[0].source.sha256;
  const rows=await db.rosterSourceRow.findMany({where:{sourceId},include:{student:true},orderBy:{row:'asc'}});
  assert.equal(rows.length,128,'Apply beta:import-complete-cs-roster after reviewing its dry-run.');
  assert.equal(new Set(rows.map(r=>r.studentId)).size,128);
  for(const [index,source] of students.entries()){
    const row=rows[index],group=groups.find(g=>csName(g.name)===csName(source.groupName))!;
    assert.equal(row.row,index+1);assert.equal(row.fullName,source.fullName);assert.equal(row.groupId,group.id);
    if(source.legacy)assert.equal(row.student.importKey,stableId('cs-roster',source.legacy.sha256+':'+source.legacy.index));
  }
  const officialCounts=Object.fromEntries(groups.map(g=>[csName(g.name),rows.filter(r=>r.groupId===g.id).length]));assert.deepEqual(officialCounts,CS_GROUP_COUNTS);
  const live=await Promise.all(groups.map(async g=>({group:csName(g.name),active:await db.student.count({where:{groupId:g.id,active:true}}),archived:await db.student.count({where:{groupId:g.id,active:false}})})));
  const lessons=await db.lesson.findMany({where:{cancelled:false,groups:{some:{groupId:{in:ids}}}},include:{groups:true}}),slots=new Set<string>();
  for(const lesson of lessons)for(const group of lesson.groups.filter(g=>ids.includes(g.groupId))){const slot=group.groupId+':'+lesson.startAt.toISOString().slice(0,10)+':'+lesson.pairNumber;assert.ok(!slots.has(slot),'Competing active calendar slot: '+slot);slots.add(slot);}
  const term=await db.academicTerm.findFirst({where:{facultyId:groups[0].specialty.facultyId,fromDate:'2026-09-01',toDate:'2026-12-31',confirmedAt:{not:null}}});assert.ok(term,'Confirmed September–December term missing.');
  const teachers=await db.teacher.findMany({where:{lessons:{some:{groups:{some:{groupId:{in:ids}}}}}},select:{id:true,displayName:true,retiredAt:true,userId:true,_count:{select:{lessons:true}}}});
  console.log(JSON.stringify({readOnly:true,officialSource:{rows:128,legacyIdentities:58,counts:officialCounts},liveMembership:live,term:{id:term.id,from:term.fromDate,to:term.toDate,archived:!!term.archivedAt},teachers,activeLessons:lessons.length,attendance:await db.attendance.count({where:{roster:{groupId:{in:ids}}}}),backfill:await db.backfillBatch.findMany({select:{id:true,createdAt:true,result:true}})},null,2));
}finally{await db.$disconnect();}
