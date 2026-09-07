import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {compareValues,sortRows,sortLink} from '../src/lib/sorting';
import {parseFilters,type Filters} from '../src/lib/filters';
import {SortHeader} from '../src/components/sort-header';

const filters:Filters={from:'2026-09-01',to:'2026-09-30',course:3,faculty:'faculty',specialty:'specialty',group:'group',subject:'subject',status:'N',threshold:50};

test('Ukrainian text sorting uses the Ukrainian alphabet and natural group numbers',()=>{
  const rows=['Їжак','Іван','Ґанок','Єва','Ганна','Ич','Ева'].map(name=>({name}));
  assert.deepEqual(sortRows(rows,{sort:'student'},{student:r=>r.name}).map(r=>r.name),['Ганна','Ґанок','Ева','Єва','Ич','Іван','Їжак']);
  assert.ok(compareValues('Кн 3/2','Кн 3/10')<0);
});

test('numeric values and dates sort by value, with missing values last in both directions',()=>{
  for(const order of ['asc','desc'] as const){
    const rows=[{n:10},{n:null},{n:2},{n:undefined},{n:100}];
    assert.deepEqual(sortRows(rows,{sort:'present',order},{present:r=>r.n}).map(r=>r.n),order==='asc'?[2,10,100,null,undefined]:[100,10,2,null,undefined]);
  }
  assert.ok(compareValues(new Date('2026-01-01'),new Date('2026-02-01'))<0);
  assert.equal(compareValues(NaN,2,'desc'),1);
});

test('ties remain stable and table-specific keys never reorder an unrelated table',()=>{
  const rows=[{id:'b',n:2},{id:'a',n:2},{id:'c',n:1}];
  assert.deepEqual(sortRows(rows,{sort:'present'},{present:r=>r.n}).map(r=>r.id),['c','b','a']);
  assert.deepEqual(sortRows(rows,{sort:'specialties_students'},{present:r=>r.n}),rows);
  assert.deepEqual(rows.map(r=>r.id),['b','a','c']);
});

test('sorting stays on the current page and preserves every active filter and threshold',()=>{
  const url=new URL(sortLink('/groups/known-group',filters,'n'),'https://attendance.test');
  assert.equal(url.pathname,'/groups/known-group');
  for(const [key,value] of Object.entries(filters)) assert.equal(url.searchParams.get(key),String(value));
  assert.equal(url.searchParams.get('sort'),'n');
  assert.equal(url.searchParams.get('order'),'desc');
  const second=new URL(sortLink(url.pathname,{...filters,sort:'n',order:'desc'},'n'),'https://attendance.test');
  assert.equal(second.searchParams.get('order'),'asc');
  assert.equal(new URL(sortLink(url.pathname,{...filters,sort:'n'},'n'),'https://attendance.test').searchParams.get('order'),'desc');
});

test('new table keys are accepted while unsupported and repeated query values fail validation',()=>{
  assert.equal(parseFilters({...filters,course:'3',threshold:'50',sort:'history_date',order:'desc'}).sort,'history_date');
  assert.throws(()=>parseFilters({from:filters.from,to:filters.to,sort:'arbitrary'}));
  assert.throws(()=>parseFilters({from:filters.from,to:filters.to,sort:['student','n']}));
});

test('rendered sort headers expose the selected direction and link to the group route',()=>{
  const markup=renderToStaticMarkup(createElement(SortHeader,{label:'Показник',sortKey:'percentage',filters:{...filters,sort:'percentage',order:'asc'},path:'/groups/known-group'}));
  assert.match(markup,/aria-sort="ascending"/);
  assert.match(markup,/href="\/groups\/known-group\?/);
  assert.match(markup,/threshold=50/);
  assert.match(markup,/order=desc/);
  assert.doesNotMatch(markup,/href="\/students/);
});
