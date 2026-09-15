import Link from 'next/link';
import {demoEnabled} from '@/lib/time';
import type {ReactNode} from 'react';

import {percent} from '@/lib/metrics';
import {sortRows} from '@/lib/sorting';
import {SortHeader} from './sort-header';
import {LinkedRow} from './linked-row';

import {
  filterLink,
  type Filters,
} from '@/lib/filters';

import type {
  Analytics,
} from '@/lib/analytics';

type StudentRow=
  Analytics['students'][number];

export function Panel({
  title,
  action,
  children,
  className='',
}:{
  title?:string;
  action?:ReactNode;
  children:ReactNode;
  className?:string;
}){
  return <section
    className={`panel ${className}`}
  >
    {title&&
      <div className="panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
    }

    {children}
  </section>;
}

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}:{
  eyebrow?:string;
  title:string;
  description?:string;
  action?:ReactNode;
}){
  return <div className="page-title">
    <div>
      {eyebrow&&
        <p className="eyebrow">
          {eyebrow} {demoEnabled()&&<span className="test-badge">TEST</span>}
        </p>
      }

      <h1>{title}</h1>

      {description&&
        <p className="muted">
          {description}
        </p>
      }
    </div>

    {action}
  </div>;
}

export function Empty({
  children='За обраними фільтрами даних немає.',
}:{
  children?:ReactNode;
}){
  return <div className="empty">
    <span className="empty-symbol">
      ≡
    </span>

    <p>{children}</p>
  </div>;
}

export function Percentage({
  value,
}:{
  value:number|null;
}){
  return <span
    className={`percentage ${
      value===null
        ?'muted'
        :value<50
          ?'danger'
          :value<70
            ?'warning'
            :'success'
    }`}
  >
    {percent(value)}
  </span>;
}

export function Status({
  value,
}:{
  value:string|null;
  pending?:boolean;
}){
  return <span
    className={`status status-${value??'UNMARKED'}`}
  >
    {
      value==='PRESENT'
        ?'• Присутність'
        :value==='N'
          ?'N · Відсутній'
          :value==='HV'
            ?'HV · Поважна'
            :value==='CANCELLED'
              ?'Скасовано'
              :'Не відмічено'
    }

  </span>;
}

export function Stats({
  data,
  filters,
}:{
  data:Analytics;
  filters?:Filters;
}){
  const stats=[
    {
      label:'Відвідуваність',
      value:percent(
        data.stats.percentage,
      ),
      detail:'Без поважних пропусків',
      accent:'primary',
    },
    {
      label:'Студенти',
      value:new Set(data.students.map(s=>s.id)).size,
      detail:`${data.groups.length} груп у вибірці`,
      accent:'',
    },
    {
      label:'Потребують уваги',
      value:data.below70,
      detail:'Нижче 70%, включно з критичними',
      accent:'warning',
      threshold:70,
    },
    {
      label:'Критичний показник',
      value:data.below50,
      detail:'Нижче 50%',
      accent:'danger',
      threshold:50,
    },
  ];

  return <div className="stats-grid">
    {stats.map(
      (stat)=>{
        const content=<>
          <p>{stat.label}</p>
          <strong>{stat.value}</strong>
          <small>{stat.detail}</small>
        </>;

        if(
          (stat.threshold||stat.label==='Студенти')&&
          filters
        ){
          return <Link
            className={`stat-card ${stat.accent}`}
            href={filterLink(
              '/students',
              filters,
              {
                threshold:stat.threshold,
                sort:stat.threshold?'percentage':filters.sort,
                order:stat.threshold?'asc':filters.order,
              },
            )}
            key={stat.label}
            aria-label={`${stat.label}. Відкрити список студентів.`}
            title="Відкрити список студентів"
          >
            {content}
          </Link>;
        }

        return <section
          className={`stat-card ${stat.accent}`}
          key={stat.label}
        >
          {content}
        </section>;
      },
    )}
  </div>;
}

export function Completion({
  data,
}:{
  data:Analytics;
}){
  return <div className="completion">
    <div>
      <strong>
        Заповнення журналів
      </strong>

      <span>
        {percent(data.stats.completion)} заповнено
      </span>
    </div>

    <div className="progress-track">
      <div
        style={{
          width:`${data.stats.completion??0}%`,
        }}
      />
    </div>

    <p className="muted small">
      {data.lessonCount} занять · {data.stats.marked} збережених відміток · {data.stats.unmarked} не відмічено
    </p>
  </div>;
}

export function StudentTable({
  students,
  filters,
  path='/students',
}:{
  students:Analytics['students'];
  filters:Filters;
  path?:string;
}){
  if(!students.length){
    return <Empty/>;
  }

  const sortedStudents=sortRows(students,filters,{
    student:s=>s.fullName, group:s=>s.groupName,
    present:s=>s.stats.PRESENT, n:s=>s.stats.N, hv:s=>s.stats.HV,
    unmarked:s=>s.stats.unmarked, pending:s=>s.stats.pending, percentage:s=>s.stats.percentage,
  });

  return <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <SortHeader
            label="Студент / студентка"
            sortKey="student"
            filters={filters}
            path={path}
          />

          <SortHeader
            label="Група"
            sortKey="group"
            filters={filters}
            path={path}
          />

          <SortHeader
            label="•"
            sortKey="present"
            filters={filters}
            path={path}
          />

          <SortHeader
            label="N"
            sortKey="n"
            filters={filters}
            path={path}
          />

          <SortHeader
            label="HV"
            sortKey="hv"
            filters={filters}
            path={path}
          />

          <SortHeader
            label="Не відмічено"
            sortKey="unmarked"
            filters={filters}
            path={path}
          />

          <SortHeader
            label="Показник"
            sortKey="percentage"
            filters={filters}
            path={path}
          />
        </tr>
      </thead>

      <tbody>
        {sortedStudents.map(
          (student:StudentRow)=>
            <LinkedRow key={student.groupId+':'+student.id} href={filterLink(`/students/${student.id}`,filters,{student:student.id})}>
              <td>
                <Link
                  className="row-link"
                  href={filterLink(
                    `/students/${student.id}`,
                    filters,
                    {student:student.id},
                  )}
                >
                  {student.fullName}
                </Link>
              </td>

              <td>
                <Link
                  href={filterLink(
                    `/groups/${student.groupId}`,
                    filters,
                    {group:student.groupId,student:undefined},
                  )}
                >
                  {student.groupName}
                </Link>
              </td>

              <td className="success">
                {student.stats.PRESENT}
              </td>

              <td className="danger">
                {student.stats.N}
              </td>

              <td className="info">
                {student.stats.HV}
              </td>

              <td>
                {student.stats.unmarked}
              </td>

              <td>
                <Percentage
                  value={student.stats.percentage}
                />
              </td>
            </LinkedRow>,
        )}
      </tbody>
    </table>
  </div>;
}

export function FormulaNote(){
  return <p className="formula-note">
    Формула TEST: PRESENT / (PRESENT + N) × 100. HV виключено зі знаменника. Враховано збережені відмітки завершених, нескасованих занять. Це не офіційне положення МНАУ.
  </p>;
}

export function Breadcrumbs({
  items,
}:{
  items:{
    label:string;
    href?:string;
  }[];
}){
  return <nav
    className="breadcrumbs"
    aria-label="Навігаційний шлях"
  >
    {items.map(
      (
        item,
        index,
      )=>
        <span key={index}>
          {index>0&&
            <span className="crumb-separator">
              /
            </span>
          }

          {item.href
            ?<Link href={item.href}>
              {item.label}
            </Link>
            :item.label
          }
        </span>,
    )}
  </nav>;
}
