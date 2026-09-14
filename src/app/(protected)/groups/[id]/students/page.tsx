import {betaUIScope} from '@/lib/beta-ui';
import {notFound} from 'next/navigation';
import {db} from '@/lib/db';
import {requireUser,isManager} from '@/lib/auth';
import {canCorrectGroup,canManageStudents,groupScope} from '@/lib/access';
import {PageTitle,Panel,Breadcrumbs} from '@/components/ui';
import {StudentManager} from '@/components/student-manager';
export default async function ManageStudents({params}:{params:Promise<{id:string}>}){
  const user=await requireUser(),{id}=await params;
  const group=await db.group.findFirst({where:{AND:[{id},groupScope(user)]},include:{specialty:true}});
  if(!group||!canManageStudents(user,group))notFound();
  const students=await db.student.findMany({where:{groupId:id},select:{id:true,fullName:true,phone:true,active:true,isSynthetic:true,userId:true,source:true},orderBy:[{active:'desc'},{fullName:'asc'}]});
  const groups=await db.group.findMany({where:betaUIScope(user),include:{specialty:true},orderBy:[{course:'asc'},{name:'asc'}]});
  return <><Breadcrumbs items={[{label:group.name,href:'/groups/'+id},{label:'Керування студентами'}]}/><PageTitle eyebrow="СКЛАД ГРУПИ" title={group.name+' · Студенти'} description="Архівування і переведення зберігають минулу відвідуваність. Нові студенти потрапляють до поточних і майбутніх занять."/><Panel><StudentManager groupId={id} groupName={group.name} canDelete={isManager(user)} students={students.map(({source,...s})=>({...s,sourceType:(source as {type?:string}|null)?.type}))} transferGroups={canCorrectGroup(user,group)?groups.filter(g=>g.id!==id&&canCorrectGroup(user,g)).map(g=>({id:g.id,name:g.name})):[]} canCreateAccount={canCorrectGroup(user,group)}/></Panel></>;
}
