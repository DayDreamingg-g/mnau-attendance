import {HttpError} from './errors';
export async function readJson(request:Request,limit=32000):Promise<unknown>{
 if(Number(request.headers.get('content-length')??0)>limit)throw new HttpError(413,'Запит завеликий.');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Порожній запит.');const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new HttpError(413,'Запит завеликий.');}chunks.push(value);}}finally{reader.releaseLock();}
 const data=new Uint8Array(size);let at=0;for(const chunk of chunks){data.set(chunk,at);at+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(data));}catch{throw new HttpError(400,'Некоректний JSON запиту.');}
}
