import { shouldUseDatabaseSsl, validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('throws an error mentioning DATABASE_URL when DATABASE_URL is missing or empty', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ DATABASE_URL: '   ' })).toThrow(/DATABASE_URL/);
  });

  it('throws an error mentioning DATABASE_URL when DATABASE_URL is not a valid URL', () => {
    expect(() => validateEnv({ DATABASE_URL: 'not-a-url' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('returns validated config with default PORT 3000 when PORT is omitted or empty', () => {
    const result = validateEnv({
      DATABASE_URL: 'postgresql://cocos:cocos@localhost:5433/cocos_test',
    });

    expect(result).toEqual({
      DATABASE_URL: 'postgresql://cocos:cocos@localhost:5433/cocos_test',
      PORT: 3000,
    });

    const resultEmptyPort = validateEnv({
      DATABASE_URL: 'postgresql://cocos:cocos@localhost:5433/cocos_test',
      PORT: '',
    });

    expect(resultEmptyPort.PORT).toBe(3000);
  });

  it('parses a custom valid PORT', () => {
    const result = validateEnv({
      DATABASE_URL: 'postgresql://cocos:cocos@localhost:5433/cocos_test',
      PORT: '4000',
    });

    expect(result.PORT).toBe(4000);
  });

  it('throws an error mentioning PORT when PORT is invalid', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://cocos:cocos@localhost:5433/cocos_test',
        PORT: 'abc',
      }),
    ).toThrow(/PORT/);

    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://cocos:cocos@localhost:5433/cocos_test',
        PORT: '0',
      }),
    ).toThrow(/PORT/);

    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://cocos:cocos@localhost:5433/cocos_test',
        PORT: '70000',
      }),
    ).toThrow(/PORT/);
  });
});

describe('shouldUseDatabaseSsl', () => {
  it('returns false for localhost and 127.0.0.1', () => {
    expect(
      shouldUseDatabaseSsl(
        'postgresql://cocos:cocos@localhost:5433/cocos_test',
      ),
    ).toBe(false);
    expect(
      shouldUseDatabaseSsl(
        'postgresql://cocos:cocos@LOCALHOST:5433/cocos_test',
      ),
    ).toBe(false);
    expect(
      shouldUseDatabaseSsl(
        'postgresql://cocos:cocos@127.0.0.1:5433/cocos_test',
      ),
    ).toBe(false);
  });

  it('returns true for any non-local host', () => {
    expect(
      shouldUseDatabaseSsl('postgresql://user:pass@db.example.com:5432/prod'),
    ).toBe(true);
    expect(
      shouldUseDatabaseSsl('postgresql://user:pass@10.0.0.5:5432/prod'),
    ).toBe(true);
  });
});
