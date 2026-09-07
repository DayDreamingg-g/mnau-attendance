import {filterLink, type Filters, type SortKey, type SortOrder} from './filters';

export type SortValue = string | number | Date | null | undefined;
const ukrainian = new Intl.Collator('uk-UA', {sensitivity:'base', numeric:true});

/** Missing values stay last in either direction. Dates and numbers never sort as text. */
export function compareValues(first:SortValue, second:SortValue, order:SortOrder='asc') {
  const a=first instanceof Date ? first.getTime() : first;
  const b=second instanceof Date ? second.getTime() : second;
  const missingA=a==null || (typeof a==='number' && Number.isNaN(a));
  const missingB=b==null || (typeof b==='number' && Number.isNaN(b));
  if(missingA || missingB) return missingA===missingB ? 0 : missingA ? 1 : -1;
  const result=typeof a==='number' && typeof b==='number' ? a-b : ukrainian.compare(String(a),String(b));
  return order==='desc' ? -result : result;
}

export function sortRows<T>(rows:readonly T[], filters:Pick<Filters,'sort'|'order'>, selectors:Partial<Record<SortKey,(row:T)=>SortValue>>) {
  const select=filters.sort ? selectors[filters.sort] : undefined;
  if(!select) return [...rows];
  // Original position resolves ties and preserves the source order without mutating fetched data.
  return rows.map((row,index)=>({row,index})).sort((a,b)=>compareValues(select(a.row),select(b.row),filters.order??'asc') || a.index-b.index).map(item=>item.row);
}

export function defaultSortOrder(key:SortKey):SortOrder {
  return ['present','n','hv','unmarked','pending','percentage'].includes(key) || /_(students|groups|lessons|percentage|date|updated)$/.test(key) ? 'desc' : 'asc';
}

export function sortLink(path:string, filters:Filters, key:SortKey) {
  const order=filters.sort===key ? (filters.order==='desc' ? 'asc' : 'desc') : defaultSortOrder(key);
  return filterLink(path,filters,{sort:key,order});
}
