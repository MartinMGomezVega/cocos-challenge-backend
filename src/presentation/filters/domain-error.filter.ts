import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainError, DomainErrorKind } from '../../domain/shared/domain-error';

const KIND_TO_HTTP_STATUS: Record<DomainErrorKind, HttpStatus> = {
  VALIDATION: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  UNPROCESSABLE: HttpStatus.UNPROCESSABLE_ENTITY,
};

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = KIND_TO_HTTP_STATUS[exception.kind];

    response.status(status).json({
      code: exception.code,
      message: exception.message,
    });
  }
}
