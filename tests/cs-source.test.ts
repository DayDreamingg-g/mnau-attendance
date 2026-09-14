import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CS_COUNTS,readCSData,teacherEmail,teacherKey} from '../src/lib/cs-beta-data';
import {weekHalf} from '../scripts/generate-semester-schedule';
import {scheduleWeek} from '../src/lib/schedule-week';
import {verifyCSSource,expandCSCalendar} from '../src/lib/cs-schedule';
test('the supplied roster preserves 58 source names, exact counts, pages and raw spelling',async()=>{
  const {students}=await readCSData();
  for(const [id,count] of Object.entries(CS_COUNTS))assert.equal(students.filter(s=>s.groupId===id).length,count);
  assert.equal(students.find(s=>s.fullName.startsWith('Штикер'))?.fullName,'Штикер Міхаіл Андрійович');
  assert.equal(students.find(s=>s.fullName.startsWith('Ломпас'))?.fullName,'Ломпас Олександр Ігоревич');
  assert.ok(students.every(s=>s.source.page>=1&&s.source.page<=3&&s.source.rawName.trim()===s.fullName));
});
test('teacher identity normalizes titles/case/spacing and user-confirmed aliases',async()=>{
  assert.equal(teacherKey('  доц. ПАРХОМЕНКО О. Ю.'),teacherKey('Пархоменко А.Ю.'));
  assert.equal(teacherKey('ас. Богатенкова О.Є.'),teacherKey('ст.в. Богатєнкова О.Є.'));
  assert.equal(teacherEmail('Ємельянов С.І.'),'yemelianov.si@test.com');
  const {cells}=await readCSData();assert.equal(new Set(cells.flatMap(c=>c.teacher?[teacherKey(c.teacher)]:[])).size,19);
  assert.ok(cells.some(c=>c.groups.length===2&&c.subject?.includes('ІТ-')));
  assert.ok(cells.every(c=>c.page===1&&c.bbox.length===4&&c.sourceCell));
  assert.ok(cells.filter(c=>c.raw.includes('Вакансія')).every(c=>c.teacher===null));
});
test('week alternation uses the approved actual base week, including ISO year and DST boundaries',async()=>{
  const mapping=JSON.parse(await readFile('source-data/cs-beta/week-mapping.json','utf8'));
  assert.equal(mapping.baseMonday,'2026-09-14');
  assert.equal(weekHalf('2026-09-14'),'lower');assert.equal(weekHalf('2026-09-20'),'lower');
  assert.equal(weekHalf('2026-09-21'),'upper');assert.equal(weekHalf('2026-09-28'),'lower');
  for(const [date,week] of [['2026-09-14','DENOMINATOR'],['2026-09-20','DENOMINATOR'],['2026-09-21','NUMERATOR'],['2026-09-27','NUMERATOR'],['2026-09-28','DENOMINATOR']])assert.equal(scheduleWeek(date),week);
  assert.equal(weekHalf('2026-09-07'),'upper');assert.equal(weekHalf('2026-10-26'),'lower');
});

test('PDF checksums and generated semester cover every group, all teachers and shared cells without slot conflicts',async()=>{
  const {cells}=await verifyCSSource(),lessons=expandCSCalendar(cells);
  for(const id of Object.keys(CS_COUNTS))assert.ok(lessons.some(l=>l.groups.includes(id)),id);
  const teachers=new Set(cells.flatMap(c=>c.teacher?[teacherKey(c.teacher)]:[]));
  for(const key of teachers)assert.ok(lessons.some(l=>l.cell.teacher&&teacherKey(l.cell.teacher)===key),key);
  assert.ok(!lessons.some(l=>l.groups.includes('g-4-4')&&teacherKey(l.cell.teacher??'')===teacherKey('Пархоменко О.Ю.')));
  for(const cell of cells.filter(c=>c.groups.length>1))assert.ok(lessons.some(l=>l.cells.some(c=>c.id===cell.id)&&cell.groups.every(g=>l.groups.includes(g))));
  const empty=cells.filter(c=>!c.groups.includes('g-3-4'));
  assert.throws(()=>expandCSCalendar([...empty,...cells.filter(c=>c.groups.includes('g-3-4')).map(c=>({...c,weekday:'INVALID'}))]));
});
