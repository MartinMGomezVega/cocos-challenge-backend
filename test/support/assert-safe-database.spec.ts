import { assertSafeDatabase } from './assert-safe-database';

describe('assertSafeDatabase', () => {
  it('throws if DATABASE_URL is undefined or empty', () => {
    expect(() => assertSafeDatabase(undefined)).toThrow(/DATABASE_URL/);
    expect(() => assertSafeDatabase('')).toThrow(/DATABASE_URL/);
    expect(() => assertSafeDatabase('   ')).toThrow(/DATABASE_URL/);
  });

  it('throws if DATABASE_URL is not a valid URL', () => {
    expect(() => assertSafeDatabase('not-a-valid-url')).toThrow(/DATABASE_URL/);
  });

  it('aborts if DATABASE_URL host contains neon.tech', () => {
    expect(() =>
      assertSafeDatabase('postgresql://u:p@ep-cool-sky-123.neon.tech/neondb'),
    ).toThrow(/neon\.tech/i);
    expect(() =>
      assertSafeDatabase('postgresql://u:p@NEON.TECH:5432/neondb'),
    ).toThrow(/neon\.tech/i);
  });

  it('passes for localhost and 127.0.0.1', () => {
    expect(() =>
      assertSafeDatabase('postgresql://cocos:cocos@localhost:5433/cocos_test'),
    ).not.toThrow();
    expect(() =>
      assertSafeDatabase('postgresql://cocos:cocos@127.0.0.1:5433/cocos_test'),
    ).not.toThrow();
  });
});
