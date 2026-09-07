// Only temporary verification/preview databases are created here. No working env file is read.
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

export function isolatedEnvironment(overrides = {}) {
  return {
    ...process.env,
    DATABASE_URL: 'postgresql://postgres:unused@127.0.0.1:5543/mnau_attendance?schema=public',
    APP_ENV: 'demo',
    DEMO_MODE: 'true',
    DEMO_DATE: '2026-09-07',
    COOKIE_SECURE: 'false',
    REPORT_MACHINE_TOKEN: randomBytes(32).toString('hex'),
    REPORT_FACULTY_SLUG: 'management',
    MNAU_TEST_ISOLATED: 'true',
    NEXT_TELEMETRY_DISABLED: '1',
    APP_ORIGIN: 'http://localhost:3000',
    TEST_BASE_URL: 'http://127.0.0.1:3001',
    PORT: '3001',
    HOSTNAME: '127.0.0.1',
    ...overrides,
  };
}

export async function startTestDatabase() {
  // PGlite initially creates postgres; reconnect to a genuinely named application database.
  const initial = await PGlite.create();
  let snapshot;
  try {
    await initial.exec('CREATE DATABASE mnau_attendance');
    snapshot = await initial.dumpDataDir();
  } finally {
    await initial.close();
  }
  const db = await PGlite.create({ database: 'mnau_attendance', loadDataDir: snapshot });
  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 5543, maxConnections: 32 });
  try {
    await server.start();
  } catch (error) {
    await db.close();
    throw error;
  }
  return {
    db,
    async close() {
      await server.stop();
      // pglite-socket 0.2.11 schedules handleClose with setImmediate and stop() does not
      // await those detach callbacks. Keep the WASM database alive while they drain.
      await delay(100);
      await db.close();
    },
  };
}

export function runNode(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0
      ? resolve()
      : reject(new Error(`Stage failed: ${args.join(' ')} (${code ?? signal})`)));
  });
}

export function migrateTestDatabase(env) {
  // Prisma discovers and applies every migration, including migrations added after the initial schema.
  return runNode(['node_modules/prisma/build/index.js', 'migrate', 'deploy'], env);
}

export async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => {
    const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.once('exit', () => { clearTimeout(timeout); resolve(); });
    child.kill('SIGTERM');
  });
}
