'use client';

import {useEffect,useId,useRef,useState,useSyncExternalStore,type KeyboardEvent,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';

export type SelectOption={value:string;label:string;disabled?:boolean};
export type CustomSelectProps={
  name?:string;
  id?:string;
  label?:string;
  options:SelectOption[];
  value?:string;
  defaultValue?:string;
  onChange?:(value:string)=>void;
  disabled?:boolean;
  required?:boolean;
};

const subscribe=()=>()=>{};
const clientSnapshot=()=>true;
const serverSnapshot=()=>false;

/** Progressive enhancement: the real form control also works before hydration. */
export function CustomSelect(props:CustomSelectProps) {
  return <SelectControl key={props.value===undefined?`default:${props.defaultValue??''}`:'controlled'} {...props}/>;
}

function SelectControl({name,id,label,options,value,defaultValue,onChange,disabled=false,required=false}:CustomSelectProps) {
  const generatedId=useId();
  const controlId=id??`select-${generatedId}`;
  const listId=`${controlId}-options`;
  const hydrated=useSyncExternalStore(subscribe,clientSnapshot,serverSnapshot);
  const [localValue,setLocalValue]=useState(defaultValue??options[0]?.value??'');
  const requested=value??localValue;
  const selected=options.findIndex(option=>option.value===requested);
  const selectedIndex=selected>=0?selected:options.findIndex(option=>!option.disabled);
  const selectedValue=options[selectedIndex]?.value??'';
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(selectedIndex);
  const [position,setPosition]=useState<CSSProperties>({});
  const [invalid,setInvalid]=useState(false);
  const button=useRef<HTMLButtonElement>(null);
  const menu=useRef<HTMLDivElement>(null);
  const search=useRef({text:'',at:0});
  const available=options.map((option,index)=>option.disabled?-1:index).filter(index=>index>=0);
  const inactive=disabled||available.length===0;

  function locate() {
    const rect=button.current?.getBoundingClientRect();
    if(!rect) return;
    const below=window.innerHeight-rect.bottom-12;
    const above=rect.top-12;
    const flip=below<180&&above>below;
    const height=Math.min(280,Math.max(80,flip?above:below));
    setPosition({position:'fixed',left:Math.max(8,Math.min(rect.left,window.innerWidth-rect.width-8)),width:Math.min(rect.width,window.innerWidth-16),maxHeight:height,...(flip?{bottom:window.innerHeight-rect.top+5}:{top:rect.bottom+5})});
  }

  function show(index=selectedIndex) {
    if(inactive) return;
    locate();
    setActive(available.includes(index)?index:available[0]);
    setOpen(true);
  }

  function choose(index:number) {
    const option=options[index];
    if(!option||option.disabled||disabled) return;
    if(value===undefined) setLocalValue(option.value);
    onChange?.(option.value);
    setInvalid(false);
    setOpen(false);
    button.current?.focus();
  }

  useEffect(()=>{
    if(!open) return;
    const outside=(event:PointerEvent)=>{
      const target=event.target as Node;
      if(!button.current?.contains(target)&&!menu.current?.contains(target)) setOpen(false);
    };
    // Dismiss on page scroll/resize so the portal never becomes detached from its control.
    const dismiss=(event:Event)=>{
      if(event.target instanceof Node&&menu.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown',outside);
    window.addEventListener('resize',dismiss);
    window.addEventListener('scroll',dismiss,true);
    return ()=>{
      document.removeEventListener('pointerdown',outside);
      window.removeEventListener('resize',dismiss);
      window.removeEventListener('scroll',dismiss,true);
    };
  },[open]);

  useEffect(()=>{
    if(open) menu.current?.querySelector<HTMLElement>(`[data-option-index="${active}"]`)?.scrollIntoView({block:'nearest'});
  },[active,open]);

  function keyboard(event:KeyboardEvent<HTMLButtonElement>) {
    if(inactive) return;
    if(event.key==='Escape'){event.preventDefault();setOpen(false);return;}
    if(event.key==='Tab'){setOpen(false);return;}
    if(event.key==='Enter'||event.key===' '){
      event.preventDefault();
      if(open) choose(active); else show();
      return;
    }
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();
      if(!open){show(event.key==='Home'?available[0]:event.key==='End'?available.at(-1):selectedIndex);return;}
      if(event.key==='Home') setActive(available[0]);
      else if(event.key==='End') setActive(available[available.length-1]);
      else {
        const current=available.indexOf(active);
        setActive(available[Math.max(0,Math.min(available.length-1,current+(event.key==='ArrowDown'?1:-1)))]);
      }
      return;
    }
    if(event.key.length===1&&!event.altKey&&!event.ctrlKey&&!event.metaKey){
      event.preventDefault();
      const now=Date.now();
      const letter=event.key.toLocaleLowerCase('uk-UA');
      const previous=now-search.current.at<700?search.current.text:'';
      const query=previous===letter?letter:previous+letter;
      search.current={text:query,at:now};
      const start=query.length===1?(open?active:selectedIndex)+1:0;
      const ordered=[...available.filter(index=>index>=start),...available.filter(index=>index<start)];
      const match=ordered.find(index=>options[index].label.toLocaleLowerCase('uk-UA').startsWith(query));
      if(match!==undefined){if(!open) show(match);else setActive(match);}
    }
  }

  return <span className="custom-select">
    <select id={hydrated?`${controlId}-native`:controlId} name={name} value={selectedValue} disabled={disabled} required={required}
      className={hydrated?'custom-select-native':undefined} tabIndex={hydrated?-1:undefined} aria-hidden={hydrated?true:undefined} aria-label={label}
      onFocus={()=>{if(hydrated) button.current?.focus();}}
      onInvalid={event=>{if(hydrated){event.preventDefault();setInvalid(true);button.current?.focus();}}}
      onChange={event=>{if(value===undefined)setLocalValue(event.target.value);onChange?.(event.target.value);setInvalid(false);}}>
      {options.map(option=><option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
    {hydrated&&<>
      <button ref={button} id={controlId} type="button" className="custom-select-trigger" role="combobox" aria-label={label}
        aria-expanded={open} aria-haspopup="listbox" aria-controls={open?listId:undefined}
        aria-activedescendant={open&&active>=0?`${listId}-${active}`:undefined} aria-required={required||undefined} aria-invalid={invalid||undefined}
        aria-describedby={invalid?`${controlId}-error`:undefined} disabled={inactive}
        onClick={()=>open?setOpen(false):show()} onKeyDown={keyboard} onBlur={event=>{if(!menu.current?.contains(event.relatedTarget as Node))setOpen(false);}}>
        <span>{options[selectedIndex]?.label??'Немає варіантів'}</span><span aria-hidden="true" className="custom-select-chevron">⌄</span>
      </button>
      {invalid&&<span id={`${controlId}-error`} className="error-text small">Оберіть значення.</span>}
      {open&&createPortal(<div ref={menu} id={listId} role="listbox" aria-label={label} className="custom-select-options" style={position}>
        {options.map((option,index)=><div key={option.value} id={`${listId}-${index}`} role="option" aria-selected={index===selectedIndex}
          aria-disabled={option.disabled||undefined} data-option-index={index}
          className={`custom-select-option${index===active?' active':''}${option.disabled?' disabled':''}`}
          onMouseDown={event=>event.preventDefault()} onPointerMove={()=>{if(!option.disabled)setActive(index);}} onClick={()=>choose(index)}>
          <span>{option.label}</span><span aria-hidden="true">{index===selectedIndex?'✓':''}</span>
        </div>)}
      </div>,document.body)}
    </>}
  </span>;
}
