import 'dotenv/config';
import {assertLegacyFixture} from '../src/lib/beta-operations';
import { createInterface } from 'node:readline/promises';
import { stdin,stdout } from 'node:process';
import {db} from '../src/lib/db';
import {demoEnabled} from '../src/lib/time';
assertLegacyFixture();
if(!demoEnabled()||process.env.APP_ENV==='production')throw new Error('Reset forbidden');
if(!stdin.isTTY)throw new Error('Reset requires an interactive terminal');
const rl=createInterface({input:stdin,output:stdout});
const answer=await rl.question('DESTRUCTIVE: erase all data in mnau_attendance ONLY? Type RESET MNAU ATTENDANCE: ');rl.close();
if(answer!=='RESET MNAU ATTENDANCE')throw new Error('Cancelled');
try{const rows=await db.$queryRaw<{name:string}[]>`SELECT current_database() AS name`;if(rows[0].name!=='mnau_attendance')throw new Error('Wrong database; reset blocked');await db.$executeRawUnsafe('TRUNCATE TABLE "Attendance", "AuditLog", "JournalSubmission", "LessonStudent", "LessonGroup", "Lesson", "Session", "UserRole", "StarostaAssignment", "SystemState", "CuratorAssignment", "DeanAssignment", "Report", "Student", "Teacher", "User", "Group", "Specialty", "Faculty", "SourceRecord", "Subject", "Bell", "Building", "LoginBucket", "AttendanceStatus", "Role" RESTART IDENTITY');console.log('Demo application data erased. Run db:seed explicitly.');}finally{await db.$disconnect();}
