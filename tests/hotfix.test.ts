import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TeacherSearch,teacherSearchContext} from '../src/components/teacher-search';
import {JournalRowState,attendanceStatusLabel} from '../src/components/journal-row-state';
import {displayName} from '../src/lib/display-name';
import {timestampLabel} from '../src/lib/time';
import {auditTitle} from '../src/lib/audit-presentation';
import {feedbackVisibility} from '../src/lib/feedback';

test('teacher search GET form preserves past, date and scope, with active navigation',()=>{
  const params={past:'1',date:'2026-09-15',q:'Математика',term:'term&1',scope:'faculty',from:'2026-09-01',page:'3',tag:['one','two']};
  assert.deepEqual(teacherSearchContext(params),[{name:'past',value:'1'},{name:'term',value:'term&1'},{name:'scope',value:'faculty'},{name:'from',value:'2026-09-01'},{name:'tag',value:'one'},{name:'tag',value:'two'}]);
  const html=renderToStaticMarkup(React.createElement(TeacherSearch,{params,date:params.date,q:params.q,today:'2026-09-16'}));
  assert.match(html,/method="get"/);assert.match(html,/type="hidden" name="past" value="1"/);
  assert.match(html,/name="date" value="2026-09-15"/);assert.match(html,/aria-current="page" href="[^\"]*past=1[^\"]*">Минулі заняття/);
  assert.ok(html.includes('term%261'));assert.ok(!html.includes('name="page"'));
});
test('display names normalize TEST tokens without changing real names',()=>{
  for(const [input,expected] of [['Адміністратор демо','Адміністратор TEST'],['Деканат · демо','Деканат · TEST'],['Розробник · beta','Розробник · TEST'],['Teacher · DEMO','Teacher · TEST'],['Демосфен Бетаєнко','Демосфен Бетаєнко'],['Betaine','Betaine']])assert.equal(displayName(input),expected);
});
test('timestamps use Kyiv and Ukrainian grammatical month, including winter offset and midnight',()=>{
  assert.equal(timestampLabel(new Date('2026-09-15T19:36:26.382Z')),'15 вересня 2026, 22:36');
  assert.equal(timestampLabel(new Date('2026-12-31T22:10:00Z')),'01 січня 2027, 00:10');
  assert.equal(timestampLabel(new Date('2026-03-29T01:30:00Z')),'29 березня 2026, 04:30');
});
test('dirty journal rows show human previous state on a separate wrapping line',()=>{
  assert.deepEqual(['PRESENT','N','HV',null].map(attendanceStatusLabel),['Присутній','Відсутній','Поважна причина','Не відмічено']);
  const html=renderToStaticMarkup(React.createElement(JournalRowState,{dirty:true,status:'N',previous:{status:'PRESENT',attendanceMode:null}}));
  assert.match(html,/<strong>Змінено<\/strong><span>Було: Присутній · Формат не вказано<\/span>/);
  assert.doesNotMatch(html,/PRESENT|у БД/);
});
test('audit titles prioritize action and distinguish a mode-only change, without mutating metadata',()=>{
  const entries={REVOKE_ALL:'Відкликано всі сеанси',RESET_PASSWORD:'Скинуто пароль',PASSWORD_CHANGE:'Змінено пароль',ADD_ROLE:'Змінено роль',FEEDBACK_STATE:'Змінено статус відгуку',FEEDBACK_DELETE:'Видалено відгук'};
  for(const [action,title] of Object.entries(entries)){const details=Object.freeze({action});assert.equal(auditTitle({source:'PROFILE',objectType:'User',details}),title);}
  assert.equal(auditTitle({source:'PASSWORD_CHANGE',objectType:'User',details:null}),'Змінено пароль');
  assert.equal(auditTitle({source:'JOURNAL_SAVE',objectType:'Attendance',details:{oldAttendanceMode:null,newAttendanceMode:'ONLINE'},oldStatus:'PRESENT',newStatus:'PRESENT'}),'Змінено формат присутності');
  assert.equal(auditTitle({source:'JOURNAL_SAVE',objectType:'Attendance',details:{oldAttendanceMode:'ONLINE',newAttendanceMode:null},oldStatus:'PRESENT',newStatus:'N'}),'Змінено відвідуваність');
});
test('feedback visibility excludes deleted by default and explicitly includes them when requested',()=>{
  assert.deepEqual(feedbackVisibility(),{deletedAt:null});assert.deepEqual(feedbackVisibility(true),{});
});
