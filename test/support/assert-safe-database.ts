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

  if (parsed.hostname.toLowerCase().includes('neon.tech')) {
    throw new Error(
      `Refusing to run tests against shared Neon database (${parsed.hostname}).`,
    );
  }
}
