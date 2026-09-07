// Standalone synthetic component fixtures. This module is never imported by the application.
import {createRoot} from 'react-dom/client';
import {AppRouterContext,type AppRouterInstance} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {CustomSelect} from '../src/components/custom-select';
import {ThemeToggle} from '../src/components/theme-toggle';
import {JournalEditor} from '../src/components/journal-editor';
import sourceGroups from '../source-data/groups.json';

const query=new URLSearchParams(window.location.search);
const specialties=[...new Set(sourceGroups.map(group=>group.specialty))];
const group=sourceGroups.find(item=>item.name==='Кн 3/1')??sourceGroups[0];
const rows=[
  {id:'fixture-student-1',name:'Тестова Студентка 01',group:group.name,status:null,confirmed:false,editable:true,canConfirm:true},
  {id:'fixture-student-2',name:'Тестовий Студент 02',group:group.name,status:'N' as const,confirmed:false,editable:true,canConfirm:true},
  {id:'fixture-student-3',name:'Тестова Студентка 03',group:group.name,status:'HV' as const,confirmed:true,editable:true,canConfirm:true},
  {id:'fixture-student-4',name:'Тестовий Студент 04',group:group.name,status:'PRESENT' as const,confirmed:true,editable:false,canConfirm:false},
];
const router:AppRouterInstance={
  back:()=>window.history.back(),forward:()=>window.history.forward(),
  refresh:()=>{},push:href=>window.location.assign(href),replace:href=>window.location.replace(href),
  prefetch:()=>{},bfcacheId:'synthetic-component-fixture',
};

function Fixture(){
  const mobile=query.get('mobile')==='true';
  const starosta=query.get('mode')==='starosta';
  const journalRows=starosta?rows.map(row=>({...row,canConfirm:false,editable:row.editable&&!row.confirmed})):rows;
  return <main className="content fixture-content">
    <header className="page-title"><div><p className="eyebrow">MNAU ATTENDANCE · UI CHECK</p><h1>Перевірка компонентів</h1><p className="muted">Лише синтетичні дані. Ця сторінка не підключена до застосунку або бази даних.</p></div><ThemeToggle/></header>
    <nav className="tabs" aria-label="Розмір перевірки"><a href="/fixture">Desktop</a><a href="/mobile" target={mobile?'_top':undefined}>Mobile 390 px</a><a href="/fixture?theme=light">Світла тема</a><a href="/fixture?theme=dark">Темна тема</a></nav>
    <form action="/fixture" method="get" className="filters">
      <label>Курс<CustomSelect name="course" label="Курс" defaultValue={query.get('course')??''} options={[{value:'',label:'Усі курси'},...[1,2,3,4].map(course=>({value:String(course),label:`${course} курс`}))]}/></label>
      <label>Від<input name="from" type="date" defaultValue={query.get('from')??'2026-09-01'} required/></label>
      <label>До<input name="to" type="date" defaultValue={query.get('to')??'2026-09-07'} required/></label>
      <label className="filter-wide">Спеціальність<CustomSelect name="specialty" label="Спеціальність" defaultValue={query.get('specialty')??''} options={[{value:'',label:'Усі спеціальності'},...specialties.map(name=>({value:name,label:name}))]}/></label>
      <label>Група<CustomSelect name="group" label="Група" defaultValue={query.get('group')??''} options={[{value:'',label:'Усі групи'},...sourceGroups.map(item=>({value:item.id,label:item.name}))]}/></label>
      {['threshold','sort','order'].map((key,index)=><input key={key} type="hidden" name={key} value={query.get(key)??['70','student','asc'][index]}/>)}
      {mobile&&<input type="hidden" name="mobile" value="true"/>}
      <button className="button primary" type="submit">Застосувати</button>
    </form>
    <section className="panel pad section-space" aria-label="Збережені параметри GET"><h2>Параметри після GET</h2><p className="muted small">Оберіть значення та натисніть «Застосувати». Перевірте, що дати, threshold і sort/order зберігаються.</p><output className="fixture-query">{query.toString()||'Параметри ще не застосовано'}</output></section>
    <section className="panel pad section-space"><h2>Додаткові стани</h2><div className="fixture-states">
      <form action="/fixture" method="get"><label>Обов’язкове значення<CustomSelect name="required" label="Обов’язкове значення" required defaultValue="" options={[{value:'',label:'Оберіть значення'},{value:'available',label:'Доступний варіант'},{value:'disabled',label:'Недоступний варіант',disabled:true}]}/></label><button type="submit" className="button">Перевірити обов’язковість</button></form>
      <label>Заблокований фільтр<CustomSelect label="Заблокований фільтр" disabled options={[{value:'disabled',label:'Недоступний фільтр'}]}/></label>
      <label>Порожній список<CustomSelect label="Порожній список" options={[]}/></label>
    </div></section>
    <section className="section-space"><h2>Журнал: синтетична перевірка</h2><p className="muted small">Можна змінювати локальні відмітки та відкрити підтвердження. Надсилання повертає тестову помилку: перевірте, що чернетка залишається у формі.</p></section>
    <AppRouterContext.Provider value={router}><JournalEditor key={query.get('mode')??'teacher'} lessonId="fixture-only" initialVersion={1} rows={journalRows} canConfirm={!starosta} needsReason={query.get('reason')==='true'}/></AppRouterContext.Provider>
    <p className="formula-note">Перелік назв груп і спеціальностей взято із source-data. Студенти та відмітки тут створені лише для візуальної перевірки; збереження не виконується.</p>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Fixture/>);
