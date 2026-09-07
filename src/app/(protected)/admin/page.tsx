import {notFound} from 'next/navigation';
import {requireUser,hasRole} from '@/lib/auth';
import {db} from '@/lib/db';
import {PageTitle,Panel} from '@/components/ui';
import {AdminForm} from '@/components/admin-form';

const roleLabels:Record<string,string>={ADMIN:'Адміністратор',DEAN_OFFICE:'Деканат',CURATOR:'Куратор',TEACHER:'Викладач',STAROSTA:'Староста'};
export default async function Admin(){
  const u=await requireUser();
  if(!hasRole(u,'ADMIN'))notFound();
  const users=await db.user.findMany({select:{
    id:true,name:true,email:true,roles:{select:{roleId:true}},
    teacher:{select:{id:true,displayName:true}},
    student:{select:{id:true,fullName:true,group:{select:{name:true}}}},
    curatorAssignments:{include:{group:{select:{name:true}}}},
    deanAssignments:{include:{faculty:{select:{name:true}}}},
  },orderBy:{email:'asc'}});
  const [groups,faculties,teachers,students]=await Promise.all([
    db.group.findMany({select:{id:true,name:true},orderBy:{name:'asc'}}),
    db.faculty.findMany({select:{id:true,name:true},orderBy:{name:'asc'}}),
    db.teacher.findMany({select:{id:true,displayName:true,userId:true},orderBy:{displayName:'asc'}}),
    db.student.findMany({select:{id:true,fullName:true,userId:true,group:{select:{name:true}}},orderBy:{fullName:'asc'}}),
  ]);
  return <>
    <PageTitle eyebrow="АДМІНІСТРУВАННЯ" title="Ролі та призначення" description="Один обліковий запис може поєднувати кілька ролей."/>
    <Panel title="Змінити призначення"><AdminForm actorId={u.id} users={users.map(x=>({
      id:x.id,name:x.email,roles:x.roles.map(r=>r.roleId),teacherId:x.teacher?.id??null,studentId:x.student?.id??null,
      curatorGroupIds:x.curatorAssignments.map(a=>a.groupId),deanFacultyIds:x.deanAssignments.map(a=>a.facultyId),
    }))} groups={groups} faculties={faculties} teachers={teachers.map(x=>({id:x.id,name:x.displayName,userId:x.userId}))} students={students.map(x=>({id:x.id,name:`${x.fullName} · ${x.group.name}`,userId:x.userId}))}/></Panel>
    <div className="section-space"><Panel title="Облікові записи"><div className="table-scroll"><table>
      <thead><tr><th>Користувач</th><th>Ролі</th><th>Пов’язані профілі</th><th>Область доступу</th></tr></thead>
      <tbody>{users.map(x=>{
        const has=(role:string)=>x.roles.some(r=>r.roleId===role);
        const scopes=has('ADMIN')?['Уся система']: [
          ...(has('CURATOR')?x.curatorAssignments.map(a=>`Куратор: ${a.group.name}`):[]),
          ...(has('DEAN_OFFICE')?x.deanAssignments.map(a=>`Деканат: ${a.faculty.name}`):[]),
          ...(has('TEACHER')&&x.teacher?[`Заняття викладача: ${x.teacher.displayName}`]:[]),
          ...(has('STAROSTA')&&x.student?[`Староста: ${x.student.group.name}`]:[]),
        ];
        return <tr key={x.id}>
          <td>{x.name}<span className="table-secondary">{x.email}</span></td>
          <td>{x.roles.map(r=>roleLabels[r.roleId]).join(', ')||'Не призначено'}</td>
          <td>{x.teacher&&<span className="table-secondary">Викладач: {x.teacher.displayName}</span>}{x.student&&<span className="table-secondary">Студент: {x.student.fullName} · {x.student.group.name}</span>}{!x.teacher&&!x.student&&'Не пов’язані'}</td>
          <td>{scopes.map(scope=><span className="table-secondary" key={scope}>{scope}</span>)}{!scopes.length&&'Немає активної області доступу'}</td>
        </tr>;
      })}</tbody>
    </table></div></Panel></div>
  </>;
}
