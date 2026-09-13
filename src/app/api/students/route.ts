import {checkOrigin,requireApi} from '@/lib/auth';
import {changeStudent} from '@/lib/students';
import {apiError} from '@/lib/errors';
export async function POST(request:Request){try{checkOrigin(request);return Response.json(await changeStudent(await requireApi(),await request.json()));}catch(error){return apiError(error);}}
