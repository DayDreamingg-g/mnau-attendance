import {LinkedRow} from '@/components/linked-row';
import {SortHeader} from '@/components/sort-header';
import {sortRows} from '@/lib/sorting';
import Link from 'next/link';
import {db} from '@/lib/db';
import {redirect} from 'next/navigation';
import {requireUser,hasRole} from '@/lib/auth';
import {analytics,filterOptions} from '@/lib/analytics';
import {betaFilters} from '@/lib/beta-ui';
import {BetaScopeSwitch} from '@/components/beta-scope-switch';
import {parseFilters,filterLink,type Search} from '@/lib/filters';
import {Filters} from '@/components/filters';
import {
  Stats,
  Completion,
  PageTitle,
  Panel,
  Percentage,
  Empty,
  FormulaNote,
  StudentTable,
} from '@/components/ui';

export default async function Dashboard({
  searchParams,
}:{
  searchParams:Promise<Search>;
}){
  const user=await requireUser();

  if(user.roles.length===1&&hasRole(user,'TEACHER')){
    redirect('/teacher');
  }

  if(user.roles.length===1&&hasRole(user,'STAROSTA')){
    redirect('/starosta');
  }

  if(user.roles.length===1&&hasRole(user,'CURATOR'))redirect('/curator');
  if(user.roles.length===1&&hasRole(user,'STUDENT')&&user.student)redirect('/students/'+user.student.id);
  const search=await searchParams;
  const filters=await betaFilters(user,parseFilters(search));
  const options=await filterOptions(user,filters.scope==='faculty');

  const selected=options.faculties.find(
    (faculty)=>faculty.id===filters.faculty,
  )??(
    !filters.faculty
      ?options.faculties.find(
        (faculty)=>faculty.slug==='management',
      )??options.faculties[0]
      :undefined
  );

  if(!filters.faculty&&selected){
    filters.faculty=selected.id;
  }

  const beta=await db.systemState.findUnique({where:{id:'cs-beta'}});
  const cs=options.groups.find(g=>g.id==='g-1-4')?.specialty;
  if(beta&&cs&&!filters.specialty&&!filters.group&&search.scope!=='faculty')filters.specialty=cs.id;
  const data=await analytics(user,filters);

  const critical=data.students
    .filter((student)=>student.stats.below50)
    .sort(
      (a,b)=>a.stats.percentage!-b.stats.percentage!,
    );

  return <>
    <BetaScopeSwitch all={filters.scope==='faculty'} path="/"/>
    <PageTitle
      eyebrow="ОГЛЯД ВІДВІДУВАНОСТІ"
      title={beta&&cs&&filters.specialty===cs.id?'Комп’ютерні науки':selected?.name??'Ваш робочий простір'}
      description="Актуальний стан журналів і студенти, яким потрібна увага."
      action={
        (hasRole(user,'ADMIN')||hasRole(user,'DEVELOPER'))||hasRole(user,'DEAN_OFFICE')
          ?<Link
            className="button"
            href={filterLink('/reports',filters)}
          >
            ↧ Створити звіт
          </Link>
          :undefined
      }
    />

    {options.faculties.length>1&&
      <nav className="tabs">
        {options.faculties.map((faculty)=>
          <Link
            className={
              faculty.id===filters.faculty
                ?'active'
                :''
            }
            key={faculty.id}
            href={filterLink(
              '/',
              filters,
              {
                faculty:faculty.id,
                specialty:undefined,
                group:undefined,
              },
            )}
          >
            {faculty.name}
          </Link>,
        )}
      </nav>
    }

    {beta&&cs&&<nav className="tabs"><Link className={filters.specialty===cs.id?'active':''} href={filterLink('/',filters,{specialty:cs.id,group:undefined})}>Комп’ютерні науки · beta</Link><Link className={!filters.specialty?'active':''} href={filterLink('/',filters,{specialty:undefined,group:undefined})+'&scope=faculty'}>Увесь факультет</Link></nav>}
    {beta&&cs&&filters.specialty===cs.id&&<nav className="tabs">{options.groups.filter(g=>g.specialty.id===cs.id).map(g=><Link key={g.id} href={filterLink('/groups/'+g.id,filters,{group:g.id})}>{g.name.toUpperCase()}</Link>)}</nav>}
    <Filters
      value={filters}
      options={options}
    />

    <Stats
      data={data}
      filters={filters}
    />

    <Panel>
      <Completion data={data}/>
    </Panel>

    <div className="section-space">
      <Panel
        title="Спеціальності"
        action={
          <span className="muted small">
            {data.specialties.length} у вибірці
          </span>
        }
      >
        {data.specialties.length
          ?<div className="table-scroll">
            <table>
              <thead>
                <tr>
<SortHeader label="Освітній напрям" sortKey="specialties_name" filters={filters} path={'/'}/><SortHeader label="Групи" sortKey="specialties_groups" filters={filters} path={'/'}/><SortHeader label="Студенти" sortKey="specialties_students" filters={filters} path={'/'}/><SortHeader label="Відвідуваність" sortKey="specialties_percentage" filters={filters} path={'/'}/>
                  <th/>
                </tr>
              </thead>

              <tbody>
                {sortRows(data.specialties,filters,{specialties_name:s=>s.name,specialties_groups:s=>s.groupCount,specialties_students:s=>s.studentCount,specialties_percentage:s=>s.stats.percentage}).map((specialty)=>
                  <LinkedRow key={specialty.id} href={filterLink(`/specialties/${specialty.id}`,filters,{specialty:specialty.id,student:undefined})}>
                    <td>
                      <Link
                        className="row-link"
                        href={filterLink(
                          `/specialties/${specialty.id}`,
                          filters,
                          {specialty:specialty.id,student:undefined},
                        )}
                      >
                        {specialty.name}
                      </Link>

                      <span className="table-secondary">
                        {specialty.code??'Код набору уточнюється'} · {
                          data.groups
                            .filter(
                              (group)=>group.specialtyId===specialty.id,
                            )
                            .map((group)=>group.course)
                            .filter(
                              (course,index,array)=>
                                array.indexOf(course)===index,
                            )
                            .join(', ')
                        } курс
                      </span>
                    </td>

                    <td>{specialty.groupCount}</td>
                    <td>{specialty.studentCount}</td>
                    <td>
                      <Percentage value={specialty.stats.percentage}/>
                    </td>

                    <td>
                      <Link
                        aria-label={`Відкрити ${specialty.name}`}
                        href={filterLink(
                          `/specialties/${specialty.id}`,
                          filters,
                          {specialty:specialty.id,student:undefined},
                        )}
                      >
                        ↗
                      </Link>
                    </td>
                  </LinkedRow>,
                )}
              </tbody>
            </table>
          </div>
          :<Empty>
            Немає груп у вибірці або немає призначень доступу.
          </Empty>
        }
      </Panel>
    </div>

    <Panel
      title="Потребують особливої уваги"
      action={
        <Link
          className="text-link"
          href={filterLink(
            '/students',
            filters,
            {threshold:50},
          )}
        >
          Показати всіх ({critical.length}) →
        </Link>
      }
    >
      <p className="panel-description">
        Показник нижче 50%. Входять до загальної кількості нижче 70%.
      </p>

      <StudentTable
        path="/"
        students={critical.slice(0,5)}
        filters={filters}
      />
    </Panel>

    <FormulaNote/>
  </>;
}
