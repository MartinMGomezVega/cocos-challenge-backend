import { DomainError, DomainErrorKind } from './domain-error';

describe('DomainError', () => {
  it('stores code, message and kind and extends Error', () => {
    const kinds: DomainErrorKind[] = [
      'VALIDATION',
      'NOT_FOUND',
      'CONFLICT',
      'UNPROCESSABLE',
    ];

    for (const kind of kinds) {
      const error = new DomainError('SOME_CODE', 'Something went wrong', kind);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('SOME_CODE');
      expect(error.message).toBe('Something went wrong');
      expect(error.kind).toBe(kind);
      expect(error.name).toBe('DomainError');
    }
  });
});
