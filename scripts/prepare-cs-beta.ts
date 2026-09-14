import 'dotenv/config';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import {db} from '../src/lib/db';
import {demoEnabled,effectiveNow} from '../src/lib/time';
import {CS_GROUP_IDS,readCSData,stableId,teacherKey,teacherEmail} from '../src/lib/cs-beta-data';
import {addCurrentRoster,refreshRosterState} from '../src/lib/students';
import type {Prisma,RoleCode} from '../src/generated/prisma/client';

const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function prepareCSBeta(){
  if(!demoEnabled()||process.env.APP_ENV==='production')throw new Error('DESTRUCTIVE beta preparation requires APP_ENV=demo and DEMO_MODE=true; production is locked.');

  const database=await db.$queryRaw<{name:string}[]>`SELECT current_database() AS name`;
  const currentDatabase=database[0]?.name;
  const expectedDatabase=process.env.BETA_DATABASE_NAME?.trim()||'mnau_attendance';

  if(currentDatabase!==expectedDatabase)throw new Error(`Wrong database; beta preparation blocked. Expected "${expectedDatabase}", got "${currentDatabase??'unknown'}".`);

  const {cells,students}=await readCSData();
  const weekMapping=JSON.parse(await readFile('source-data/cs-beta/week-mapping.json','utf8'));
  const now=effectiveNow().toJSDate(),passwordHash=await bcrypt.hash('Test1234!',12);

  const result=await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(9132026)::text`;

    for(const id of [...CS_GROUP_IDS].sort())await tx.$queryRaw`SELECT "id" FROM "Group" WHERE "id"=${id} FOR UPDATE`;

    const groups=await tx.group.findMany({where:{id:{in:[...CS_GROUP_IDS]}}});

    if(groups.length!==5)throw new Error('Run db:seed first. Five existing CS groups are required.');

    for(const role of ['TEACHER','STAROSTA','CURATOR','DEVELOPER','STUDENT'] as const)await tx.role.upsert({
      where:{id:role},
      create:{id:role,label:role},
      update:{},
    });

    const prepared=await tx.systemState.findUnique({where:{id:'cs-beta'}});

    const synthetic=await tx.student.findMany({
      where:{
        groupId:{in:[...CS_GROUP_IDS]},
        isSynthetic:true,
      },
      select:{
        id:true,
        userId:true,
        groupId:true,
      },
    });

    const ids=synthetic.map(s=>s.id);
    const accounts=synthetic.flatMap(s=>s.userId?[s.userId]:[]);

    const affected=await tx.lessonStudent.findMany({
      where:{studentId:{in:ids}},
      select:{lessonId:true},
    });

    await tx.attendance.deleteMany({
      where:{studentId:{in:ids}},
    });

    await tx.lessonStudent.deleteMany({
      where:{studentId:{in:ids}},
    });

    await tx.starostaAssignment.deleteMany({
      where:{
        userId:{in:accounts},
        groupId:{in:[...CS_GROUP_IDS]},
      },
    });

    await tx.student.deleteMany({
      where:{
        id:{in:ids},
        isSynthetic:true,
      },
    });

    for(const userId of accounts){
      const account=await tx.user.findUnique({
        where:{id:userId},
        include:{
          roles:true,
          teacher:true,
          curatorAssignments:true,
          deanAssignments:true,
          starostaAssignments:true,
        },
      });

      if(!account)continue;

      if(
        account.teacher||
        account.curatorAssignments.length||
        account.deanAssignments.length||
        account.starostaAssignments.length||
        account.roles.some(r=>!['STAROSTA','STUDENT'].includes(r.roleId))
      )continue;

      await tx.session.deleteMany({where:{userId}});
      await tx.journalSubmission.deleteMany({where:{userId}});
      await tx.auditLog.updateMany({where:{actorId:userId},data:{actorId:null}});
      await tx.report.updateMany({where:{createdById:userId},data:{createdById:null}});
      await tx.userRole.deleteMany({where:{userId}});
      await tx.user.delete({where:{id:userId}});
    }

    // A repeat run keeps manually added/transferred/archived real students and their history.
    let imported=0;

    for(let index=0;index<students.length;index++){
      const student=students[index];
      const importKey=stableId('cs-roster',student.source.sha256+':'+index);

      if(await tx.student.findUnique({where:{importKey}}))continue;

      await tx.student.create({
        data:{
          id:importKey,
          importKey,
          fullName:student.fullName,
          groupId:student.groupId,
          isSynthetic:false,
          active:true,
          joinedAt:now,
          source:json({
            ...student.source,
            importedAt:now.toISOString(),
          }),
        },
      });

      imported++;
    }

    const teacherAccounts:{teacher:string;email:string}[]=[];
    const teacherCells=new Map<string,typeof cells>();

    for(const cell of cells){
      await tx.sourceRecord.upsert({
        where:{id:cell.id},
        create:{
          id:cell.id,
          file:cell.file,
          page:cell.page,
          raw:cell.raw,
          bbox:json(cell.bbox),
          data:json({...cell,weekMapping}),
          issues:json(cell.issues),
        },
        update:{
          raw:cell.raw,
          bbox:json(cell.bbox),
          data:json({...cell,weekMapping}),
          issues:json(cell.issues),
        },
      });

      if(cell.teacher&&!/Вакансія/i.test(cell.teacher)){
        const key=teacherKey(cell.teacher);
        teacherCells.set(key,[...teacherCells.get(key)??[],cell]);
      }
    }

    async function account(email:string,name:string,role:RoleCode){
      let user=await tx.user.findUnique({where:{email}});

      if(!user)user=await tx.user.create({
        data:{
          email,
          name,
          passwordHash,
        },
      });

      await tx.userRole.upsert({
        where:{
          userId_roleId:{
            userId:user.id,
            roleId:role,
          },
        },
        create:{
          userId:user.id,
          roleId:role,
        },
        update:{},
      });

      return user;
    }

    for(const [key,sourceCells] of [...teacherCells].sort(([a],[b])=>a.localeCompare(b))){
      const name=sourceCells[0].teacher!;

      const displayName=
        sourceCells.find(
          c=>c.teacherDisplayName?.startsWith('доц.')||
          c.teacherDisplayName?.startsWith('проф.'),
        )?.teacherDisplayName??
        sourceCells[0].teacherDisplayName??
        name;

      const existing=(await tx.teacher.findMany())
        .filter(t=>teacherKey(t.displayName)===key)
        .sort(
          (a,b)=>
            Number(!!b.userId)-
            Number(!!a.userId)||
            a.id.localeCompare(b.id),
        );

      const primary=
        existing[0]??
        await tx.teacher.create({
          data:{
            id:stableId('teacher',name),
            displayName,
            source:json(sourceCells),
          },
        });

      let user=
        primary.userId
          ?await tx.user.findUnique({where:{id:primary.userId}})
          :null;

      let email=teacherEmail(name);
      let suffix=0;

      while(true){
        const taken=await tx.user.findUnique({where:{email}});

        if(!taken||taken.id===user?.id)break;

        email=teacherEmail(name).replace(
          '@',
          '.'+(++suffix)+'@',
        );
      }

      if(!user){
        user=await account(email,displayName,'TEACHER');
      }else{
        await tx.userRole.upsert({
          where:{
            userId_roleId:{
              userId:user.id,
              roleId:'TEACHER',
            },
          },
          create:{
            userId:user.id,
            roleId:'TEACHER',
          },
          update:{},
        });
      }

      // Establish shared beta credentials once. Repeated preparation preserves admin resets/disabled state.
      await tx.user.update({
        where:{id:user.id},
        data:{
          email,
          name:displayName,
          ...(!prepared?{passwordHash}:{}),
        },
      });

      await tx.teacher.update({
        where:{id:primary.id},
        data:{
          displayName,
          userId:user.id,
          source:json({
            type:'CS_PDF',
            cells:sourceCells.map(c=>({
              file:c.file,
              page:c.page,
              cell:c.sourceCell,
              bbox:c.bbox,
              raw:c.raw,
            })),
          }),
        },
      });

      for(const duplicate of existing.slice(1)){
        await tx.lesson.updateMany({
          where:{teacherId:duplicate.id},
          data:{teacherId:primary.id},
        });

        await tx.teacher.delete({
          where:{id:duplicate.id},
        });

        if(duplicate.userId&&duplicate.userId!==user.id){
          await tx.userRole.deleteMany({
            where:{
              userId:duplicate.userId,
              roleId:'TEACHER',
            },
          });

          await tx.session.deleteMany({
            where:{userId:duplicate.userId},
          });
        }
      }

      teacherAccounts.push({
        teacher:displayName,
        email,
      });
    }

    const starostas:{group:string;email:string}[]=[];

    for(const group of groups){
      const label=group.name.toUpperCase();

      const email=
        'starosta.kn'+
        label
          .replace(/^КН\s*/,'')
          .replace('/','-')+
        '@test.com';

      const user=await account(
        email,
        'Староста · '+label,
        'STAROSTA',
      );

      await tx.starostaAssignment.upsert({
        where:{
          userId_groupId:{
            userId:user.id,
            groupId:group.id,
          },
        },
        create:{
          userId:user.id,
          groupId:group.id,
        },
        update:{},
      });

      starostas.push({
        group:label,
        email,
      });
    }

    const legacyCurator=await tx.user.findUnique({
      where:{email:'curator@test.com'},
    });

    if(legacyCurator){
      await tx.curatorAssignment.deleteMany({
        where:{
          userId:legacyCurator.id,
          groupId:{in:[...CS_GROUP_IDS]},
        },
      });
    }

    const curator=await account(
      'curator.cs@test.com',
      'Куратор · Комп’ютерні науки',
      'CURATOR',
    );

    for(const group of groups){
      await tx.curatorAssignment.upsert({
        where:{
          userId_groupId:{
            userId:curator.id,
            groupId:group.id,
          },
        },
        create:{
          userId:curator.id,
          groupId:group.id,
        },
        update:{},
      });
    }

    await account(
      'developer@test.com',
      'Розробник · beta',
      'DEVELOPER',
    );

    const active=await tx.student.findMany({
      where:{
        groupId:{in:[...CS_GROUP_IDS]},
        active:true,
      },
    });

    const changed=affected.map(r=>r.lessonId);

    for(const student of active){
      changed.push(
        ...await addCurrentRoster(
          tx,
          student,
          now,
        ),
      );
    }

    await refreshRosterState(tx,changed);

    const counts=Object.fromEntries(
      await Promise.all(
        groups.map(async g=>[
          g.name.toUpperCase(),
          await tx.student.count({
            where:{
              groupId:g.id,
              active:true,
            },
          }),
        ]),
      ),
    );

    await tx.systemState.upsert({
      where:{id:'cs-beta'},
      create:{
        id:'cs-beta',
        value:{
          preparedAt:now.toISOString(),
          sourceStudents:58,
        },
      },
      update:{},
    });

    if(imported||ids.length||!prepared){
      await tx.auditLog.create({
        data:{
          objectType:'BetaPreparation',
          objectId:'cs-beta',
          reason:'Явний імпорт roster з наданого DOCX; очищення лише synthetic CS students',
          source:'BETA_PREPARE',
          details:{
            removedSynthetic:ids.length,
            imported,
            counts,
            importedAt:now.toISOString(),
          },
        },
      });
    }

    return {
      counts,
      removedSynthetic:ids.length,
      imported,
      teacherAccounts,
      starostas,
      curator:'curator.cs@test.com',
      developer:'developer@test.com',
    };
  },{
    maxWait:15000,
    timeout:180000,
  });

  await mkdir('runtime',{recursive:true});

  await writeFile(
    'runtime/beta-summary.json',
    JSON.stringify(result,null,2)+'\n',
  );

  console.log(JSON.stringify(result,null,2));

  return result;
}

if(
  process.argv[1]&&
  import.meta.url===pathToFileURL(process.argv[1]).href
){
  prepareCSBeta()
    .catch(error=>{
      console.error(error);
      process.exitCode=1;
    })
    .finally(()=>db.$disconnect());
}