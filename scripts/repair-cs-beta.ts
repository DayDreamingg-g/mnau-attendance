import 'dotenv/config';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import {db} from '../src/lib/db';
import {demoEnabled} from '../src/lib/time';
import {CS_GROUP_COUNTS,CS_SOURCE_GROUPS,canonicalizeCS,csName} from '../src/lib/cs-structure';
import {stableId,teacherKey,teacherEmail} from '../src/lib/cs-beta-data';
import {syncCSSchedule,verifyCSSource} from '../src/lib/cs-schedule';
import {hardDeleteStudent} from '../src/lib/student-cleanup';
import type {Prisma,RoleCode} from '../src/generated/prisma/client';

const json=(v:unknown)=>JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

export async function repairCSBeta(options:{from?:string;to?:string}={}){
  if(!demoEnabled()||process.env.APP_ENV==='production')throw new Error('CS repair requires APP_ENV=demo and DEMO_MODE=true; production is locked.');

  const database=await db.$queryRaw<{name:string}[]>`SELECT current_database() AS name`;
  const currentDatabase=database[0]?.name;
  const expectedDatabase=process.env.BETA_DATABASE_NAME?.trim()||'mnau_attendance';

  if(currentDatabase!==expectedDatabase)throw new Error(`Wrong database; repair blocked. Expected "${expectedDatabase}", got "${currentDatabase??'unknown'}".`);

  const {cells,students}=await verifyCSSource();
  const password='Test1234!';
  const passwordHash=await bcrypt.hash(password,12);

  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(9132026)::text`;

    const {
      specialtyId,
      groups,
    }=await canonicalizeCS(tx);

    const ids=groups.map(g=>g.id);

    for(const id of [...ids].sort()){
      await tx.$queryRaw`SELECT "id" FROM "Group" WHERE "id"=${id} FOR UPDATE`;
    }

    const prepared=await tx.systemState.findUnique({
      where:{id:'cs-beta'},
    });

    if(!prepared)throw new Error('This targeted repair requires the existing CS beta roster; normal seed is never invoked.');

    const artifacts=await tx.student.findMany({
      where:{
        fullName:'Test Test Test',
        groupId:{in:ids},
      },
      include:{
        user:{
          select:{
            email:true,
          },
        },
      },
    });

    for(const artifact of artifacts){
      if(
        artifact.user&&
        artifact.user.email!=='123@1561s.com'
      ){
        throw new Error('Ambiguous test artifact account.');
      }

      const removed=await hardDeleteStudent(
        tx,
        artifact.id,
        true,
      );

      await tx.auditLog.create({
        data:{
          objectType:'Student',
          objectId:artifact.id,
          studentId:artifact.id,
          groupId:artifact.groupId,
          source:'CS_BETA_REPAIR',
          reason:'Видалено погоджений тестовий запис Test Test Test та його порожній обліковий запис.',
          details:{
            action:'DELETE',
            fullName:artifact.fullName,
            email:artifact.user?.email??null,
            emptySnapshots:removed.lessonIds.length,
          },
        },
      });
    }

    if(
      await tx.user.count({
        where:{email:'123@1561s.com'},
      })
    ){
      throw new Error('Unlinked test account needs explicit review.');
    }

    // Restore only missing official import rows. Never move or unarchive a row on a repeat run.
    let imported=0;

    for(let index=0;index<students.length;index++){
      const student=students[index];

      const importKey=stableId(
        'cs-roster',
        student.source.sha256+':'+index,
      );

      const sourceGroup=
        CS_SOURCE_GROUPS.find(
          g=>g.id===student.groupId,
        )!;

      const group=
        groups.find(
          g=>csName(g.name)===csName(sourceGroup.name),
        )!;

      const existing=await tx.student.findUnique({
        where:{importKey},
      });

      if(!existing){
        await tx.student.create({
          data:{
            id:importKey,
            importKey,
            fullName:student.fullName,
            groupId:group.id,
            isSynthetic:false,
            joinedAt:new Date(),
            source:json({
              ...student.source,
              type:'IMPORT',
              importedAt:new Date().toISOString(),
            }),
          },
        });

        imported++;
      }else if(
        !(existing.source as {type?:string}|null)?.type
      ){
        await tx.student.update({
          where:{id:existing.id},
          data:{
            source:json({
              ...existing.source as object,
              type:'IMPORT',
            }),
          },
        });
      }
    }

    async function account(
      email:string,
      name:string,
      role:RoleCode,
    ){
      await tx.role.upsert({
        where:{id:role},
        create:{
          id:role,
          label:role,
        },
        update:{},
      });

      let user=await tx.user.findUnique({
        where:{email},
      });

      if(!user){
        user=await tx.user.create({
          data:{
            email,
            name,
            passwordHash,
          },
        });
      }else if(
        !user.active||
        !await bcrypt.compare(
          password,
          user.passwordHash,
        )
      ){
        await tx.user.update({
          where:{id:user.id},
          data:{
            active:true,
            passwordHash,
          },
        });

        await tx.session.deleteMany({
          where:{userId:user.id},
        });

        await tx.auditLog.create({
          data:{
            objectType:'User',
            objectId:user.id,
            source:'CS_BETA_REPAIR',
            reason:'Відновлено узгоджений beta-доступ.',
            details:{
              email,
              role,
            },
          },
        });
      }

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

    const teacherAccounts:{
      teacher:string;
      email:string;
      teacherId:string;
    }[]=[];

    for(
      const key of [
        ...new Set(
          cells.flatMap(
            c=>c.teacher?[teacherKey(c.teacher)]:[],
          ),
        ),
      ].sort()
    ){
      const source=cells.filter(
        c=>c.teacher&&
        teacherKey(c.teacher)===key,
      );

      const name=source[0].teacher!;
      const display=source[0].teacherDisplayName!;
      const email=teacherEmail(name);

      const user=await account(
        email,
        display,
        'TEACHER',
      );

      const matches=(
        await tx.teacher.findMany({
          orderBy:{id:'asc'},
        })
      ).filter(
        t=>teacherKey(t.displayName)===key,
      );

      const primary=
        matches.find(
          t=>t.userId===user.id,
        )??
        matches[0]??
        await tx.teacher.create({
          data:{
            id:stableId('teacher',key),
            displayName:display,
            source:json(source),
          },
        });

      if(
        primary.userId&&
        primary.userId!==user.id
      ){
        await tx.userRole.deleteMany({
          where:{
            userId:primary.userId,
            roleId:'TEACHER',
          },
        });

        await tx.session.deleteMany({
          where:{userId:primary.userId},
        });
      }

      for(
        const duplicate of matches.filter(
          t=>t.id!==primary.id,
        )
      ){
        await tx.lesson.updateMany({
          where:{teacherId:duplicate.id},
          data:{teacherId:primary.id},
        });

        await tx.teacher.delete({
          where:{id:duplicate.id},
        });

        if(
          duplicate.userId&&
          duplicate.userId!==user.id
        ){
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

      const previous=
        primary.source as {
          mergedProfiles?:unknown;
        };

      await tx.teacher.update({
        where:{id:primary.id},
        data:{
          displayName:display,
          userId:user.id,
          source:json({
            type:'CS_PDF',
            cells:source,
            ...(
              matches.length>1
                ?{mergedProfiles:matches}
                :previous.mergedProfiles
                  ?{mergedProfiles:previous.mergedProfiles}
                  :{}
            ),
          }),
        },
      });

      teacherAccounts.push({
        teacher:display,
        email,
        teacherId:primary.id,
      });
    }

    const legacy=await tx.user.findUnique({
      where:{email:'teacher@test.com'},
    });

    if(legacy){
      await tx.user.update({
        where:{id:legacy.id},
        data:{active:false},
      });

      await tx.userRole.deleteMany({
        where:{
          userId:legacy.id,
          roleId:'TEACHER',
        },
      });

      await tx.session.deleteMany({
        where:{userId:legacy.id},
      });
    }

    const starostas=[];

    for(const group of groups){
      const name=csName(group.name);

      const email=
        'starosta.kn'+
        name
          .replace(/^КН\s*/,'')
          .replace('/','-')+
        '@test.com';

      const user=await account(
        email,
        'Староста · '+name,
        'STAROSTA',
      );

      await tx.starostaAssignment.deleteMany({
        where:{
          userId:user.id,
          groupId:{not:group.id},
        },
      });

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
        group:name,
        email,
      });
    }

    const curator=await account(
      'curator.cs@test.com',
      'Куратор · Комп’ютерні науки',
      'CURATOR',
    );

    await tx.curatorAssignment.deleteMany({
      where:{
        userId:curator.id,
        groupId:{notIn:ids},
      },
    });

    for(const id of ids){
      await tx.curatorAssignment.upsert({
        where:{
          userId_groupId:{
            userId:curator.id,
            groupId:id,
          },
        },
        create:{
          userId:curator.id,
          groupId:id,
        },
        update:{},
      });
    }

    await account(
      'developer@test.com',
      'Розробник · beta',
      'DEVELOPER',
    );

    await account(
      'admin@test.com',
      'Адміністратор',
      'ADMIN',
    );

    const dean=await account(
      'dean@test.com',
      'Деканат',
      'DEAN_OFFICE',
    );

    const specialty=await tx.specialty.findUniqueOrThrow({
      where:{id:specialtyId},
    });

    await tx.deanAssignment.upsert({
      where:{
        userId_facultyId:{
          userId:dean.id,
          facultyId:specialty.facultyId,
        },
      },
      create:{
        userId:dean.id,
        facultyId:specialty.facultyId,
      },
      update:{},
    });

    const schedule=await syncCSSchedule(
      tx,
      options,
    );

    const teachers=await Promise.all(
      teacherAccounts.map(
        async t=>({
          ...t,
          lessonCount:await tx.lesson.count({
            where:{
              teacherId:t.teacherId,
              cancelled:false,
              groups:{
                some:{
                  groupId:{in:ids},
                },
              },
            },
          }),
        }),
      ),
    );

    for(const t of teachers){
      if(!t.lessonCount){
        throw new Error(
          'Zero assigned lessons: '+
          t.teacher+
          ' '+
          t.email,
        );
      }
    }

    const counts=Object.fromEntries(
      await Promise.all(
        groups.map(
          async g=>[
            csName(g.name),
            await tx.student.count({
              where:{
                groupId:g.id,
                active:true,
                isSynthetic:false,
              },
            }),
          ],
        ),
      ),
    );

    const firstRepair=
      !await tx.systemState.findUnique({
        where:{id:'cs-beta-repair-v2'},
      });

    if(
      firstRepair&&
      JSON.stringify(counts)!==
      JSON.stringify(CS_GROUP_COUNTS)
    ){
      throw new Error(
        'Unexpected roster counts; review manual changes: '+
        JSON.stringify(counts),
      );
    }

    const result={
      specialtyId,
      counts,
      teachers,
      starostas,
      schedule,
      cleaned:artifacts.length,
      imported,
      disabledLegacy:
        legacy
          ?['teacher@test.com']
          :[],
    };

    await tx.systemState.upsert({
      where:{id:'cs-beta-repair-v2'},
      create:{
        id:'cs-beta-repair-v2',
        value:json(result),
      },
      update:{
        value:json(result),
      },
    });

    if(
      firstRepair||
      artifacts.length||
      imported||
      schedule.created||
      schedule.updated||
      schedule.retired
    ){
      await tx.auditLog.create({
        data:{
          objectType:'BetaRepair',
          objectId:'cs-beta-repair-v2',
          source:'CS_BETA_REPAIR',
          reason:'Відновлено структуру, облікові записи та календар за PDF; без генерації відміток.',
          details:json(result),
        },
      });
    }

    return result;
  },{
    maxWait:20000,
    timeout:240000,
  });
}

if(
  process.argv[1]&&
  import.meta.url===pathToFileURL(process.argv[1]).href
){
  repairCSBeta()
    .then(async result=>{
      await mkdir('runtime',{recursive:true});

      await writeFile(
        'runtime/cs-repair-summary.json',
        JSON.stringify(result,null,2),
      );

      console.log(
        JSON.stringify(result,null,2),
      );
    })
    .catch(error=>{
      console.error(
        error instanceof Error
          ?error.message
          :'Repair failed',
      );

      process.exitCode=1;
    })
    .finally(()=>db.$disconnect());
}