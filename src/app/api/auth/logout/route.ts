import { checkOrigin,logout,requireApi } from '@/lib/auth';
import { apiError } from '@/lib/errors';
export async function POST(request:Request){try{checkOrigin(request);await requireApi(true);await logout();return Response.json({ok:true});}catch(e){return apiError(e);}}
