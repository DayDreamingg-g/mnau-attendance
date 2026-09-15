import sourceGroups from '../../source-data/groups.json';
import type {Prisma} from '../generated/prisma/client';

export const CS_SPECIALTY_NAME="Комп'ютерні науки";
export const CS_GROUP_COUNTS:Record<string,number>={'КН 1/1':17,'КН 2/1':30,'КН 3/1':20,'КН 3/2':21,'КН 4/1':40};
export const csName=(name:string)=>name.normalize('NFKC').replace(/[’ʼ`]/g,"'").replace(/\s+/g,' ').trim().toLocaleUpperCase('uk');
export const isCSSpecialty=(name:string)=>csName(name)===csName(CS_SPECIALTY_NAME);
// Source identifiers are read from the supplied group inventory, never embedded in scopes.
export const CS_SOURCE_GROUPS=sourceGroups.filter(g=>Object.hasOwn(CS_GROUP_COUNTS,csName(g.name)));
export async function resolveCSGroups(tx:Prisma.TransactionClient){
  const groups=(await tx.group.findMany({include:{specialty:true},orderBy:[{course:'asc'},{name:'asc'}]})).filter(g=>Object.hasOwn(CS_GROUP_COUNTS,csName(g.name)));
  if(groups.length!==5||new Set(groups.map(g=>csName(g.name))).size!==5)throw new Error('Expected exactly five distinct CS groups.');
  return groups;
}
export async function canonicalizeCS(tx:Prisma.TransactionClient){
  const groups=await resolveCSGroups(tx);
  const specialties=(await tx.specialty.findMany({orderBy:{id:'asc'}})).filter(s=>isCSSpecialty(s.name));
  if(!specialties.length||new Set(specialties.map(s=>s.facultyId)).size!==1)throw new Error('Ambiguous CS faculty; merge blocked.');
  const primary=specialties.find(s=>s.id===groups[0].specialtyId)??specialties[0];
  const duplicates=specialties.filter(s=>s.id!==primary.id);
  if(duplicates.length){
    const snapshot=JSON.parse(JSON.stringify(specialties)) as Prisma.InputJsonValue;
    await tx.specialty.update({where:{id:primary.id},data:{name:CS_SPECIALTY_NAME,source:{canonical:primary.source,merged:snapshot}}});
    await tx.group.updateMany({where:{specialtyId:{in:duplicates.map(s=>s.id)}},data:{specialtyId:primary.id}});
    for(const duplicate of duplicates){
      await tx.systemState.upsert({where:{id:'specialty-alias:'+duplicate.id},create:{id:'specialty-alias:'+duplicate.id,value:{canonicalId:primary.id}},update:{value:{canonicalId:primary.id}}});
      await tx.specialty.delete({where:{id:duplicate.id}});
    }
    await tx.auditLog.create({data:{objectType:'Specialty',objectId:primary.id,source:'CS_BETA_REPAIR',reason:'Єдина спеціальність для всіх курсів; вихідні записи збережено.',details:{merged:snapshot}}});
  }
  for(const group of groups)if(group.specialtyId!==primary.id||group.name!==csName(group.name))await tx.group.update({where:{id:group.id},data:{specialtyId:primary.id,name:csName(group.name),course:Number(csName(group.name).match(/(\d)\//)![1])}});
  if(await tx.group.count({where:{specialtyId:primary.id}})!==5)throw new Error('Canonical CS specialty must contain exactly five groups.');
  return {specialtyId:primary.id,groups};
}
