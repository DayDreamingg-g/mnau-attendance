// Optional standalone component QA. No application route, authentication, database or secret is loaded.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

if(process.env.MNAU_COMPONENT_PREVIEW!=='true'||process.env.APP_ENV==='production'){
  throw new Error('Component fixtures require MNAU_COMPONENT_PREVIEW=true outside production.');
}
const result=await build({entryPoints:['scripts/ui-fixtures.tsx'],bundle:true,write:false,format:'iife',platform:'browser',target:['chrome120','edge120'],jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},logLevel:'warning'});
const script=result.outputFiles[0].contents;
const globalCss=await readFile('src/app/globals.css','utf8');
const compiledCss=(await postcss([tailwindcss()]).process(globalCss,{from:'src/app/globals.css'})).css;
const css=compiledCss+'\n.fixture-content{max-width:1440px}.fixture-query{display:block;overflow-wrap:anywhere;font-family:monospace;font-size:13px;margin-top:12px}.fixture-states{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:16px}.fixture-states form{display:grid;gap:12px}.fixture-mobile{width:390px;height:1050px;display:block;border:1px solid var(--border);border-radius:12px;margin:20px auto}.fixture-mobile-shell{padding:24px;max-width:720px;margin:auto}@media(max-width:800px){.fixture-states{grid-template-columns:1fr}.fixture-content{padding:20px 16px}.fixture-mobile-shell{padding:12px}}';
const html=body=>`<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MNAU Attendance · Synthetic component QA</title><link rel="stylesheet" href="/fixture.css"><script>try{const requested=new URLSearchParams(location.search).get('theme');document.documentElement.classList.toggle('dark',(requested||localStorage.getItem('mnau-theme'))==='dark')}catch{}</script></head><body>${body}</body></html>`;
const fixture=html('<div id="root"></div><script src="/fixture.js" defer></script>');
const mobile=html('<main class="fixture-mobile-shell"><h1>Mobile viewport · 390 px</h1><p class="muted">Синтетичні компоненти в окремому viewport. <a class="text-link" href="/fixture">Desktop</a></p><iframe class="fixture-mobile" title="Мобільна перевірка 390 px" src="/fixture?mobile=true"></iframe></main>');
const server=createServer((request,response)=>{
  response.setHeader('Cache-Control','no-store');
  response.setHeader('X-Content-Type-Options','nosniff');
  if(request.method!=='GET'&&request.method!=='HEAD'){
    response.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});
    response.end(JSON.stringify({error:'Тестова помилка збереження: компонентна перевірка не має бази даних. Чернетка залишається у формі.'}));
    return;
  }
  const path=new URL(request.url??'/','http://localhost:4175').pathname;
  if(path==='/fixture.js'){response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});response.end(script);}
  else if(path==='/fixture.css'){response.writeHead(200,{'Content-Type':'text/css; charset=utf-8'});response.end(css);}
  else if(path==='/'||path==='/fixture'||path==='/mobile'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(path==='/mobile'?mobile:fixture);}
  else{response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('Fixture not found');}
});
server.listen(4175,process.env.MNAU_COMPONENT_PREVIEW_HOST??'0.0.0.0',()=>console.log('Synthetic component preview: http://localhost:4175/fixture and /mobile. No application authentication or database is exposed.'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
