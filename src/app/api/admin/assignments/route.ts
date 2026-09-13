import {checkOrigin,requireApi} from '@/lib/auth';
import {apiError} from '@/lib/errors';
import {adminChange} from '@/lib/admin';
export async function POST(request:Request){try{checkOrigin(request);return Response.json(await adminChange(await requireApi(),await request.json()),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
