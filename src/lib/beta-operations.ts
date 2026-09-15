import {db} from './db';
import {resolveCSGroups,isCSSpecialty} from './cs-structure';
import type {Prisma} from '../generated/prisma/client';

export const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function assertBetaDatabase(client:Prisma.TransactionClient=db){
  if(process.env.APP_ENV!=='demo'||process.env.DEMO_MODE!=='true'||process.env.DEMO_DATE)throw new Error('Requires APP_ENV=demo, DEMO_MODE=true and real clock (DEMO_DATE empty).');
  const expected=process.env.BETA_DATABASE_NAME?.trim()||'mnau_attendance';
  const [database]=await client.$queryRaw<{name:string}[]>`SELECT current_database() AS name`;
  if(database?.name!==expected||!['mnau_attendance','railway'].includes(expected))throw new Error('Database guard failed. Check BETA_DATABASE_NAME for the intended environment.');
  if(expected==='railway'&&(process.env.BETA_DATABASE_NAME!=='railway'||process.env.APP_ORIGIN!=='https://mnau-attendance.up.railway.app'||process.env.COOKIE_SECURE!=='true'||!process.env.RAILWAY_SERVICE_ID))throw new Error('Railway requires the authorized service environment, HTTPS origin, secure cookies and explicit database name.');
  const groups=await resolveCSGroups(client);
  if(new Set(groups.map(g=>g.specialtyId)).size!==1||!groups.every(g=>isCSSpecialty(g.specialty.name)))throw new Error('Five existing groups must use one canonical CS specialty.');
  if(!await client.systemState.findUnique({where:{id:'cs-beta'}}))throw new Error('Existing CS TEST preparation marker is required. Do not run legacy seed/prepare.');
  return {database:database.name,groups};
}

export function operationMode(){
  const args=process.argv.slice(2);
  if(args.some(a=>!['--apply','--dry-run'].includes(a))||args.includes('--apply')&&args.includes('--dry-run'))throw new Error('Use --dry-run (default) or --apply. No arbitrary date/source override is allowed.');
  return args.includes('--apply');
}

export function assertLegacyFixture(){
  const url=new URL(process.env.DATABASE_URL??'postgresql://invalid');
  if(process.env.MNAU_TEST_ISOLATED!=='true'||!['localhost','127.0.0.1'].includes(url.hostname)||url.port!=='5543')throw new Error('Legacy seed/prepare/repair disabled. Use db:migrate, beta:import-complete-cs-roster and beta:backfill-cs-history. Legacy operations are only available to isolated regression fixtures.');
}
