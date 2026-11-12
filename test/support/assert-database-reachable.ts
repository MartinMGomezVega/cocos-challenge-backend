import { Client } from 'pg';

const CONNECTION_TIMEOUT_MS = 3000;

export async function assertDatabaseReachable(url: string): Promise<void> {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });

  try {
    await client.connect();
  } catch {
    throw new Error(
      'Test database is not reachable. Run `docker compose up -d db-test` before running database tests.',
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}
