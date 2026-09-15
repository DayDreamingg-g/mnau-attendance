import {expandCSCalendar,verifyCSSource} from '../src/lib/cs-schedule';
const {cells}=await verifyCSSource();
const lessons=expandCSCalendar(cells,'2026-09-01','2026-12-31');
console.log('Verified PDF checksums and unique group/date/pair slots: '+lessons.length+' schedule occurrences within the confirmed term 2026-09-01 through 2026-12-31. Holidays and cancellations require separate confirmed calendar data.');
