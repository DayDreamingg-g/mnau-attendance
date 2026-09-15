import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const compression=require('next/dist/compiled/compression');
const {pipeNodeReadableToNodeResponse}=require('next/dist/server/pipe-readable');
test('compressed Next responses remove one-shot drain listeners during backpressure and on cancellation',async()=>{
 const warnings:Error[]=[];const watch=(w:Error)=>{if(w.name==='MaxListenersExceededWarning')warnings.push(w);};process.on('warning',watch);
 const chunk=randomBytes(65536),expected=createHash('sha256');for(let i=0;i<32;i++)expected.update(chunk);const hash=expected.digest('hex');
 const streams:Readable[]=[],closures:Promise<void>[]=[];const errors:unknown[]=[];let removedCalls=0,onceCalls=0;
 const middleware=compression({threshold:0});
 const server=http.createServer((req,res)=>middleware(req,res,()=>{
  closures.push(new Promise<void>(resolve=>res.once('close',resolve)));
  res.setHeader('Content-Type','text/plain');
  const removed=()=>removedCalls++;res.once('drain',removed);res.removeListener('drain',removed);
  res.flushHeaders();
  const probe=()=>{};const stream=res.on('drain',probe) as unknown as Readable;streams.push(stream);res.off('drain',probe);
  res.once('drain',()=>onceCalls++);
  void pipeNodeReadableToNodeResponse(Readable.from((function*(){for(let i=0;i<32;i++)yield chunk;})()),res).catch((e:unknown)=>errors.push(e));
 }));
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+(server.address() as {port:number}).port;
 try{
  for(let i=0;i<12;i++){const response=await fetch(url,{headers:{'accept-encoding':'gzip'}});assert.equal(response.headers.get('content-encoding'),'gzip');const bytes=Buffer.from(await response.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);assert.equal(streams.at(-1)!.listenerCount('drain'),0);}
  assert.equal(onceCalls,12);assert.equal(removedCalls,0);
  const controller=new AbortController();const response=await fetch(url,{signal:controller.signal});await response.body!.getReader().read();controller.abort();
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));process.off('warning',watch);}
 await Promise.all(closures);
 for(const stream of streams)assert.equal(stream.listenerCount('drain'),0);
 assert.equal(warnings.length,0);assert.equal(errors.length,0);
});
