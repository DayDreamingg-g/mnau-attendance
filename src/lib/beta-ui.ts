import {demoEnabled} from './time';
import {groupScope} from './access';
import {isManager,hasRole,type Principal} from './auth';
import {CS_GROUP_COUNTS} from './cs-structure';
import type {Prisma} from '../generated/prisma/client';
import {db} from './db';
import type {Filters} from './filters';
import {isCSSpecialty} from './cs-structure';
export function betaUIScope(user:Principal,all=false):Prisma.GroupWhereInput{
  const beta=demoEnabled()&&(isManager(user)||hasRole(user,'DEAN_OFFICE'))&&!all;
  return {AND:[groupScope(user),...(beta?[{name:{in:Object.keys(CS_GROUP_COUNTS),mode:'insensitive' as const}}]:[])]};
}
export async function betaFilters(user:Principal,f:Filters,client:Prisma.TransactionClient=db){
  if(demoEnabled()&&(isManager(user)||hasRole(user,'DEAN_OFFICE'))&&f.scope!=='faculty'&&!f.specialty&&!f.group){
    const facultyId=f.faculty??(f.term?(await client.academicTerm.findUnique({where:{id:f.term},select:{facultyId:true}}))?.facultyId:undefined);
    const specialty=(await client.specialty.findMany({where:{facultyId,groups:{some:groupScope(user)}}})).find(s=>isCSSpecialty(s.name));
    if(specialty)return {...f,specialty:specialty.id};
  }
  return f;
}
