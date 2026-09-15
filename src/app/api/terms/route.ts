import {readJson} from '@/lib/request-body';
import {requireApi,checkOrigin} from '@/lib/auth';
import {changeTerm} from '@/lib/terms';
import {apiError} from '@/lib/errors';
export async function POST(request:Request){try{checkOrigin(request);return Response.json(await changeTerm(await requireApi(),await readJson(request)));}catch(e){return apiError(e);}}
