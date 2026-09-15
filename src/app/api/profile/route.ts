import {readJson} from '@/lib/request-body';
import {cookies} from 'next/headers';
import {COOKIE,hashToken,requireApi,checkOrigin} from '@/lib/auth';
import {changeProfile} from '@/lib/profile';
import {apiError} from '@/lib/errors';
export async function POST(request:Request){try{checkOrigin(request);const user=await requireApi(true);const jar=await cookies();const result=await changeProfile(user,await readJson(request),hashToken(jar.get(COOKIE)?.value??''));if(result.destination==='/login')jar.delete(COOKIE);return Response.json(result);}catch(e){const response=apiError(e);if(response.status===401)(await cookies()).delete(COOKIE);return response;}}
