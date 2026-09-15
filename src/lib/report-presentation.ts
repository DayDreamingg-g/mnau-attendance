import {DateTime} from 'luxon';
import type {ReportFilters,ReportKind} from './report-types';
import {teacherIdentity} from './teacher-identity';
export function scopedTeacherLabel(teachers:({id:string;displayName:string;position?:string|null}|null)[]){
 const first=teachers[0];if(!first||teachers.some(t=>t?.id!==first.id))return undefined;
 const identity=teacherIdentity(first.displayName,first.position);return {name:identity.name,position:identity.positionLabel};
}
export function readableRange(from:string,to:string){return `${DateTime.fromISO(from).setLocale('uk').toFormat('dd LLL yyyy')} — ${DateTime.fromISO(to).setLocale('uk').toFormat('dd LLL yyyy')}`;}
export function selectedPeriod(kind:ReportKind,value:string){
 const date=kind==='WEEKLY'?DateTime.fromISO(value+'-1'):DateTime.fromISO(value+(kind==='MONTHLY'?'-01':''));
 if(!date.isValid)return null;
 return {from:date.startOf(kind==='WEEKLY'?'week':'month').toISODate()!,to:date.endOf(kind==='WEEKLY'?'week':'month').toISODate()!};
}
export function reportTitle(kind:string,filters?:Pick<ReportFilters,'view'>|null){return `${({DAILY:'День',WEEKLY:'Тиждень',MONTHLY:'Місяць',SEMESTER:'Семестр',CUSTOM:'Довільний період'} as Record<string,string>)[kind]??kind} · ${filters?.view==='LESSONS'?'Пари':'Студенти'}`;}
