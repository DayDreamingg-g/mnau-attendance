export class HttpError extends Error { constructor(public status:number,message:string,public retryAfter?:number){super(message);} }
export function apiError(error:unknown) {
  if(error instanceof HttpError)return Response.json({error:error.message},{status:error.status,headers:error.status===429?{'Retry-After':String(error.retryAfter??60)}:undefined});
  const errorId=crypto.randomUUID();
  console.error(JSON.stringify({event:'request_failed',errorId,type:error instanceof Error?error.name:'UnknownError',code:typeof error==='object'&&error&&'code' in error?String(error.code).slice(0,40):undefined}));
  return Response.json({error:'Не вдалося виконати запит. Спробуйте ще раз. Код: '+errorId,errorId},{status:503});
}
