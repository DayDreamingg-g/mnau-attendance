import type {Prisma} from '@/generated/prisma/client';
/** Deleted messages are opt-in even when another inbox filter is applied. */
export function feedbackVisibility(showDeleted=false):Prisma.FeedbackWhereInput{
  return showDeleted?{}:{deletedAt:null};
}
export const feedbackStates={NEW:'Новий',IN_PROGRESS:'У роботі',RESOLVED:'Вирішено'};
