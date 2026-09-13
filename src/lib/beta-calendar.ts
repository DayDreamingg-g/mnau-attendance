import {db} from './db';
import {CS_GROUP_IDS} from './cs-beta-data';
import type {Prisma} from '../generated/prisma/client';
// Only superseded CS-only generated entries. Shared lessons of other specialties stay intact.
export const obsoleteCSCalendar:Prisma.LessonWhereInput={synthetic:true,OR:[{id:{startsWith:'demo-'}},{id:{startsWith:'schedule-'}}],groups:{some:{groupId:{in:[...CS_GROUP_IDS]}},every:{groupId:{in:[...CS_GROUP_IDS]}}}};
export async function betaCalendarScope(client:Prisma.TransactionClient=db):Promise<Prisma.LessonWhereInput>{
  return await client.systemState.findUnique({where:{id:'cs-beta'}})?{NOT:obsoleteCSCalendar}:{};
}
