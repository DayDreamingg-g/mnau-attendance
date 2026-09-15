import {studentTotals} from '@/lib/metrics';
import {requireUser} from '@/lib/auth';
import {analytics,filterOptions} from '@/lib/analytics';
import {parseFilters,type Search} from '@/lib/filters';
import {Filters} from '@/components/filters';
import {PageTitle,Panel,StudentTable} from '@/components/ui';
export default async function Students({searchParams}:{searchParams:Promise<Search>}){const u=await requireUser(),f=parseFilters(await searchParams),data=await analytics(u,f);const students=studentTotals(data.students).filter(s=>!f.threshold||(s.stats.percentage!==null&&s.stats.percentage<f.threshold)).sort((a,b)=>(a.stats.percentage??Infinity)-(b.stats.percentage??Infinity));return <><PageTitle title={f.threshold?`Студенти з показником нижче ${f.threshold}%`:'Студенти'} description={`${students.length} у вибірці`}/><Filters value={f} options={await filterOptions(u)}/><div className="section-space"><Panel><StudentTable students={students} filters={f}/></Panel></div></>;}
