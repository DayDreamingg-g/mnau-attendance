import Link from 'next/link';
import {db} from '@/lib/db';
import {groupScope} from '@/lib/access';
import {TermSelector} from '@/components/term-selector';
import {canViewSources} from '@/lib/access';
import {requireUser,hasRole} from '@/lib/auth';
import {Navigation} from '@/components/navigation';
import {FeedbackButton} from '@/components/feedback-button';
import {ThemeToggle} from '@/components/theme-toggle';
import {LogoutButton} from '@/components/logout-button';
const labels:Record<string,string>={ADMIN:'Адміністратор',DEVELOPER:'Розробник',STUDENT:'Студент',DEAN_OFFICE:'Деканат',CURATOR:'Куратор',TEACHER:'Викладач',STAROSTA:'Староста'};
export default async function Layout({children}:{children:React.ReactNode}){const u=await requireUser();const terms=await db.academicTerm.findMany({where:{confirmedAt:{not:null},faculty:{specialties:{some:{groups:{some:groupScope(u)}}}}},orderBy:{fromDate:'desc'},take:30});return <div className="app-shell"><aside className="sidebar"><Link className="brand" href="/"><span className="brand-mark">М</span><span>MNAU<span className="brand-sub">ATTENDANCE</span></span></Link><div className="nav-label">РОБОЧИЙ ПРОСТІР</div><Navigation roles={u.roles.map(r=>r.roleId).filter(r=>r!=='STUDENT'&&(r!=='TEACHER'||!!u.teacher))} workspace={u.workspace} items={[
{href:'/',label:'Огляд',icon:'▦'},{href:'/groups',label:'Групи та студенти',icon:'▤'},
...(hasRole(u,'DEAN_OFFICE')?[{href:'/directory',label:'Довідник користувачів',icon:'○'}]:[]),
...(hasRole(u,'CURATOR')?[{href:'/curator',label:'Курс і група',icon:'▤'}]:[]),
...(hasRole(u,'TEACHER')&&u.teacher?[{href:'/teacher',label:'Мої заняття',icon:'▣'}]:[]),
...(hasRole(u,'STAROSTA')?[{href:'/starosta',label:'Журнал старости',icon:'✓'}]:[]),
...(u.roles.some(r=>['TEACHER','CURATOR','DEAN_OFFICE','ADMIN','DEVELOPER','STAROSTA'].includes(r.roleId))?[{href:'/reports',label:'Звіти',icon:'↧'}]:[]),
...(canViewSources(u)?[{href:'/sources',label:'Джерела даних',icon:'≡'}]:[]),
...(u.roles.some(r=>['TEACHER','CURATOR','DEAN_OFFICE','ADMIN','DEVELOPER'].includes(r.roleId))?[{href:'/profile',label:'Мій профіль',icon:'○'}]:[]),
...(hasRole(u,'ADMIN')||hasRole(u,'DEVELOPER')?[{href:'/admin',label:'Адміністрування',icon:'⚙'},{href:'/admin/feedback',label:'Відгуки',icon:'✉'},{href:'/admin/audit',label:'Аудит',icon:'≡'},{href:'/admin/system',label:'Стан системи',icon:'◉'}]:[]),
...(hasRole(u,'ADMIN')||hasRole(u,'DEVELOPER')||hasRole(u,'DEAN_OFFICE')?[{href:'/terms',label:'Семестри',icon:'▣'}]:[])
]}/><div className="sidebar-footer"><span className="outline-badge">Експериментальний проєкт</span><p>Миколаївський національний аграрний університет</p></div></aside><div className="main-shell"><header className="topbar"><div><span className="avatar">{u.name.slice(0,1)}</span><div><strong>{u.name}</strong><small>{u.roles.map(r=>labels[r.roleId]).join(' · ')}</small></div></div><div className="topbar-actions"><ThemeToggle/><LogoutButton/></div></header><main id="main-content" className="content"><TermSelector terms={terms.map(t=>({id:t.id,name:t.name,fromDate:t.fromDate,toDate:t.toDate,archived:!!t.archivedAt}))}/>{children}<div className="section-space"><FeedbackButton/></div></main></div></div>;}
