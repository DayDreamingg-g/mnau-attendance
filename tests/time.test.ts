import test from 'node:test';
import assert from 'node:assert/strict';
import {Settings} from 'luxon';
import {clockDescription,demoEnabled,effectiveNow,today} from '../src/lib/time';

function withClock(env:Record<string,string|undefined>,check:()=>void){
  const keys=['APP_ENV','DEMO_MODE','DEMO_DATE'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const previousNow=Settings.now;
  try{
    for(const key of keys){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}
    Settings.now=()=>Date.parse('2026-09-08T22:05:00Z');
    check();
  }finally{
    Settings.now=previousNow;
    for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
  }
}

test('production clock uses real Kyiv calendar, even across UTC midnight',()=>{
  withClock({APP_ENV:'production',DEMO_MODE:'false'},()=>{
    assert.equal(demoEnabled(),false);
    assert.equal(today(),'2026-09-09');
    assert.equal(effectiveNow().toFormat('HH:mm'),'01:05');
    assert.match(clockDescription(),/^Реальний час: 2026-09-09 · 01:05/);
  });
});

test('freezing clock requires both explicit demo flags and a valid date',()=>{
  withClock({APP_ENV:'demo',DEMO_MODE:'true',DEMO_DATE:'2026-09-07'},()=>{
    assert.equal(today(),'2026-09-07');
    assert.equal(effectiveNow().toFormat('HH:mm'),'21:00');
    assert.equal(clockDescription(),'Фіксований демо-час: 2026-09-07 · 21:00 · Europe/Kyiv');
  });
  for(const env of [{APP_ENV:'demo',DEMO_MODE:'false',DEMO_DATE:'2026-09-07'},{DEMO_MODE:'true',DEMO_DATE:'2026-09-07'},{APP_ENV:'demo',DEMO_MODE:'true'}]){
    withClock(env,()=>{
      assert.equal(today(),'2026-09-09');
      assert.match(clockDescription(),/^Реальний час/);
    });
  }
});

test('invalid or leaked production demo settings fail closed',()=>{
  for(const env of [{APP_ENV:'production',DEMO_MODE:'true'},{APP_ENV:'production',DEMO_DATE:'2026-09-07'}]){
    withClock(env,()=>assert.throws(()=>effectiveNow(),/forbidden in production/));
  }
  for(const date of ['2026-02-30','2026-09-07T20:00','nonsense']){
    withClock({APP_ENV:'demo',DEMO_MODE:'true',DEMO_DATE:date},()=>assert.throws(()=>effectiveNow(),/Invalid DEMO_DATE/));
  }
});
