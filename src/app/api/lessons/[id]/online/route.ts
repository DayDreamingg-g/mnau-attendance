import {readJson} from '@/lib/request-body';
import {requireApi,checkOrigin} from '@/lib/auth';
import {apiError} from '@/lib/errors';
import {changeOnline} from '@/lib/lesson-online';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{checkOrigin(request);return Response.json(await changeOnline(await requireApi(),(await params).id,await readJson(request)));}catch(e){return apiError(e);}}
