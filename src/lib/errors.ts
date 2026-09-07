export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export function apiError(error:unknown) {
  if(error instanceof HttpError)return Response.json({error:error.message},{status:error.status});
  console.error('Request failed',error instanceof Error?error.name:'UnknownError');
  return Response.json({error:'Не вдалося виконати запит. Спробуйте ще раз.'},{status:503});
}
