import type {ReactNode,ComponentProps} from 'react';
export function PageHeader({eyebrow,title,description,action,test=false}:{eyebrow?:string;title:string;description?:string;action?:ReactNode;test?:boolean}){
  return <header className="page-title"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<div className="page-heading-line"><h1>{title}</h1>{test&&<span className="test-badge">TEST</span>}</div>{description&&<p className="muted">{description}</p>}</div>{action&&<div className="page-actions">{action}</div>}</header>;
}
export function SectionCard({title,action,children,className=''}:{title?:string;action?:ReactNode;children:ReactNode;className?:string}){
  return <section className={`panel ${className}`}>{(title||action)&&<div className="panel-heading"><h2>{title}</h2>{action}</div>}{children}</section>;
}
export function FilterBar({className='',...props}:ComponentProps<'div'>){return <div className={`filter-bar ${className}`} {...props}/>;}
