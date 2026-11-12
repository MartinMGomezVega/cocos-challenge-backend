import { ArgumentsHost } from '@nestjs/common';
import { DomainError, DomainErrorKind } from '../../domain/shared/domain-error';
import { DomainErrorFilter } from './domain-error.filter';

describe('DomainErrorFilter', () => {
  const cases: Array<{ kind: DomainErrorKind; expectedStatus: number }> = [
    { kind: 'VALIDATION', expectedStatus: 400 },
    { kind: 'NOT_FOUND', expectedStatus: 404 },
    { kind: 'CONFLICT', expectedStatus: 409 },
    { kind: 'UNPROCESSABLE', expectedStatus: 422 },
  ];

  it.each(cases)(
    'maps kind $kind to HTTP status $expectedStatus with { code, message }',
    ({ kind, expectedStatus }) => {
      const filter = new DomainErrorFilter();
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const host = {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
        }),
      } as unknown as ArgumentsHost;

      const error = new DomainError('TEST_ERROR', 'Test error message', kind);

      filter.catch(error, host);

      expect(status).toHaveBeenCalledWith(expectedStatus);
      expect(json).toHaveBeenCalledWith({
        code: 'TEST_ERROR',
        message: 'Test error message',
      });
    },
  );
});
