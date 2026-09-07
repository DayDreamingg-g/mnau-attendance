import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CustomSelect} from '../src/components/custom-select';
import {Filters} from '../src/components/filters';

const options=[{value:'',label:'Усі групи'},{value:'kn-3-1',label:'Кн 3/1'},{value:'kn-3-2',label:'Кн 3/2',disabled:true}];

test('select without hydration renders a real named control with its selected value',()=>{
  const markup=renderToStaticMarkup(createElement(CustomSelect,{name:'group',label:'Група',options,defaultValue:'kn-3-1',required:true}));
  assert.match(markup,/<select[^>]*name="group"[^>]*required=""/);
  assert.match(markup,/<option value="kn-3-1" selected="">Кн 3\/1<\/option>/);
  assert.match(markup,/<option value="kn-3-2" disabled=""/);
  assert.equal((markup.match(/name="group"/g)??[]).length,1);
  assert.doesNotMatch(markup,/aria-hidden="true"|type="hidden"|role="combobox"/);
});

test('controlled select and disabled state retain native form semantics before hydration',()=>{
  const markup=renderToStaticMarkup(createElement(CustomSelect,{name:'group',options,value:'kn-3-1',defaultValue:'',disabled:true}));
  assert.match(markup,/<select[^>]*disabled=""/);
  assert.match(markup,/<option value="kn-3-1" selected=""/);
});

test('GET filters retain all non-dropdown context alongside the named select controls',()=>{
  const markup=renderToStaticMarkup(createElement(Filters,{value:{from:'2026-09-01',to:'2026-09-30',course:3,faculty:'faculty',threshold:50,sort:'n',order:'desc'},options:{groups:[],specialties:[],faculties:[]}}));
  assert.match(markup,/<form[^>]*method="GET"/);
  for(const name of ['course','specialty','group'])assert.equal((markup.match(new RegExp(`name="${name}"`,'g'))??[]).length,1);
  for(const [name,value] of [['faculty','faculty'],['threshold','50'],['sort','n'],['order','desc']])assert.match(markup,new RegExp(`type="hidden" name="${name}" value="${value}"`));
  assert.match(markup,/<option value="3" selected="">3 курс<\/option>/);
});
