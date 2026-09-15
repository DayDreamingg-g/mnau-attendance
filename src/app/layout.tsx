import type {Metadata} from 'next';
import './globals.css';
import './ux.css';
export const metadata:Metadata={title:{default:'MNAU Attendance',template:'%s · MNAU Attendance'},description:'TEST · Система обліку відвідуваності МНАУ',robots:{index:false,follow:false}};
const themeScript="try{var t=localStorage.getItem('mnau-theme');document.documentElement.classList.toggle('dark',t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches));}catch{}";
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="uk" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body>{children}</body></html>;}
