import { assertSafeDatabase } from './assert-safe-database';

export default function globalSetup(): void {
  if (!process.env.DATABASE_URL) {
    process.loadEnvFile('.env.test');
  }
  assertSafeDatabase(process.env.DATABASE_URL);
}
