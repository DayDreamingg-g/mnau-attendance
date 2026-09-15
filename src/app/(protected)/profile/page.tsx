import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {requireUser,COOKIE,hashToken} from '@/lib/auth';
import {db} from '@/lib/db';
import {dateLabel,timeLabel} from '@/lib/time';
import {PageTitle,Panel} from '@/components/ui';
import {ProfileForm,SessionActions} from '@/components/profile-form';
export default async function Profile(){const u=await requireUser();if(!u.roles.some(r=>['TEACHER','CURATOR','DEAN_OFFICE','ADMIN','DEVELOPER'].includes(r.roleId)))notFound();const hash=hashToken((await cookies()).get(COOKIE)?.value??'');const sessions=await db.session.findMany({where:{userId:u.id,expiresAt:{gt:new Date()}},orderBy:{lastSeenAt:'desc'},take:100});return <><PageTitle title="Мій профіль" description={u.email}/><Panel title="Особисті дані та пароль"><ProfileForm name={u.name} position={u.position}/></Panel><div className="section-space"><Panel title="Сеанси"><SessionActions sessions={sessions.map(s=>({id:s.id,device:s.device,lastSeen:dateLabel(s.lastSeenAt)+' '+timeLabel(s.lastSeenAt),current:s.tokenHash===hash}))}/></Panel></div></>;}
