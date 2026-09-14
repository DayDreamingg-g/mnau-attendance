import {expandCSCalendar,verifyCSSource} from '../src/lib/cs-schedule';
const {cells}=await verifyCSSource();
const lessons=expandCSCalendar(cells);
console.log('Verified PDF checksums, five nonempty CS calendars and unique group/date/pair slots: '+lessons.length+' semester lessons.');
