'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {filterLink} from '@/lib/filters';
import {reportKindLabels,type ReportFilters,type ReportKind,type ReportSummary} from '@/lib/report-types';
import {CustomSelect} from './custom-select';
import {ReportPreview} from './report-preview';
export type ReportOptions={
  faculties:{id:string;name:string}[];
  specialties:{id:string;name:string;facultyId:string}[];
  groups:{id:string;name:string;specialtyId:string;course:number}[];
  students:{id:string;fullName:string;groupId:string}[];
};
export function ReportForm({filters,options,periods}:{filters:ReportFilters;options:ReportOptions;periods:Record<ReportKind,{from:string;to:string}>}){
  const router=useRouter();
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false),[preview,setPreview]=useState<ReportSummary|null>(null);
  const [faculty,setFaculty]=useState(filters.faculty??options.faculties[0]?.id??''),[specialty,setSpecialty]=useState(filters.specialty??''),[group,setGroup]=useState(filters.group??''),[student,setStudent]=useState(filters.student??''),[course,setCourse]=useState(filters.course?String(filters.course):'');
  const [threshold,setThreshold]=useState(filters.threshold?String(filters.threshold):'');
  const [kind,setKind]=useState<ReportKind>('MONTHLY'),[from,setFrom]=useState(filters.from),[to,setTo]=useState(filters.to);
  const specialties=options.specialties.filter(s=>s.facultyId===faculty);
  const groups=options.groups.filter(g=>specialties.some(s=>s.id===g.specialtyId)&&(!specialty||g.specialtyId===specialty)&&(!course||g.course===Number(course)));
  const students=options.students.filter(s=>groups.some(g=>g.id===s.groupId)&&(!group||s.groupId===group));
  const values={faculty,kind,from,to,course,specialty,group,student,threshold};
  const currentFilters:ReportFilters={...filters,faculty,from,to,course:course?Number(course):undefined,specialty:specialty||undefined,group:group||undefined,student:student||undefined,threshold:threshold?Number(threshold):undefined};
  function changed(){setPreview(null);setMessage('');}
  async function submit(generate:boolean){
    setBusy(true);setMessage('');setError(false);
    try{
      const r=generate?await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)}):await fetch(`/api/reports/preview?${new URLSearchParams(values)}`);
      const result=await r.json();if(!r.ok)throw new Error(result.error);
      if(generate){router.push(filterLink(`/reports/${result.id}`,currentFilters));router.refresh();}
      else {setPreview(result.summary);setMessage('Перевірте вибірку. Після підтвердження буде збережено PDF і CSV.');}
    }catch(e){setError(true);setMessage(e instanceof Error?e.message:'Не вдалося створити звіт.');}finally{setBusy(false);}
  }
  return <><form className="filters" onSubmit={e=>{e.preventDefault();void submit(false);}}>
    <label className="filter-wide">Факультет<CustomSelect name="faculty" label="Факультет" value={faculty} required disabled={busy} options={options.faculties.map(f=>({value:f.id,label:f.name}))} onChange={v=>{setFaculty(v);setSpecialty('');setGroup('');setStudent('');changed();}}/></label>
    <label>Тип звіту<CustomSelect name="kind" label="Тип звіту" value={kind} disabled={busy} options={Object.entries(reportKindLabels).map(([value,label])=>({value,label}))} onChange={v=>{const next=v as ReportKind;setKind(next);setFrom(periods[next].from);setTo(periods[next].to);changed();}}/></label>
    <label>Від<input name="from" type="date" value={from} disabled={busy} onChange={e=>{setFrom(e.target.value);changed();}} required/></label>
    <label>До<input name="to" type="date" value={to} disabled={busy} onChange={e=>{setTo(e.target.value);changed();}} required/></label>
    <label>Курс<CustomSelect name="course" label="Курс" value={course} disabled={busy} options={[{value:'',label:'Усі курси'},...[1,2,3,4].map(c=>({value:String(c),label:`${c} курс`}))]} onChange={v=>{setCourse(v);setGroup('');setStudent('');changed();}}/></label>
    <label className="filter-wide">Спеціальність<CustomSelect name="specialty" label="Спеціальність" value={specialty} disabled={busy} options={[{value:'',label:'Усі спеціальності'},...specialties.map(s=>({value:s.id,label:s.name}))]} onChange={v=>{setSpecialty(v);setGroup('');setStudent('');changed();}}/></label>
    <label>Група<CustomSelect name="group" label="Група" value={group} disabled={busy} options={[{value:'',label:'Усі групи'},...groups.map(g=>({value:g.id,label:g.name}))]} onChange={v=>{setGroup(v);setStudent('');changed();}}/></label>
    <label className="filter-wide">Студент / студентка<CustomSelect name="student" label="Студент / студентка" value={student} disabled={busy} options={[{value:'',label:'Усі студенти'},...students.map(s=>({value:s.id,label:s.fullName}))]} onChange={v=>{setStudent(v);changed();}}/></label>
    <label>Поріг<CustomSelect name="threshold" label="Поріг" value={threshold} disabled={busy} options={[{value:'',label:'Усі показники'},{value:'70',label:'Нижче 70%'},{value:'50',label:'Нижче 50%'}]} onChange={v=>{setThreshold(v);changed();}}/></label>
    <button className="button" disabled={busy||!faculty}>{busy?'Обробка…':'Переглянути звіт'}</button>
    {message&&<p className={error?'error-text':'form-success'} role={error?'alert':'status'} style={{width:'100%'}}>{message}</p>}
  </form>{preview&&<div className="section-space"><ReportPreview summary={preview} filters={currentFilters} maxRows={20}/><p className="panel-description">Підтверджую вибраний період та область звіту.</p><button className="button primary" disabled={busy} onClick={()=>void submit(true)}>{busy?'Формування…':'Підтвердити та зберегти PDF / CSV'}</button></div>}</>;
}
