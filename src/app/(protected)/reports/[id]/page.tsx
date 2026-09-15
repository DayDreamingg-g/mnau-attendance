import Link from 'next/link';
import {notFound} from 'next/navigation';
import {assertSavedReportAccess} from '@/lib/report-access';
import {parseFilters,filterLink,type Search} from '@/lib/filters';
import {reportTitle,readableRange} from '@/lib/report-presentation';
import type {ReportSummary,ReportFilters} from '@/lib/report-types';
import {ReportPreview} from '@/components/report-preview';
import {requireUser} from '@/lib/auth';
import {reportScope} from '@/lib/access';
import {db} from '@/lib/db';
import {PageTitle,Breadcrumbs,FormulaNote} from '@/components/ui';
export default async function ReportPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Search>}){
 const u=await requireUser(),{id}=await params,f=parseFilters(await searchParams);
 const report=await db.report.findFirst({where:{AND:[{id},reportScope(u)]},select:{id:true,facultyId:true,kind:true,state:true,fromDate:true,toDate:true,error:true,summary:true,filters:true,faculty:{select:{name:true}}}});if(!report)notFound();await assertSavedReportAccess(u,report);
 const summary=report.summary as unknown as ReportSummary|null,reportFilters={...(report.filters as ReportFilters),from:report.fromDate,to:report.toDate};
 return <><Breadcrumbs items={[{label:'Звіти',href:filterLink('/reports',f)},{label:'Деталі звіту'}]}/><PageTitle eyebrow="ЗБЕРЕЖЕНИЙ ЗВІТ" title={reportTitle(report.kind,reportFilters)} description={report.faculty.name+' · '+readableRange(report.fromDate,report.toDate)} action={report.state==='READY'&&<div className="report-actions"><a className="button primary" href={'/api/reports/'+id+'/pdf'}>PDF</a><a className="button" href={'/api/reports/'+id+'/csv'}>CSV</a><a className="button" href={'/api/reports/'+id+'/xlsx'}>XLSX</a></div>}/>{summary&&<ReportPreview summary={summary} filters={reportFilters}/>} {report.state!=='READY'&&<p className="form-error">{report.state==='FAILED'?report.error:'Звіт формується. Оновіть сторінку пізніше.'}</p>}<Link className="text-link" href="/reports">← До списку звітів</Link><FormulaNote/></>;
}
