import {readJson} from '@/lib/request-body';
import {requireApi,checkOrigin} from '@/lib/auth';
import {adminRelease} from '@/lib/admin-release';
import {apiError} from '@/lib/errors';
export async function POST(request:Request){try{checkOrigin(request);return Response.json(await adminRelease(await requireApi(),await readJson(request)));}catch(e){return apiError(e);}}
