import type {Filters} from './filters';
import type {metrics} from './metrics';
export const reportKindLabels={DAILY:'Щоденне зведення',WEEKLY:'Тижневе зведення',MONTHLY:'Місячна атестація'} as const;
export type ReportKind=keyof typeof reportKindLabels;
export type ReportFilters=Filters & {student?:string};
export type ReportSummary={
  fingerprint:string;
  curators?:{id:string;name:string;groupId:string;groupName:string}[];
  scope:string;
  students:number;
  groups:number;
  stats:ReturnType<typeof metrics>;
  synthetic:boolean;
  below50:number;
  below70:{id:string;name:string;group:string;percentage:number;critical:boolean}[];
  rows:{id:string;fullName:string;groupId:string;groupName:string;course:number;specialtyName:string;stats:ReturnType<typeof metrics>}[];
};
