const ALLOWED_TEST_HOSTS = new Set(['localhost', '127.0.0.1']);

export function assertSafeDatabase(url: string | undefined): void {
  if (!url || url.trim() === '') {
    throw new Error('DATABASE_URL is required to run tests.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_TEST_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to run tests against non-local database (${parsed.hostname}). Only localhost and 127.0.0.1 are allowed.`,
    );
  }
}
