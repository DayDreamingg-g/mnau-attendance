// Next 16.3.4 bundles compression with asymmetric drain event forwarding.
// res.once('drain', fn) registers on Gzip but removes itself from res.
// Keep on/once/off/removeListener symmetric, including pre-header listeners.
// Fail closed on dependency changes; remove this patch once upstream fixes it.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const file=require.resolve('next/dist/compiled/compression');
const source=await readFile(file,'utf8');
const marker='/* mnau-compression-drain-lifecycle */';
if(!source.includes(marker)){
 const version=JSON.parse(await readFile(require.resolve('next/package.json'),'utf8')).version;
 if(version!=='16.3.4'||createHash('sha256').update(source).digest('hex')!=='8e7c2ec6982978c754c00388e0d1d3ff46d7aae99945d060f6f1052954c24e29')throw new Error('Review the Next compression lifecycle patch for this dependency version.');
 const before='o.on=function on(a,e)';
 const fix=marker+'var originalRemoveListener=o.removeListener;o.removeListener=o.off=function removeListener(a,e){if(a==="drain"&&d){if(x){x.removeListener(a,e)}else{d=d.filter(function(entry){return entry[1]!==e&&entry[1].listener!==e})}}originalRemoveListener.call(this,a,e);return this};f.call(o,"close",function(){if(x){x.removeAllListeners("drain");if(!x.destroyed)x.destroy()}if(d)d=[]});';
 await writeFile(file,source.replace(before,fix+before));
 console.log('Applied Next compression drain lifecycle fix.');
}
