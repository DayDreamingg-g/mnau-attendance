import {loginErrorMessage} from '@/lib/login-errors';
import {LoginForm} from '@/components/login-form';
import {ThemeToggle} from '@/components/theme-toggle';
import {demoEnabled} from '@/lib/time';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const error=loginErrorMessage((await searchParams).error);return <main className="login-page"><div className="login-theme"><ThemeToggle/></div><div className="login-card"><div className="brand"><span className="brand-mark">М</span><span>MNAU<span className="brand-sub">ATTENDANCE</span></span></div><div className="login-heading"><p className="eyebrow">ЕЛЕКТРОННИЙ ЖУРНАЛ</p><h1>Раді бачити вас</h1><p className="muted">Увійдіть, щоб відкрити заняття та відвідуваність.</p></div><LoginForm key={error} initialError={error}/>{demoEnabled()&&<span className="outline-badge">DEMO</span>}<p className="login-footer">Миколаївський національний аграрний університет<br/>Експериментальний проєкт</p></div></main>;}
