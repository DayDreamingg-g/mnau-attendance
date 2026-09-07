import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const expected=['attendance-alert50.json','attendance-alert70.json','daily-attendance.json','monthly-attendance.json','report-generation.json','weekly-curator-summary.json'];
test('six importable workflows use machine credentials, retriable requests and persisted-result validation',async()=>{
  const files=(await readdir('n8n')).filter(name=>name.endsWith('.json')).sort();assert.deepEqual(files,expected);
  for(const file of files){
    const text=await readFile(`n8n/${file}`,'utf8'),workflow=JSON.parse(text);
    assert.equal(workflow.active,false);assert.equal(workflow.settings.timezone,'Europe/Kyiv');assert.equal(workflow.settings.saveDataErrorExecution,'all');
    assert.doesNotMatch(text,/Bearer\s+[a-z0-9]|"password"\s*:|"token"\s*:|"authorization"\s*:/i);
    const nodes=workflow.nodes as {name:string;type:string;parameters:Record<string,unknown>;credentials?:unknown;retryOnFail?:boolean;maxTries?:number;waitBetweenTries?:number}[];
    assert.ok(nodes.some(n=>n.type==='n8n-nodes-base.manualTrigger'));assert.equal(nodes.filter(n=>n.type==='n8n-nodes-base.scheduleTrigger').length,file==='report-generation.json'?0:1);
    const http=nodes.find(n=>n.type==='n8n-nodes-base.httpRequest')!;assert.equal(http.parameters.method,'POST');assert.equal(http.parameters.url,'http://web:3000/api/machine/reports');assert.equal(http.parameters.genericAuthType,'httpHeaderAuth');assert.deepEqual(http.credentials,{httpHeaderAuth:{name:'MNAU report machine'}});assert.equal(http.retryOnFail,true);assert.equal(http.maxTries,3);assert.equal(http.waitBetweenTries,5000);
    const body=JSON.parse(http.parameters.jsonBody as string);assert.equal(body.requireReady,true);
    const verify=nodes.find(n=>n.type==='n8n-nodes-base.code')!;const run=new Function('$input',verify.parameters.jsCode as string);
    assert.equal(run({first:()=>({json:{state:'READY',reused:true}})})[0].json.state,'READY');assert.throws(()=>run({first:()=>({json:{state:'PENDING'}})}),/did not reach READY/);
    assert.ok(workflow.connections[http.name].main[0].some((edge:{node:string})=>edge.node===verify.name));
  }
});
