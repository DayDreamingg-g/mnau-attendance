import {requireUser} from '@/lib/auth';
import {ProfileForm} from '@/components/profile-form';
import {LogoutButton} from '@/components/logout-button';
export default async function ChangePassword(){await requireUser(true);return <main className="content"><section className="panel"><div className="pad"><h1>Зміна пароля</h1><p>Встановіть власний пароль для продовження роботи.</p><ProfileForm passwordOnly/><LogoutButton/></div></section></main>;}
