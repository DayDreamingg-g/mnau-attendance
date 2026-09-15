'use client';
import {useState,useEffect,useRef} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {filterLink,type Filters} from '@/lib/filters';
import {submissionMode,confirmsRow,type JournalStatus} from '@/lib/journal-submission';
import {attendanceModeLabel,type AttendanceMode} from '@/lib/attendance-mode';
type Row={attendanceMode?:AttendanceMode|null;isDemo?:boolean;id:string;name:string;group:string;status:JournalStatus;confirmed:boolean;editable:boolean;canConfirm:boolean};
const changed=(row:Row,original?:Row)=>row.status!==original?.status||(row.attendanceMode??null)!==(original?.attendanceMode??null);
type Props={lessonId:string;initialVersion:number;rows:Row[];canConfirm:boolean;needsReason:boolean;filters?:Filters};
export function JournalEditor(props:Props){return <JournalForm key={props.lessonId} {...props}/>;}
function JournalForm({lessonId,initialVersion,rows,needsReason:initialNeedsReason,filters}:Props){
  const router=useRouter();
  const [draft,setDraft]=useState(rows),[baseline,setBaseline]=useState(rows),[version,setVersion]=useState(initialVersion),[needsReason,setNeedsReason]=useState(initialNeedsReason),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[confirming,setConfirming]=useState(false),[conflict,setConflict]=useState(false);
  const retry=useRef<{body:string;requestId:string}|null>(null),inFlight=useRef(false);
  const originals=new Map(baseline.map(row=>[row.id,row]));
  const dirty=draft.some(row=>changed(row,originals.get(row.id)));
  const hasPending=draft.some(row=>row.editable&&row.canConfirm&&row.status!==null&&!row.confirmed);
  const editable=draft.some(row=>row.editable);
  const mode=submissionMode(draft);
  const confirmedCount=draft.filter(row=>row.editable&&row.status!==null&&confirmsRow(mode,row.canConfirm)).length;
  const draftCount=draft.filter(row=>row.editable&&row.status!==null&&!confirmsRow(mode,row.canConfirm)).length;
  useEffect(()=>{const fn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',fn);return()=>window.removeEventListener('beforeunload',fn);},[dirty]);
  function setStatus(id:string,status:Row['status']){if(inFlight.current)return;setDraft(list=>list.map(row=>row.id===id&&row.editable?{...row,status,attendanceMode:status==='PRESENT'?(row.attendanceMode??null):null}:row));setSuccess('');setConfirming(false);}
  function setAttendanceMode(id:string,value:AttendanceMode){if(inFlight.current)return;setDraft(list=>list.map(row=>row.id===id&&row.editable&&row.status==='PRESENT'?{...row,attendanceMode:row.attendanceMode===value?null:value}:row));setSuccess('');setConfirming(false);}
  async function save(){
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);setError('');setSuccess('');
    const values={version,mode,reason:reason||undefined,rows:draft.filter(row=>row.editable).map(row=>({studentId:row.id,status:row.status,attendanceMode:row.attendanceMode??null}))};
    const body=JSON.stringify(values);
    if(!retry.current||retry.current.body!==body)retry.current={body,requestId:crypto.randomUUID()};
    try{
      const response=await fetch(`/api/lessons/${lessonId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,requestId:retry.current.requestId})});
      const result=await response.json();
      if(!response.ok){setConflict(response.status===409);throw new Error(result.error??'Не вдалося зберегти.');}
      setVersion(result.version);setDraft(result.rows);setBaseline(result.rows);setNeedsReason(result.needsReason);setConflict(false);
      setSuccess('Відвідуваність збережено · '+new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'}));
      setConfirming(false);retry.current=null;router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'З’єднання втрачено. Чернетка залишається у формі.');}finally{inFlight.current=false;setBusy(false);}
  }
  return <section className="panel" aria-busy={busy}>
    <div className="journal-toolbar"><div><h2>Відмітки студентів</h2><p className="muted small">• Присутність · N Відсутній · HV Поважна причина · ON Онлайн · OFF Офлайн</p><p className="muted small">У рядку: клавіші 1 / 2 / 3 / 0. Заповнено: {draft.filter(row=>row.status!==null).length} із {draft.length}.</p></div><button type="button" className="button" disabled={!editable||busy} onClick={()=>{setDraft(list=>list.map(row=>row.editable?{...row,status:'PRESENT'}:row));setSuccess('');setConfirming(false);}}>Позначити всіх присутніми</button></div>
    {!editable&&<p className="panel-description">Редагування недоступне. Минулі дні виправляє уповноважений куратор, деканат або адміністратор.</p>}
    {!draft.length&&<p className="panel-description">У групі ще немає студентів.</p>}<div className="table-scroll"><table><thead><tr><th>№</th><th>Студент / студентка</th><th>Група</th><th>Відмітка</th><th>Формат присутності</th><th>Стан</th></tr></thead><tbody>{draft.map((row,i)=><tr key={row.id}><td className="muted">{i+1}</td><td><Link className="row-link" href={filters?filterLink(`/students/${row.id}`,filters,{student:row.id}):`/students/${row.id}`}>{row.name}</Link></td><td>{row.group}</td><td><div className="journal-select" role="group" aria-label={`Відвідуваність: ${row.name}`} onKeyDown={event=>{const shortcuts:Record<string,JournalStatus>={'1':'PRESENT','2':'N','3':'HV','0':null};if(!event.ctrlKey&&!event.altKey&&!event.metaKey&&Object.hasOwn(shortcuts,event.key)&&row.editable&&!busy){event.preventDefault();setStatus(row.id,shortcuts[event.key]);}}}>{([['PRESENT','•','Присутній'],['N','N','Відсутній'],['HV','HV','Поважна причина'],[null,'–','Не відмічено']] as const).map(([status,label,name])=><button key={status??'none'} type="button" className={`${row.status===status?'selected':''} ${status??''}`} title={name} data-tooltip={name} aria-label={`${name}: ${row.name}`} aria-pressed={row.status===status} disabled={!row.editable||busy} onClick={()=>setStatus(row.id,status)}>{label}</button>)}</div></td><td><div className="journal-select attendance-mode" role="group" aria-label={`Формат присутності: ${row.name}`}>{([['ONLINE','ON','Присутній онлайн'],['OFFLINE','OFF','Присутній офлайн']] as const).map(([value,label,tooltip])=><span className="mode-control" key={value}><button type="button" className={row.attendanceMode===value?'selected':''} aria-label={`${tooltip}: ${row.name}`} aria-pressed={row.attendanceMode===value} aria-describedby={`mode-${row.id}-${value}`} disabled={!row.editable||busy||row.status!=='PRESENT'} onClick={()=>setAttendanceMode(row.id,value)}>{label}</button><span role="tooltip" id={`mode-${row.id}-${value}`} className="mode-tooltip">{tooltip}</span></span>)}</div>{row.status==='PRESENT'&&<span className="table-secondary">{attendanceModeLabel(row.attendanceMode)}</span>}</td><td><span className="muted small">{changed(row,originals.get(row.id))?'Змінено (у БД: '+(originals.get(row.id)?.status??'—')+(originals.get(row.id)?.status==='PRESENT'?' · '+attendanceModeLabel(originals.get(row.id)?.attendanceMode):'')+')':row.status===null?'Не відмічено':'Збережено'}</span></td></tr>)}</tbody></table></div>
    {needsReason&&editable&&<div className="journal-reason"><label>Причина виправлення минулого дня<textarea value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);setConfirming(false);}} maxLength={500} minLength={5} placeholder="Наприклад: виправлено помилку внесення відмітки"/></label><p className="muted small">Не вказуйте медичні діагнози або інші чутливі подробиці.</p></div>}
    <div className="journal-footer"><div aria-live="polite">{dirty&&<p className="dirty-label">Є незбережені зміни</p>}{error&&<p className="error-text" role="alert">{error}</p>}{success&&<p className="form-success">{success}</p>}{!dirty&&!error&&!success&&<span className="muted small">Версія журналу: {version}</span>}</div><div className="topbar-actions">{conflict&&<button type="button" className="button" disabled={busy} onClick={async()=>{setBusy(true);try{const response=await fetch(`/api/lessons/${lessonId}`);const data=await response.json();if(!response.ok)throw new Error(data.error);const local=new Map(draft.filter(r=>changed(r,originals.get(r.id))).map(r=>[r.id,{status:r.status,attendanceMode:r.attendanceMode??null}]));setBaseline(data.rows);setDraft(data.rows.map((r:Row)=>local.has(r.id)?{...r,...local.get(r.id)!}:r));setVersion(data.version);setNeedsReason(data.needsReason);setConflict(false);setError('Дані оновлено. Ваші незбережені зміни залишилися у формі; звірте їх зі збереженими значеннями перед повторним записом.');}catch(e){setError(e instanceof Error?e.message:'Помилка');}finally{setBusy(false);}}}>Завантажити актуальні</button>}{!confirming?<button type="button" className="button primary" disabled={busy||!editable||(!dirty&&!hasPending)||(needsReason&&reason.trim().length<5)} onClick={()=>setConfirming(true)}>Зберегти</button>:<div className="stack"><p className="small">Зберегти відмітки? Відміток: {confirmedCount+draftCount}; не відмічено: {draft.filter(row=>row.editable&&row.status===null).length}.</p><div><button type="button" className="button primary" disabled={busy} onClick={save}>{busy?'Збереження…':'Підтвердити збереження'}</button> <button type="button" className="button" disabled={busy} onClick={()=>setConfirming(false)}>Скасувати</button></div></div>}</div></div>
  </section>;
}
