import {checkOrigin,requireApi} from '@/lib/auth';
import {createStudentAccount} from '@/lib/students';
import {apiError} from '@/lib/errors';
export async function POST(request:Request){try{checkOrigin(request);return Response.json(await createStudentAccount(await requireApi(),await request.json()),{headers:{'Cache-Control':'no-store'}});}catch(error){return apiError(error);}}
