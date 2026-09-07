import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('journal data migration repairs partial rosters and preserves marks, provenance and existing audit',async()=>{
  const db=await PGlite.create();
  try{
    await db.exec(await readFile('prisma/migrations/202609060001_initial/migration.sql','utf8'));
    await db.exec(`
      INSERT INTO "Faculty" ("id","slug","name") VALUES ('f','f','Тестовий факультет');
      INSERT INTO "Specialty" ("id","name","facultyId","source") VALUES ('sp','Тест','f','{"test":true}');
      INSERT INTO "Group" ("id","name","course","specialtyId","source") VALUES ('a','А',3,'sp','{"test":true}'),('b','Б',3,'sp','{"test":true}');
      INSERT INTO "Student" ("id","fullName","groupId") VALUES ('sa','Тест А','a'),('sb','Тест Б','b');
      INSERT INTO "Subject" ("id","name","source") VALUES ('subject','Тест','{"test":true}');
      INSERT INTO "Building" ("id","abbreviation","source") VALUES ('building','тест','{"test":true}');
      INSERT INTO "Bell" ("id","pairNumber","startTime","endTime","source") VALUES ('bell',1,'08:30','09:50','test');
      INSERT INTO "SourceRecord" ("id","file","page","raw","bbox","data","issues") VALUES ('source','fixture.pdf',1,'Original source','[]','{}','[]');
      INSERT INTO "Lesson" ("id","startAt","endAt","pairNumber","subjectId","buildingId","room","bellId","sourceId","journalState","version","updatedAt")
      VALUES ('partial','2026-09-07T05:30Z','2026-09-07T06:50Z',1,'subject','building','1','bell','source','CONFIRMED',7,NOW()),
             ('full','2026-09-08T05:30Z','2026-09-08T06:50Z',1,'subject','building','1','bell','source','CONFIRMED',7,NOW());
      INSERT INTO "LessonGroup" ("lessonId","groupId") VALUES ('partial','a'),('partial','b'),('full','a'),('full','b');
      INSERT INTO "LessonStudent" ("lessonId","studentId") VALUES ('partial','sa'),('partial','sb'),('full','sa'),('full','sb');
      INSERT INTO "AttendanceStatus" ("code","label") VALUES ('PRESENT','Присутність');
      INSERT INTO "Attendance" ("lessonId","studentId","statusCode","confirmed","updatedAt") VALUES ('partial','sa','PRESENT',true,NOW()),('full','sa','PRESENT',true,NOW()),('full','sb','PRESENT',true,NOW());
      INSERT INTO "AuditLog" ("id","lessonId","objectType","objectId","newStatus","source") VALUES ('original-audit','partial','Attendance','partial:sa','PRESENT','TEACHER_CONFIRMATION');
    `);
    const attendance=await db.query('SELECT * FROM "Attendance" ORDER BY "lessonId", "studentId"');
    const provenance=await db.query('SELECT * FROM "SourceRecord"');
    const audit=await db.query('SELECT * FROM "AuditLog" WHERE "id" = \'original-audit\'');
    const migration=await readFile('prisma/migrations/202609060002_complete_roster_journal_state/migration.sql','utf8');
    await db.exec(migration);
    assert.deepEqual((await db.query('SELECT "id", "journalState", "version" FROM "Lesson" ORDER BY "id"')).rows,[{id:'full',journalState:'CONFIRMED',version:7},{id:'partial',journalState:'DRAFT',version:8}]);
    assert.deepEqual((await db.query('SELECT * FROM "Attendance" ORDER BY "lessonId", "studentId"')).rows,attendance.rows);
    assert.deepEqual((await db.query('SELECT * FROM "SourceRecord"')).rows,provenance.rows);
    assert.deepEqual((await db.query('SELECT * FROM "AuditLog" WHERE "id" = \'original-audit\'')).rows,audit.rows);
    assert.equal((await db.query('SELECT * FROM "AuditLog" WHERE "source" = \'JOURNAL_STATE_REPAIR\'')).rows.length,1);
    await db.exec(migration);
    assert.equal((await db.query('SELECT * FROM "AuditLog"')).rows.length,2);
  }finally{await db.close();}
});
