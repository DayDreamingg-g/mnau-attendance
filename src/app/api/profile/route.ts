import {readJson} from '@/lib/request-body';
import {cookies} from 'next/headers';
import {COOKIE,hashToken,requireApi,checkOrigin} from '@/lib/auth';
import {changeProfile} from '@/lib/profile';
import {apiError} from '@/lib/errors';
export async function POST(request:Request){try{checkOrigin(request);const user=await requireApi(true);return Response.json(await changeProfile(user,await readJson(request),hashToken((await cookies()).get(COOKIE)?.value??'')));}catch(e){return apiError(e);}}
