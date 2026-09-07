import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {db} from '../../src/lib/db';
import {hashToken} from '../../src/lib/auth';
import {parseFilters,filterLink} from '../../src/lib/filters';

const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3001';
const token=randomBytes(32).toString('hex');
const sessionHash=hashToken(token);
const cookie=`mnau_session=${token}`;
const f=parseFilters({});
let groupId:string,specialtyId:string,studentId:string;

before(async()=>{
  const user=await db.user.findUniqueOrThrow({where:{email:'dean@test.com'}});
  const assignment=await db.deanAssignment.findFirstOrThrow({where:{userId:user.id}});
  const group=await db.group.findFirstOrThrow({where:{specialty:{facultyId:assignment.facultyId},students:{some:{roster:{some:{}}}}},include:{students:{take:1},specialty:true}});
  groupId=group.id;specialtyId=group.specialtyId;studentId=group.students[0].id;
  await db.session.create({data:{userId:user.id,tokenHash:sessionHash,expiresAt:new Date(Date.now()+120000)}});
});
after(async()=>{await db.session.deleteMany({where:{tokenHash:sessionHash}});await db.$disconnect();});

async function html(path:string){const response=await fetch(base+path,{headers:{cookie}});assert.equal(response.status,200,path);return response.text();}
function links(markup:string){return Array.from(markup.matchAll(/href="([^"]+)"/g),match=>match[1].replaceAll('&amp;','&'));}
function findLink(markup:string,path:string){const found=links(markup).find(href=>href.split('?')[0]===path);assert.ok(found,`Expected link to ${path}`);return found;}
function period(path:string){const query=new URL(path,base).searchParams;assert.equal(query.get('from'),f.from);assert.equal(query.get('to'),f.to);return query;}

test('dean follows specialty, group, student and lesson links with scoped periods and a safe student return breadcrumb',async()=>{
  const start=filterLink('/',{...f,group:groupId});
  const dashboard=await html(start);
  const specialtyLink=findLink(dashboard,`/specialties/${specialtyId}`);period(specialtyLink);
  const specialty=await html(specialtyLink);
  const attention=links(specialty).find(link=>link.startsWith('/students?')&&link.includes('threshold=70'));assert.ok(attention);
  assert.equal(period(attention).get('specialty'),specialtyId);
  const groupLink=findLink(specialty,`/groups/${groupId}`);assert.equal(period(groupLink).get('group'),groupId);
  const group=await html(groupLink);
  assert.match(group,new RegExp(`type="hidden" name="group" value="${groupId}"`));
  const groupAttention=links(group).find(link=>link.startsWith('/students?')&&link.includes('threshold=50'));assert.ok(groupAttention);assert.equal(period(groupAttention).get('group'),groupId);
  const studentLink=findLink(group,`/students/${studentId}`);assert.equal(period(studentLink).get('student'),studentId);
  const student=await html(studentLink);
  assert.match(student,/Підтвердження/);assert.match(student,/Корпус \/ аудиторія/);
  const lessonLink=links(student).find(link=>link.startsWith('/teacher/lessons/'));assert.ok(lessonLink);assert.equal(period(lessonLink).get('student'),studentId);
  const lesson=await html(lessonLink);
  const returnLink=findLink(lesson,`/students/${studentId}`);assert.equal(period(returnLink).get('student'),studentId);
  const parentLink=findLink(student,`/groups/${groupId}`);assert.equal(period(parentLink).has('student'),false);
  const unrelated=await html(lessonLink.replace(`student=${studentId}`,'student=unrelated-student'));
  assert.equal(links(unrelated).some(link=>link.startsWith('/students/unrelated-student')),false);
});

test('group lesson links honor the same selected subject as analytics',async()=>{
  const subjectLesson=await db.lesson.findFirstOrThrow({where:{groups:{some:{groupId}},startAt:{gte:new Date(f.from),lte:new Date(f.to+'T23:59:59Z')}}});
  const markup=await html(filterLink(`/groups/${groupId}`,{...f,subject:subjectLesson.subjectId}));
  const lessonIds=[...new Set(links(markup).filter(link=>link.startsWith('/teacher/lessons/')).map(link=>new URL(link,base).pathname.split('/').at(-1)!))];
  assert.ok(lessonIds.length>0);
  const lessons=await db.lesson.findMany({where:{id:{in:lessonIds}},select:{subjectId:true}});
  assert.ok(lessons.every(lesson=>lesson.subjectId===subjectLesson.subjectId));
});
