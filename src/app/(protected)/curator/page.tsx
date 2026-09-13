import Link from 'next/link';
import {notFound} from 'next/navigation';
import {db} from '@/lib/db';
import {hasRole,requireUser} from '@/lib/auth';
import {PageTitle,Panel,Empty} from '@/components/ui';
export default async function Curator(){
  const user=await requireUser();if(!hasRole(user,'CURATOR'))notFound();
  const groups=await db.group.findMany({where:{id:{in:user.curatorAssignments.map(a=>a.groupId)}},orderBy:[{course:'asc'},{name:'asc'}]});
  return <><PageTitle eyebrow="КАБІНЕТ КУРАТОРА" title="Оберіть курс і групу" description="Відвідуваність, незаповнені журнали та керування складом призначених груп."/>{[1,2,3,4].map(course=><div className="section-space" key={course}><Panel title={course+' курс'}><div className="pad topbar-actions">{groups.filter(g=>g.course===course).map(g=><Link className="button" key={g.id} href={'/groups/'+g.id}>{g.name.toUpperCase()} →</Link>)}</div></Panel></div>)}{!groups.length&&<Empty>Немає призначених груп.</Empty>}</>;
}
