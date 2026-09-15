import {teacherIdentity} from '@/lib/teacher-identity';
import {SelfRoles} from '@/components/self-roles';
import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {requireUser,COOKIE,hashToken} from '@/lib/auth';
import {db} from '@/lib/db';
import {dateLabel,timeLabel} from '@/lib/time';
import {PageTitle,Panel} from '@/components/ui';
import {ProfileForm,SessionActions} from '@/components/profile-form';
export default async function Profile(){const u=await requireUser();const identity=teacherIdentity(u.name,u.position);if(!u.roles.some(r=>['TEACHER','CURATOR','DEAN_OFFICE','ADMIN','DEVELOPER'].includes(r.roleId)))notFound();const hash=hashToken((await cookies()).get(COOKIE)?.value??'');const sessions=await db.session.findMany({where:{userId:u.id,expiresAt:{gt:new Date()}},orderBy:{lastSeenAt:'desc'},take:100});return <><PageTitle title="Мій профіль" description={u.email}/><Panel title="Особисті дані"><ProfileForm key={identity.name+identity.position} name={identity.name} position={identity.position} personalOnly/></Panel><Panel title="Безпека"><ProfileForm passwordOnly/></Panel><div className="section-space"><Panel title="Сеанси"><SessionActions sessions={sessions.map(s=>({id:s.id,device:s.device,lastSeen:dateLabel(s.lastSeenAt)+' '+timeLabel(s.lastSeenAt),current:s.tokenHash===hash}))}/></Panel></div>{u.roles.some(r=>r.roleId==='DEVELOPER')&&<Panel title="Додатково"><div className="pad"><SelfRoles roles={u.roles.map(r=>r.roleId)}/></div></Panel>}</>;}
