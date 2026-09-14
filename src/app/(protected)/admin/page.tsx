import {notFound} from 'next/navigation';
import {requireUser,isManager} from '@/lib/auth';
import {demoEnabled} from '@/lib/time';
import {db} from '@/lib/db';
import {PageTitle,Panel,Empty} from '@/components/ui';
import {AdminForm} from '@/components/admin-form';
import type {RoleCode} from '@/generated/prisma/client';
import {betaUIScope} from '@/lib/beta-ui';
import {BetaScopeSwitch} from '@/components/beta-scope-switch';
const roleLabels:Record<string,string>={ADMIN:'Адміністратор',DEVELOPER:'Розробник',STUDENT:'Студент',DEAN_OFFICE:'Деканат',CURATOR:'Куратор',TEACHER:'Викладач',STAROSTA:'Староста'};
export default async function Admin({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const u=await requireUser();if(!isManager(u))notFound();
  const p=await searchParams,q=typeof p.q==='string'?p.q.slice(0,100):'',role=typeof p.role==='string'&&Object.hasOwn(roleLabels,p.role)?p.role as RoleCode:undefined;
  const users=await db.user.findMany({where:{AND:[q?{OR:[{name:{contains:q,mode:'insensitive'}},{email:{contains:q,mode:'insensitive'}}]}:{},role?{roles:{some:{roleId:role}}}:{}]},select:{
    id:true,name:true,email:true,active:true,roles:{select:{roleId:true}},
    teacher:{select:{id:true,displayName:true}},student:{select:{id:true,fullName:true,group:{select:{name:true}}}},
    starostaAssignments:{include:{group:{select:{name:true}}}},curatorAssignments:{include:{group:{select:{name:true}}}},
    deanAssignments:{include:{faculty:{select:{name:true}}}},
  },orderBy:{email:'asc'}});
  const [groups,faculties,teachers,students]=await Promise.all([
    db.group.findMany({where:betaUIScope(u,p.scope==='faculty'),select:{id:true,name:true},orderBy:{name:'asc'}}),
    db.faculty.findMany({select:{id:true,name:true},orderBy:{name:'asc'}}),
    db.teacher.findMany({select:{id:true,displayName:true,userId:true},orderBy:{displayName:'asc'}}),
    db.student.findMany({where:{group:betaUIScope(u,p.scope==='faculty'),active:true},select:{id:true,fullName:true,userId:true},orderBy:{fullName:'asc'}}),
  ]);
  return <><PageTitle eyebrow="АДМІНІСТРУВАННЯ" title="Облікові записи" description="Пошук, стан, ролі, призначення та безпечне скидання пароля."/>
    <BetaScopeSwitch all={p.scope==='faculty'} path="/admin"/>
    <form className="filters">{p.scope==='faculty'&&<input type="hidden" name="scope" value="faculty"/>}<label>Ім’я або email<input name="q" defaultValue={q}/></label><label>Роль<select name="role" defaultValue={role??''}><option value="">Усі ролі</option>{Object.entries(roleLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><button className="button primary">Знайти</button></form>
    <Panel title="Керування"><AdminForm actorId={u.id} demo={demoEnabled()} users={users.map(x=>({
      id:x.id,name:x.name+' · '+x.email,roles:x.roles.map(r=>r.roleId),teacherId:x.teacher?.id??null,studentId:x.student?.id??null,
      starostaGroupIds:x.starostaAssignments.map(a=>a.groupId),curatorGroupIds:x.curatorAssignments.map(a=>a.groupId),deanFacultyIds:x.deanAssignments.map(a=>a.facultyId),
    }))} groups={groups} faculties={faculties} teachers={teachers.map(x=>({id:x.id,name:x.displayName,userId:x.userId}))} students={students.map(s=>({id:s.id,name:s.fullName,userId:s.userId}))}/></Panel>
    <div className="section-space"><Panel title="Облікові записи">{!users.length?<Empty>Користувачів не знайдено.</Empty>:<div className="table-scroll"><table>
      <thead><tr><th>Ім’я / email</th><th>Стан</th><th>Ролі</th><th>Призначення</th></tr></thead>
      <tbody>{users.map(x=><tr key={x.id}><td>{x.name}<span className="table-secondary">{x.email}</span></td><td>{x.active?'Активний':'Вимкнений'}</td><td>{x.roles.map(r=>roleLabels[r.roleId]).join(', ')||'Не призначено'}</td><td>
        {x.teacher&&<span className="table-secondary">Викладач: {x.teacher.displayName}</span>}
        {x.student&&<span className="table-secondary">Студент: {x.student.fullName}</span>}
        {x.starostaAssignments.map(a=><span className="table-secondary" key={'s'+a.groupId}>Староста: {a.group.name}</span>)}
        {x.curatorAssignments.map(a=><span className="table-secondary" key={'c'+a.groupId}>Куратор: {a.group.name}</span>)}
        {x.deanAssignments.map(a=><span className="table-secondary" key={a.facultyId}>Деканат: {a.faculty.name}</span>)}
      </td></tr>)}</tbody></table></div>}</Panel></div></>;
}
