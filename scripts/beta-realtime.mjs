import {readFile,writeFile} from 'node:fs/promises';
// Preserve every secret and deployment setting; remove only the development clock override.
const files=[];
for(const path of ['.env','.env.compose']){
  let text;
  try{text=await readFile(path,'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}
  if(!/^APP_ENV=demo\s*$/m.test(text)||!/^DEMO_MODE=true\s*$/m.test(text))throw new Error(path+': realtime beta setup requires APP_ENV=demo and DEMO_MODE=true. No files changed.');
  files.push({path,text:/^DEMO_DATE=.*$/m.test(text)?text.replace(/^DEMO_DATE=.*$/m,'DEMO_DATE='):text+'\nDEMO_DATE=\n'});
}
if(!files.length)throw new Error('Run setup:env first.');
for(const file of files)await writeFile(file.path,file.text);
console.log('Beta uses real Europe/Kyiv time. Restart web to load the updated environment. Other configuration was preserved.');
