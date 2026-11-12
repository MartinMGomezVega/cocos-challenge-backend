export type DomainErrorKind =
  'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'UNPROCESSABLE';

export class DomainError extends Error {
  readonly code: string;
  readonly kind: DomainErrorKind;

  constructor(code: string, message: string, kind: DomainErrorKind) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.kind = kind;
  }
}
