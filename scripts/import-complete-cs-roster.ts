import 'dotenv/config';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {db} from '../src/lib/db';
import {readCSData,stableId} from '../src/lib/cs-beta-data';
import {csName} from '../src/lib/cs-structure';
import {addCurrentRoster,refreshRosterState} from '../src/lib/students';
import {assertBetaDatabase,json,operationMode} from '../src/lib/beta-operations';

export async function importCompleteCSRoster(apply=false){
  const {students}=await readCSData(),hash=students[0].source.sha256,sourceId='roster-'+hash;
  const bytes=await readFile('source-data/cs-beta/'+students[0].source.actualFile);
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(9152026)::text`;
    const {database,groups}=await assertBetaDatabase(tx);
    for(const g of [...groups].sort((a,b)=>a.id.localeCompare(b.id)))await tx.$queryRaw`SELECT id FROM "Group" WHERE id=${g.id} FOR UPDATE`;
    const plan=[];
    const unexpected=await tx.student.count({where:{source:{path:['sha256'],equals:hash},sourceRows:{none:{sourceId}},importKey:{startsWith:'cs-roster-'}}});
    if(unexpected)throw new Error('This DOCX was already used by a legacy positional importer. Review source identities before applying the complete roster.');
    for(let index=0;index<students.length;index++){
      const row=students[index],group=groups.find(g=>csName(g.name)===csName(row.groupName))!;
      const linked=await tx.rosterSourceRow.findUnique({where:{sourceId_row:{sourceId,row:index+1}},include:{student:true}});
      const legacyKey=row.legacy?stableId('cs-roster',row.legacy.sha256+':'+row.legacy.index):null;
      const importKey=legacyKey??stableId('cs-official',hash+':'+row.groupId+':'+row.source.groupRow);
      const existing=linked?.student??await tx.student.findUnique({where:{importKey}});
      if(linked&&(linked.fullName!==row.fullName||linked.groupId!==group.id))throw new Error('Source correspondence changed at row '+(index+1));
      // Names are never identity. An independent manual namesake remains a separate person.
      // Missing legacy keys require review, rather than reattaching history by name.
      if(legacyKey&&!existing)throw new Error('Missing legacy identity '+legacyKey+' at source row '+(index+1)+'. Review the historical import before applying.');
      if(existing&&legacyKey&&existing.importKey!==legacyKey)throw new Error('Ambiguous legacy provenance at row '+(index+1));
      plan.push({row,index,groupId:group.id,importKey,existing,linked});
    }
    if(new Set(plan.map(p=>p.existing?.id??p.importKey)).size!==128)throw new Error('Two official source rows resolve to one identity; import blocked.');
    const before=await tx.student.count({where:{groupId:{in:groups.map(g=>g.id)},active:true}});
    const result={mode:apply?'apply':'dry-run',database,sourceId,sourceHash:hash,officialRows:128,legacyPreserved:plan.filter(p=>p.row.legacy).length,added:plan.filter(p=>!p.existing).length,linked:plan.filter(p=>p.linked).length,liveBefore:before,liveAfter:before+plan.filter(p=>!p.existing).length,ids:plan.map(p=>({row:p.index+1,studentId:p.existing?.id??p.importKey,legacy:!!p.row.legacy})),rosterRowsAdded:0};
    if(!apply)return result;
    await tx.sourceAsset.upsert({where:{id:sourceId},create:{id:sourceId,fileName:students[0].source.actualFile,mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',sha256:hash,content:bytes,groupIds:groups.map(g=>g.id)},update:{}});
    const changed:string[]=[];
    for(const p of plan){
      if(!p.existing){
        const created=await tx.student.create({data:{id:p.importKey,importKey:p.importKey,fullName:p.row.fullName,groupId:p.groupId,isSynthetic:false,joinedAt:new Date(),source:json({...p.row.source,type:'IMPORT'})}});
        changed.push(...await addCurrentRoster(tx,created,new Date()));
      }
      if(!p.linked)await tx.rosterSourceRow.create({data:{sourceId,row:p.index+1,groupId:p.groupId,fullName:p.row.fullName,studentId:p.existing?.id??p.importKey,provenance:json({source:p.row.source,legacy:p.row.legacy??null,importKey:p.importKey})}});
    }
    await refreshRosterState(tx,changed);
    result.rosterRowsAdded=changed.length;
    if(result.linked!==128){
      await tx.systemState.upsert({where:{id:'cs-complete-roster'},create:{id:'cs-complete-roster',value:json(result)},update:{value:json(result)}});
      await tx.auditLog.create({data:{objectType:'RosterImport',objectId:sourceId,source:'COMPLETE_CS_ROSTER',reason:'Офіційний список 128 рядків; попередні ID та історію збережено.',details:json(result)}});
    }
    return result;
  },{maxWait:30000,timeout:180000});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await importCompleteCSRoster(operationMode()),null,2));}catch(e){console.error(e instanceof Error?e.message:'Roster import failed');process.exitCode=1;}finally{await db.$disconnect();}}
