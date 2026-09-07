'use client';
import Link from 'next/link';
import {ThemeToggle} from '@/components/theme-toggle';
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <div className="error-page"><ThemeToggle/><h1>Не вдалося завантажити дані</h1><p className="muted">Перевірте з’єднання та фільтри. Ваші незбережені зміни не вважаються збереженими.</p><button className="button primary" onClick={reset}>Спробувати ще раз</button> <Link className="button" href="/">До огляду</Link></div>;}
