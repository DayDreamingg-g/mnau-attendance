import {termScope} from '@/lib/terms';
import {betaCalendarScope} from '@/lib/beta-calendar';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {DateTime} from 'luxon';
import {requireUser,hasRole} from '@/lib/auth';
import {db} from '@/lib/db';
import {lessonScope,groupScope} from '@/lib/access';
import {atKyiv,today,ZONE} from '@/lib/time';
import {PageTitle} from '@/components/ui';
import {LessonList} from '@/components/lesson-list';
import type {Search} from '@/lib/filters';
export default async function Teacher({searchParams}:{searchParams:Promise<Search>}){const u=await requireUser();if(!hasRole(u,'TEACHER')||!u.teacher)notFound();const p=await searchParams;const date=typeof p.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&DateTime.fromISO(p.date).isValid?p.date:today();const q=typeof p.q==='string'?p.q.slice(0,100):'';const past=p.past==='1';const lessons=await db.lesson.findMany({where:{AND:[await betaCalendarScope(),await termScope(u,typeof p.term==='string'?p.term:undefined),lessonScope(u),{teacherId:u.teacher.id,cancelled:false,startAt:past?{lt:atKyiv(date,'00:00:00')}:{gte:atKyiv(date,'00:00:00'),lte:atKyiv(date,'23:59:59')},OR:q?[{subject:{name:{contains:q,mode:'insensitive'}}},{groups:{some:{group:{name:{contains:q,mode:'insensitive'}}}}}]:undefined}]},include:{teacher:true,subject:true,building:true,groups:{where:{group:groupScope(u)},include:{group:true}},attendance:{where:{roster:{group:groupScope(u)}}},_count:{select:{roster:{where:{group:groupScope(u)}}}}},orderBy:{startAt:past?'desc':'asc'},take:300});return <><PageTitle eyebrow="ЕЛЕКТРОННИЙ ЖУРНАЛ" title="Мої заняття" description="Відкрийте пару, збережіть відмітки."/><form className="filters">{typeof p.term==='string'&&<input type="hidden" name="term" value={p.term}/>}<label>Дата<input type="date" name="date" defaultValue={date}/></label><label className="filter-wide">Група або дисципліна<input name="q" defaultValue={q} placeholder="Пошук занять…"/></label><button className="button primary">Знайти</button><Link className="button" href="/teacher">Сьогодні</Link><Link className="button" href={`/teacher?date=${date}&past=1${typeof p.term==='string'?'&term='+encodeURIComponent(p.term):''}`}>Минулі заняття</Link></form><p className="muted small section-space">{DateTime.fromISO(date,{zone:ZONE}).setLocale('uk').toFormat('cccc, dd LLLL yyyy')} · {lessons.length} занять{past?' до обраної дати':''}</p><LessonList lessons={lessons}/></>;}
