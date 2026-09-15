export type Counts = { PRESENT:number; N:number; HV:number; unmarked:number; pending:number };
export const emptyCounts = ():Counts => ({PRESENT:0,N:0,HV:0,unmarked:0,pending:0});
export function metrics(c:Counts) {
  const denominator=c.PRESENT+c.N;
  const marked=denominator+c.HV;
  const expected=marked+c.unmarked+c.pending;
  const percentage=denominator>0 ? c.PRESENT/denominator*100 : null;
  return {...c,marked,expected,percentage,actualPresence:marked>0?c.PRESENT/marked*100:null,completion:expected>0?marked/expected*100:null,below70:percentage!==null&&percentage<70,below50:percentage!==null&&percentage<50};
}
export function sumCounts(values:Counts[]):Counts {return values.reduce((a,b)=>({PRESENT:a.PRESENT+b.PRESENT,N:a.N+b.N,HV:a.HV+b.HV,unmarked:a.unmarked+b.unmarked,pending:a.pending+b.pending}),emptyCounts());}
export function percent(value:number|null) {return value===null?'Немає даних':`${value.toLocaleString('uk-UA',{maximumFractionDigits:1})}%`;}

// A student may have roster rows in several groups after a transfer.
export function studentTotals<T extends {id:string;groupName:string;stats:Counts}>(rows:T[]){
  const grouped=new Map<string,T[]>();
  for(const row of rows)grouped.set(row.id,[...(grouped.get(row.id)??[]),row]);
  return [...grouped.values()].map(values=>({...values[0],groupName:[...new Set(values.map(v=>v.groupName))].join(' → '),stats:metrics(sumCounts(values.map(v=>v.stats)))}));
}
