import test from 'node:test';
import assert from 'node:assert/strict';
import {reportPeriod,parseReportKind,reportBody} from '../src/lib/report-input';
import {HttpError} from '../src/lib/errors';
test('report period defaults use the previous complete Kyiv calendar week and month',()=>{
  const previous={APP_ENV:process.env.APP_ENV,DEMO_MODE:process.env.DEMO_MODE,DEMO_DATE:process.env.DEMO_DATE};
  Object.assign(process.env,{APP_ENV:'demo',DEMO_MODE:'true',DEMO_DATE:'2026-09-07'});
  try{
    assert.deepEqual(reportPeriod('DAILY',{}),{from:'2026-09-07',to:'2026-09-07',student:undefined});
    assert.deepEqual(reportPeriod('WEEKLY',{}),{from:'2026-08-31',to:'2026-09-06',student:undefined});
    assert.deepEqual(reportPeriod('MONTHLY',{}),{from:'2026-08-01',to:'2026-08-31',student:undefined});
    assert.equal(reportPeriod('WEEKLY',{from:'2026-09-01',to:'2026-09-03',student:'student-id'}).student,'student-id');
  }finally{for(const [key,value] of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
test('report input rejects unknown kinds, invalid periods and malformed filter values',()=>{
  for(const kind of ['YEARLY',undefined,{},1])assert.throws(()=>parseReportKind(kind),e=>e instanceof HttpError&&e.status===400);
  for(const input of [null,[],true])assert.throws(()=>reportBody(input),HttpError);
  for(const body of [{from:'2026-09-08',to:'2026-09-07'},{student:['one','two']},{student:'x'.repeat(101)},{group:{}},{course:5},{threshold:30}])assert.throws(()=>reportPeriod('WEEKLY',body),HttpError);
});
