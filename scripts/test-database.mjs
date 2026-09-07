// Development verification only. PGlite is PostgreSQL compiled to WASM, not the Docker PostgreSQL service.
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {mkdir} from 'node:fs/promises';
await mkdir('runtime',{recursive:true});
const db=await PGlite.create('runtime/pglite');
const server=new PGLiteSocketServer({db,host:'127.0.0.1',port:5543,maxConnections:16});
await server.start();
console.log('Test-only PostgreSQL WASM server listening on 127.0.0.1:5543. Docker deployment remains unverified.');
process.on('SIGINT',async()=>{await server.stop();await db.close();process.exit(0);});
