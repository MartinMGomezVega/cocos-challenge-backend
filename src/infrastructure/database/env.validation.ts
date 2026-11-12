export interface ValidatedEnv {
  DATABASE_URL: string;
  PORT: number;
}

const DEFAULT_PORT = 3000;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const rawDatabaseUrl = config.DATABASE_URL;
  if (typeof rawDatabaseUrl !== 'string' || rawDatabaseUrl.trim() === '') {
    throw new Error('Environment variable DATABASE_URL is required.');
  }

  const databaseUrl = rawDatabaseUrl.trim();
  try {
    new URL(databaseUrl);
  } catch {
    throw new Error('Environment variable DATABASE_URL must be a valid URL.');
  }

  const rawPort = config.PORT;
  if (rawPort === undefined || rawPort === null || rawPort === '') {
    return {
      DATABASE_URL: databaseUrl,
      PORT: DEFAULT_PORT,
    };
  }

  const parsedPort = Number(rawPort);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error(
      'Environment variable PORT must be an integer between 1 and 65535.',
    );
  }

  return {
    DATABASE_URL: databaseUrl,
    PORT: parsedPort,
  };
}

export function shouldUseDatabaseSsl(databaseUrl: string): boolean {
  const { hostname } = new URL(databaseUrl);
  return !LOCAL_HOSTS.has(hostname.toLowerCase());
}
