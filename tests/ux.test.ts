import test from 'node:test';
import assert from 'node:assert/strict';
import {teacherIdentity} from '../src/lib/teacher-identity';
import {historyBatches} from '../src/lib/attendance-history';
import {reportPeriod} from '../src/lib/report-input';
import {selectedPeriod,reportTitle,scopedTeacherLabel} from '../src/lib/report-presentation';
import {activeNavigation} from '../src/lib/navigation';
test('nested pages select exactly one available navigation item for each role',()=>{
 const items=['/','/groups','/reports','/admin','/admin/feedback','/admin/audit'];
 assert.equal(activeNavigation('/admin/feedback',items),'/admin/feedback');
 assert.equal(activeNavigation('/reports/saved',items),'/reports');
 assert.equal(activeNavigation('/students/one',items),'/groups');
 assert.equal(activeNavigation('/teacher/lessons/one',items),'/groups');
 assert.equal(activeNavigation('/teacher/lessons/one',[...items,'/teacher']),'/teacher');
});
test('presentation separates known teacher titles, respects saved position and leaves unrelated identities alone',()=>{
 assert.deepEqual(teacherIdentity('ст.в. Коломієць О.П.'),{name:'Коломієць О.П.',position:'SENIOR_LECTURER',positionLabel:'Старший викладач'});
 assert.equal(teacherIdentity('доц. Коломієць О.П.','PROFESSOR').positionLabel,'Професор');
 for(const raw of ['доц. Пархоменко А.Ю.','Пархоменко О. Ю.'])assert.equal(teacherIdentity(raw).name,'Пархоменко О.Ю.');
 assert.equal(teacherIdentity('Пархоменко І.В.').name,'Пархоменко І.В.');
 assert.equal(teacherIdentity('Асєєва О.О.').name,'Асєєва О.О.');
 assert.equal(teacherIdentity('проф. Іваненко П.П.').position,'PROFESSOR');
 assert.equal(teacherIdentity('ас. Іваненко П.П.').position,'ASSISTANT');
});
test('a report spanning multiple teachers cannot be attributed to the logged-in teacher',()=>{
 const a={id:'one',displayName:'доц. Іваненко П.П.',position:'PROFESSOR'};
 assert.deepEqual(scopedTeacherLabel([a,a]),{name:'Іваненко П.П.',position:'Професор'});
 assert.equal(scopedTeacherLabel([a,{...a,id:'two'}]),undefined);
 assert.equal(scopedTeacherLabel([a,null]),undefined);
 assert.equal(scopedTeacherLabel([]),undefined);
});
test('week and month pickers derive complete ranges including year and leap boundaries',()=>{
 assert.deepEqual(selectedPeriod('WEEKLY','2026-W01'),{from:'2025-12-29',to:'2026-01-04'});
 assert.deepEqual(selectedPeriod('MONTHLY','2028-02'),{from:'2028-02-01',to:'2028-02-29'});
 assert.equal(selectedPeriod('WEEKLY','2026-W99'),null);
 assert.equal(reportTitle('WEEKLY',{view:'LESSONS'}),'Тиждень · Пари');
 assert.equal(reportTitle('MONTHLY'),'Місяць · Студенти');
 assert.throws(()=>reportPeriod('SEMESTER',{from:'2026-09-01',to:'2026-12-31'}));
 assert.throws(()=>reportPeriod('CUSTOM',{}));
 assert.throws(()=>reportPeriod('WEEKLY',{view:'invalid'}));
 assert.equal(reportPeriod('SEMESTER',{from:'2026-09-01',to:'2026-12-31',term:'current',view:'STUDENTS'}).view,'STUDENTS');
});
test('history batches preserve individual audit rows and keep separate requests and legacy records distinct',()=>{
 const row=(id:string,requestId?:string,lessonId='a')=>({id,details:requestId?{requestId}:{},actorId:'teacher',lessonId});
 const rows=[row('1','r1'),row('2','r1'),row('3','r2'),row('4'),row('5','r1','b')];
 assert.deepEqual(historyBatches(rows).map(g=>g.map(r=>r.id)),[['1','2'],['3'],['4'],['5']]);assert.equal(rows.length,5);
});
