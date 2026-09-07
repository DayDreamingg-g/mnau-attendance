import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const globalDb = globalThis as unknown as { attendanceDb?: PrismaClient };
function createClient() {
  const connectionString=process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const adapter = new PrismaPg({ connectionString, max: 8, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 }, { schema: 'public' });
  return new PrismaClient({ adapter });
}
export const db = globalDb.attendanceDb ?? createClient();
if (process.env.NODE_ENV !== 'production') globalDb.attendanceDb = db;
