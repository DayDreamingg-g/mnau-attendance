import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export const CS_GROUP_IDS=['g-1-4','g-2-4','g-3-4','g-3-5','g-4-4'] as const;
export const CS_COUNTS={'g-1-4':17,'g-2-4':0,'g-3-4':20,'g-3-5':21,'g-4-4':0} as const;
export const stableId=(prefix:string,value:string)=>prefix+'-'+createHash('sha256').update(value).digest('hex').slice(0,16);
export type CSCell={id:string;file:string;page:number;bbox:number[];sourceCell:string;raw:string;groups:string[];weekday:string;pairNumber:number;splitCell:boolean;splitPart:'upper'|'lower'|null;subject:string|null;teacher:string|null;teacherDisplayName:string|null;building:string|null;room:string|null;issues:string[]};
export type CSStudent={groupId:string;groupName:string;fullName:string;source:{file:string;actualFile:string;page:number;rawName:string;sha256:string}};
export function teacherKey(name:string){return name.normalize('NFKC').trim().toLocaleLowerCase('uk').replace(/^(?:доц\.|проф\.|ст\.?\s?в\.?|ас\.?|в\.)\s*/,'').replace(/[\s.ʼ’'`-]/g,'').replace('пархоменкоаю','пархоменкоою').replace('богатенковаоє','богатєнковаоє');}
const letters:Record<string,string>={а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ye',ж:'zh',з:'z',и:'y',і:'i',ї:'yi',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ь:'',ю:'yu',я:'ya'};
export function teacherEmail(name:string){
  const clean=name.toLocaleLowerCase('uk').replace(/^(?:доц\.|проф\.|ст\.?\s?в\.?|ас\.?|в\.)\s*/,'').trim();
  const [surname,...initials]=clean.split(/\s+/);
  const latin=(s:string)=>[...s].map((c,i)=>(i>0?({є:'ie',ї:'i',й:'i',ю:'iu',я:'ia'} as Record<string,string>)[c]:undefined)??letters[c]??(/[a-z0-9]/.test(c)?c:'')).join('');
  return latin(surname)+(initials.length?'.'+[...initials.join('')].map(c=>letters[c]??'').join(''):'')+'@test.com';
}
export async function readCSData(){
  const cells=JSON.parse(await readFile('source-data/cs-beta/schedule-cells.json','utf8')) as CSCell[];
  const students=JSON.parse(await readFile('source-data/cs-beta/students.json','utf8')) as CSStudent[];
  for(const [id,count] of Object.entries(CS_COUNTS))if(students.filter(s=>s.groupId===id).length!==count)throw new Error('Invalid source roster count: '+id);
  if(students.length!==58)throw new Error('Expected exactly 58 source students.');
  return {cells,students};
}
