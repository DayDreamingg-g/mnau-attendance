// Import before any test module; integration tests mutate fixtures and may never use a working DB.
let databaseUrl;
try { databaseUrl = new URL(process.env.DATABASE_URL ?? ''); } catch { /* rejected below */ }
if (
  process.env.MNAU_TEST_ISOLATED !== 'true' ||
  process.env.APP_ENV !== 'demo' ||
  process.env.DEMO_MODE !== 'true' ||
  databaseUrl?.hostname !== '127.0.0.1' ||
  databaseUrl?.port !== '5543' ||
  databaseUrl?.pathname !== '/mnau_attendance'
) {
  throw new Error('Integration tests require the isolated verification harness. Run npm run test:integration.');
}
