import { db } from '../src/lib/db';
try {console.log(await db.$queryRaw`SELECT current_database() AS database, current_schema() AS schema, current_user AS role`);console.log({groups:await db.group.count(),students:await db.student.count(),lessons:await db.lesson.count()});}finally{await db.$disconnect();}
