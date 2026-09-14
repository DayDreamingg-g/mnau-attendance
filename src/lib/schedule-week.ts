import {DateTime} from 'luxon';
import mapping from '../../source-data/cs-beta/week-mapping.json';
import {ZONE} from './time';
export const SCHEDULE_WEEK_BASE=mapping;
export function scheduleWeek(date:string):'NUMERATOR'|'DENOMINATOR'{
  const day=DateTime.fromISO(date,{zone:ZONE});
  const base=DateTime.fromISO(mapping.baseMonday,{zone:ZONE});
  if(!day.isValid||!base.isValid||mapping.baseWeekType!=='DENOMINATOR')throw new Error('Invalid schedule week mapping.');
  const weeks=Math.round(day.startOf('week').diff(base.startOf('week'),'days').days/7);
  return ((weeks%2)+2)%2===0?'DENOMINATOR':'NUMERATOR';
}
export const weekHalf=(date:string)=>scheduleWeek(date)==='DENOMINATOR'?'lower':'upper';
