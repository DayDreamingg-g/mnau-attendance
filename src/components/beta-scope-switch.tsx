import Link from 'next/link';
import {demoEnabled} from '@/lib/time';
export function BetaScopeSwitch({all,path}:{all:boolean;path:string}){
  if(!demoEnabled())return null;
  return <div className="beta-scope"><strong>{all?'Увесь факультет':"Комп'ютерні науки · TEST"}</strong><Link className="button" href={path+(all?'':'?scope=faculty')}>{all?'Комп’ютерні науки · TEST':'Увесь факультет'}</Link></div>;
}
