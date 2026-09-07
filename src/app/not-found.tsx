import Link from 'next/link';
import {ThemeToggle} from '@/components/theme-toggle';
export default function NotFound(){return <div className="error-page"><ThemeToggle/><p className="eyebrow">404</p><h1>Сторінка недоступна</h1><p className="muted">Об’єкт не знайдено або він поза вашою областю доступу.</p><Link href="/" className="button primary">До робочого простору</Link></div>;}
