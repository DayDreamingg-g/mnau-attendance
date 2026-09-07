import { DateTime } from 'luxon';
export const ZONE = 'Europe/Kyiv';
export function demoEnabled() {
  if (process.env.APP_ENV === 'production' && (process.env.DEMO_MODE === 'true' || process.env.DEMO_DATE)) throw new Error('Demo configuration is forbidden in production');
  return process.env.APP_ENV === 'demo' && process.env.DEMO_MODE === 'true';
}
export function effectiveNow() {
  if (demoEnabled() && process.env.DEMO_DATE) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(process.env.DEMO_DATE))throw new Error('Invalid DEMO_DATE');
    const date=DateTime.fromISO(`${process.env.DEMO_DATE}T21:00:00`, {zone:ZONE});
    if(!date.isValid) throw new Error('Invalid DEMO_DATE');
    return date;
  }
  return DateTime.now().setZone(ZONE);
}
/** Display the clock actually used for eligibility and correction windows. */
export function clockDescription(){
  const now=effectiveNow();
  const fixed=demoEnabled()&&Boolean(process.env.DEMO_DATE);
  return `${fixed?'Фіксований демо-час':'Реальний час'}: ${now.toFormat('yyyy-MM-dd · HH:mm')} · ${ZONE}`;
}
export function today() { return effectiveNow().toISODate()!; }
export function atKyiv(date:string, time:string) { const result=DateTime.fromISO(`${date}T${time}`,{zone:ZONE});if(!result.isValid)throw new Error('Invalid Kyiv date');return result.toJSDate(); }
export function dateLabel(value:Date) { return DateTime.fromJSDate(value).setZone(ZONE).setLocale('uk').toFormat('dd LLL yyyy'); }
export function timeLabel(value:Date) { return DateTime.fromJSDate(value).setZone(ZONE).toFormat('HH:mm'); }
export function dayOf(value:Date) { return DateTime.fromJSDate(value).setZone(ZONE).toISODate()!; }
