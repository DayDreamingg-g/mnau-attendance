import {notFound} from 'next/navigation';
import {requireUser,hasRole} from '@/lib/auth';
import {db} from '@/lib/db';
import {lessonScope} from '@/lib/access';
import {parseFilters,range,type Search} from '@/lib/filters';
import {PageTitle} from '@/components/ui';
import {LessonList} from '@/components/lesson-list';
export default async function Starosta({searchParams}:{searchParams:Promise<Search>}){const u=await requireUser();if(!hasRole(u,'STAROSTA')||!u.student)notFound();const f=parseFilters(await searchParams);const group=await db.group.findUniqueOrThrow({where:{id:u.student.groupId}});const lessons=await db.lesson.findMany({where:{AND:[lessonScope(u),{starostaAllowed:true,groups:{some:{groupId:group.id}},startAt:range(f)}]},include:{subject:true,building:true,groups:{where:{groupId:group.id},include:{group:true}},attendance:{where:{student:{groupId:group.id}}},_count:{select:{roster:{where:{student:{groupId:group.id}}}}}},orderBy:{startAt:'desc'}});return <><PageTitle eyebrow="ЖУРНАЛ СТАРОСТИ" title={group.name} description="Підготуйте чернетку. Викладач підтвердить відмітки; підтверджені значення захищено від повторної зміни старостою."/><form className="filters"><label>Від<input name="from" type="date" defaultValue={f.from}/></label><label>До<input name="to" type="date" defaultValue={f.to}/></label><button className="button primary">Застосувати</button></form><LessonList lessons={lessons} filters={f}/></>;}
