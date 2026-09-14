'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {reportKindLabels,type ReportFilters,type ReportKind} from '@/lib/report-types';
import {CustomSelect} from './custom-select';
export type ReportOptions={
  faculties:{id:string;name:string}[];
  specialties:{id:string;name:string;facultyId:string}[];
  groups:{id:string;name:string;specialtyId:string;course:number}[];
  students:{id:string;fullName:string;groupId:string}[];
};
export function ReportForm({filters,options,periods}:{filters:ReportFilters;options:ReportOptions;periods:Record<ReportKind,{from:string;to:string}>}){
  const router=useRouter();
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false);
  const [faculty,setFaculty]=useState(filters.faculty??options.specialties[0]?.facultyId??options.faculties[0]?.id??''),[specialty,setSpecialty]=useState(filters.specialty??(options.specialties.length===1?options.specialties[0].id:'')),[group,setGroup]=useState(filters.group??''),[student,setStudent]=useState(filters.student??''),[course,setCourse]=useState(filters.course?String(filters.course):'');
  const [threshold,setThreshold]=useState(filters.threshold?String(filters.threshold):'');
  const [kind,setKind]=useState<ReportKind>('MONTHLY'),[from,setFrom]=useState(filters.from),[to,setTo]=useState(filters.to);
  const specialties=options.specialties.filter(s=>s.facultyId===faculty);
  const groups=options.groups.filter(g=>specialties.some(s=>s.id===g.specialtyId)&&(!specialty||g.specialtyId===specialty)&&(!course||g.course===Number(course)));
  const students=options.students.filter(s=>groups.some(g=>g.id===s.groupId)&&(!group||s.groupId===group));
  const values={faculty,kind,from,to,course,specialty:specialty||(options.specialties.length===1&&options.specialties[0].facultyId===faculty?options.specialties[0].id:''),group,student,threshold};
  function changed(){setMessage('');}
  async function submit(){
    setBusy(true);setMessage('');setError(false);
    try{
      const r=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
      const result=await r.json();if(!r.ok)throw new Error(result.error);
      setMessage(result.state==='PENDING'?'Звіт формується. Оновіть список за мить.':'Звіт створено');router.refresh();
    }catch(e){setError(true);setMessage(e instanceof Error?e.message:'Не вдалося створити звіт.');}finally{setBusy(false);}
  }
  return <><form className="filters report-filters" onSubmit={e=>{e.preventDefault();void submit();}}>
    <label className="filter-wide">Факультет<CustomSelect name="faculty" label="Факультет" value={faculty} required disabled={busy} options={options.faculties.map(f=>({value:f.id,label:f.name}))} onChange={v=>{setFaculty(v);setSpecialty('');setGroup('');setStudent('');changed();}}/></label>
    <label>Тип звіту<CustomSelect name="kind" label="Тип звіту" value={kind} disabled={busy} options={Object.entries(reportKindLabels).map(([value,label])=>({value,label}))} onChange={v=>{const next=v as ReportKind;setKind(next);setFrom(periods[next].from);setTo(periods[next].to);changed();}}/></label>
    <label>Від<input name="from" type="date" value={from} disabled={busy} onChange={e=>{setFrom(e.target.value);changed();}} required/></label>
    <label>До<input name="to" type="date" value={to} disabled={busy} onChange={e=>{setTo(e.target.value);changed();}} required/></label>
    <label>Курс<CustomSelect name="course" label="Курс" value={course} disabled={busy} options={[{value:'',label:'Усі курси'},...[1,2,3,4].map(c=>({value:String(c),label:`${c} курс`}))]} onChange={v=>{setCourse(v);setGroup('');setStudent('');changed();}}/></label>
    <label className="filter-wide">Спеціальність<CustomSelect name="specialty" label="Спеціальність" value={specialty} disabled={busy} options={[{value:'',label:'Усі спеціальності'},...specialties.map(s=>({value:s.id,label:s.name}))]} onChange={v=>{setSpecialty(v);setGroup('');setStudent('');changed();}}/></label>
    <label>Група<CustomSelect name="group" label="Група" value={group} disabled={busy} options={[{value:'',label:'Усі групи'},...groups.map(g=>({value:g.id,label:g.name}))]} onChange={v=>{setGroup(v);setStudent('');changed();}}/></label>
    <label className="filter-wide">Студент / студентка<CustomSelect name="student" label="Студент / студентка" value={student} disabled={busy} options={[{value:'',label:'Усі студенти'},...students.map(s=>({value:s.id,label:s.fullName}))]} onChange={v=>{setStudent(v);changed();}}/></label>
    <label>Поріг<CustomSelect name="threshold" label="Поріг" value={threshold} disabled={busy} options={[{value:'',label:'Усі показники'},{value:'70',label:'Нижче 70%'},{value:'50',label:'Нижче 50%'}]} onChange={v=>{setThreshold(v);changed();}}/></label>
    <button className="button" disabled={busy||!faculty}>{busy?'Створення...':'Створити звіт'}</button>
    {message&&<p className={error?'error-text':'form-success'} role={error?'alert':'status'} style={{width:'100%'}}>{message}</p>}
  </form></>;
}
