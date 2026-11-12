import { assertDatabaseReachable } from './assert-database-reachable';
import { assertSafeDatabase } from './assert-safe-database';

export default async function globalSetupDb(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    process.loadEnvFile('.env.test');
  }
  assertSafeDatabase(process.env.DATABASE_URL);
  await assertDatabaseReachable(process.env.DATABASE_URL!);
}
