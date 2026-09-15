import {termScope} from '@/lib/terms';
import {betaCalendarScope} from '@/lib/beta-calendar';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUser,starostaGroups} from '@/lib/auth';
import {lessonScope} from '@/lib/access';
import {db} from '@/lib/db';
import {parseFilters,range,type Search} from '@/lib/filters';
import {PageTitle,Empty} from '@/components/ui';
import {LessonList} from '@/components/lesson-list';
export default async function Starosta({searchParams}:{searchParams:Promise<Search>}){
  const u=await requireUser(),ids=starostaGroups(u);if(!ids.length)notFound();
  const p=await searchParams,f=parseFilters(p),id=f.group??ids[0];if(!ids.includes(id))notFound();
  const group=await db.group.findUniqueOrThrow({where:{id}});
  const lessons=await db.lesson.findMany({where:{AND:[await betaCalendarScope(),await termScope(u,f.term),lessonScope(u),{starostaAllowed:true,groups:{some:{groupId:id}},startAt:range(f)}]},include:{teacher:true,subject:true,building:true,groups:{where:{groupId:id},include:{group:true}},attendance:{where:{roster:{groupId:id}}},_count:{select:{roster:{where:{groupId:id}}}}},orderBy:{startAt:'desc'}});
  const count=await db.student.count({where:{groupId:id,active:true}});
  return <><PageTitle eyebrow="ЖУРНАЛ СТАРОСТИ" title={group.name} description="Спільні відмітки з викладачем. Редагуйте свою групу після початку заняття до кінця поточного дня." action={<Link className="button primary" href={'/groups/'+id+'/students'}>+ Додати студента</Link>}/>
    {!count&&<Empty>У групі ще немає студентів.</Empty>}
    <Link className="text-link" href={'/groups/'+id+'/students'}>Керування складом групи →</Link>
    <form className="filters"><input type="hidden" name="group" value={id}/><label>Від<input name="from" type="date" defaultValue={f.from}/></label><label>До<input name="to" type="date" defaultValue={f.to}/></label><button className="button primary">Застосувати</button></form><LessonList lessons={lessons} filters={f}/></>;
}
