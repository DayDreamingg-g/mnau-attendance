'use client';
import {useState} from 'react';
import {ActionDialog} from './action-dialog';
export function TermCreate({faculties}:{faculties:{id:string;name:string}[]}){
 const [from,setFrom]=useState('');
 return <ActionDialog title="Створити семестр" url="/api/terms" values={{action:'CREATE'}} label="Створити"><div className="form-grid"><label className="full-row">Назва<input name="name" required minLength={2} maxLength={100}/></label><label className="full-row">Факультет<select name="facultyId" required>{faculties.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Початок<input type="date" name="fromDate" required value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Завершення<input type="date" name="toDate" required min={from}/></label><label className="full-row">Склад студентів<select name="rosterMode"><option value="EMPTY">Без підтвердженого складу</option><option value="CURRENT_DRAFT">Використати поточний склад як чернетку</option></select></label></div><p className="small muted">Склад потрібно переглянути й підтвердити окремо перед роботою з новим семестром.</p></ActionDialog>;
}
