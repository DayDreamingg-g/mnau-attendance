import test from 'node:test';
import assert from 'node:assert/strict';
import {journalRowSchema,resolveAttendanceMode,auditModeChange} from '../src/lib/attendance-mode';
import {countAttendance,emptyCounts,metrics,sumCounts} from '../src/lib/metrics';
import {reportTable,reportXlsx} from '../src/lib/report-files';
import type {ReportSummary} from '../src/lib/report-types';
test('mode validation rejects non-presence combinations and accepts old requests',()=>{
  for(const status of ['N','HV',null])for(const attendanceMode of ['ONLINE','OFFLINE'])assert.equal(journalRowSchema.safeParse({studentId:'s',status,attendanceMode}).success,false);
  for(const attendanceMode of ['ONLINE','OFFLINE',null,undefined])assert.equal(journalRowSchema.safeParse({studentId:'s',status:'PRESENT',attendanceMode}).success,true);
  assert.equal(resolveAttendanceMode({status:'N'},'ONLINE'),null);
  assert.equal(resolveAttendanceMode({status:'HV'},'OFFLINE'),null);
  assert.equal(resolveAttendanceMode({status:'PRESENT'},'ONLINE'),'ONLINE');
  assert.equal(resolveAttendanceMode({status:'PRESENT',attendanceMode:null},'ONLINE'),null);
  assert.deepEqual(auditModeChange({oldAttendanceMode:'ONLINE',newAttendanceMode:'OFFLINE'}),{before:'Онлайн',after:'Офлайн'});
  assert.equal(auditModeChange({oldConfirmed:true}),null);
  assert.equal(auditModeChange({oldAttendanceMode:null,newAttendanceMode:null}),null);
});
test('mode counts refine PRESENT without changing attendance or expected totals',()=>{
  const counts=emptyCounts();
  for(const a of [{statusCode:'PRESENT',attendanceMode:'ONLINE'},{statusCode:'PRESENT',attendanceMode:'OFFLINE'},{statusCode:'PRESENT'},{statusCode:'N'},{statusCode:'HV'},null] as const)countAttendance(counts,a);
  const stats=metrics(counts);assert.equal(stats.PRESENT,3);assert.equal(stats.ONLINE,1);assert.equal(stats.OFFLINE,1);assert.equal(stats.expected,6);assert.equal(stats.percentage,75);
  const combined=sumCounts([counts,{PRESENT:2,N:0,HV:0,unmarked:0,pending:0}]);assert.equal(combined.PRESENT,5);assert.equal(combined.ONLINE,1);assert.equal(combined.OFFLINE,1);
});
test('legacy snapshots without mode counters or student rows retain export fallback',()=>{
  const stats=metrics({PRESENT:2,N:1,HV:0,unmarked:0,pending:0});
  const summary={stats,students:3,groups:1,lessons:[],below70:[],below50:0} as unknown as ReportSummary;
  for(const view of ['STUDENTS','LESSONS'] as const){const table=reportTable(summary,{from:'2026-09-01',to:'2026-09-15',view});const header=table[0],total=table.at(-1)!;assert.equal(total[header.indexOf('PRESENT')],2);assert.equal(total[header.indexOf('Онлайн')],0);assert.equal(total[header.indexOf('Офлайн')],0);}
  assert.ok(reportXlsx(summary,{from:'2026-09-01',to:'2026-09-15'}).includes(Buffer.from('Підсумок')));
});
