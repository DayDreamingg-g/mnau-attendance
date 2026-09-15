export function historyBatches<T extends {id:string;details:unknown;actorId?:string|null;lessonId?:string|null}>(rows:T[]){
 const batches=new Map<string,T[]>();
 for(const row of rows){const details=row.details as {requestId?:unknown}|null;const requestId=typeof details?.requestId==='string'?details.requestId:null;const key=requestId?`${row.actorId??''}:${row.lessonId??''}:${requestId}`:row.id;const batch=batches.get(key)??[];batch.push(row);batches.set(key,batch);}
 return [...batches.values()];
}
