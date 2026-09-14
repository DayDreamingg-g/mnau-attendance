import Link from 'next/link';
import {notFound} from 'next/navigation';
import {db} from '@/lib/db';
import {hasRole,requireUser} from '@/lib/auth';
import {groupScope} from '@/lib/access';
import {PageTitle,Panel,Empty} from '@/components/ui';
export default async function Curator({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const user=await requireUser();if(!hasRole(user,'CURATOR'))notFound();
  const p=await searchParams,selected=typeof p.course==='string'&&/^[1-4]$/.test(p.course)?Number(p.course):undefined;
  const groups=await db.group.findMany({where:groupScope(user),orderBy:[{course:'asc'},{name:'asc'}]});
  return <><PageTitle eyebrow="КАБІНЕТ КУРАТОРА" title="Оберіть курс і групу" description="Відвідуваність, незаповнені журнали та керування складом призначених груп."/><form className="filters"><label>Курс<select name="course" defaultValue={selected??''}><option value="">Усі курси</option>{[1,2,3,4].map(c=><option key={c} value={c}>{c} курс</option>)}</select></label><button className="button primary">Застосувати</button></form>{[1,2,3,4].filter(c=>!selected||c===selected).map(course=><div className="section-space" key={course}><Panel title={course+' курс'}><div className="pad topbar-actions">{groups.filter(g=>g.course===course).map(g=><Link className="button" key={g.id} href={'/groups/'+g.id+'?course='+course+'&group='+g.id}>{g.name.toUpperCase()} →</Link>)}</div></Panel></div>)}{!groups.length&&<Empty>Немає призначених груп.</Empty>}</>;
}
