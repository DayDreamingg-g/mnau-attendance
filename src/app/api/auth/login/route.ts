import { cookies } from 'next/headers';
import { z } from 'zod';
import { COOKIE,checkOrigin,cookieOptions,login,loginSource,principalFromToken,homeFor } from '@/lib/auth';
import { apiError,HttpError } from '@/lib/errors';
const schema=z.object({
  email:z.string().trim().toLowerCase().pipe(z.email().max(200)),
  password:z.string().min(1).max(128),
});

export async function POST(request:Request){
  const contentType=request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const formSubmit=contentType==='application/x-www-form-urlencoded'||contentType==='multipart/form-data';
  try{
    checkOrigin(request);
    let body:unknown;
    try{
      if(formSubmit){
        const form=await request.formData();
        if(form.getAll('email').length!==1||form.getAll('password').length!==1){
          throw new HttpError(400,'Перевірте електронну пошту та пароль.');
        }
        body={email:form.get('email'),password:form.get('password')};
      }else if(contentType==='application/json'){
        body=await request.json();
      }else{
        throw new HttpError(415,'Непідтримуваний формат запиту.');
      }
    }catch(error){
      if(error instanceof HttpError)throw error;
      throw new HttpError(400,'Перевірте електронну пошту та пароль.');
    }
    const parsed=schema.safeParse(body);
    if(!parsed.success)throw new HttpError(400,'Перевірте електронну пошту та пароль.');
    const options=cookieOptions();
    const token=await login(parsed.data.email,parsed.data.password,loginSource(request),request.headers.get('user-agent')??'');
    (await cookies()).set(COOKIE,token,options);
    const destination=homeFor((await principalFromToken(token))!);
    return formSubmit
      ?new Response(null,{status:303,headers:{Location:destination}})
      :Response.json({ok:true,destination});
  }catch(error){
    if(!formSubmit)return apiError(error);
    const status=error instanceof HttpError?error.status:503;
    const code=status===401?'invalid':status===429?'rate':status===403?'origin':status===400?'validation':'unavailable';
    if(!(error instanceof HttpError))console.error('Login form failed',error instanceof Error?error.name:'UnknownError');
    return new Response(null,{status:303,headers:{Location:`/login?error=${code}`,...(status===429?{'Retry-After':String(error instanceof HttpError?error.retryAfter??60:60)}:{})}});
  }
}
