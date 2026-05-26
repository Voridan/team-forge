import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  FieldError,
  ProblemDetails,
  ProblemTypes,
  statusToProblemMeta,
} from '../errors/problem-details';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const problem = this.buildProblem(exception, request);

    if (problem.status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${problem.status} ${problem.title}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }

  private buildProblem(exception: unknown, request: Request): ProblemDetails {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, request);
    }

    return {
      ...ProblemTypes.internal,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred',
      instance: request.url,
    };
  }

  private fromHttpException(exception: HttpException, request: Request): ProblemDetails {
    const status = exception.getStatus();
    const responseBody = exception.getResponse();
    const meta = statusToProblemMeta(status);

    const fieldErrors = this.extractFieldErrors(responseBody);
    const isValidation = status === HttpStatus.BAD_REQUEST && fieldErrors !== undefined;

    const problem: ProblemDetails = {
      type: isValidation ? ProblemTypes.validation.type : meta.type,
      title: isValidation ? ProblemTypes.validation.title : meta.title,
      status,
      detail: this.extractDetail(responseBody, exception.message),
      instance: request.url,
    };

    if (fieldErrors) {
      problem.errors = fieldErrors;
    }

    return problem;
  }

  private extractDetail(responseBody: unknown, fallback: string): string {
    if (typeof responseBody === 'string') return responseBody;
    if (responseBody && typeof responseBody === 'object') {
      const message = (responseBody as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
    return fallback;
  }

  private extractFieldErrors(responseBody: unknown): FieldError[] | undefined {
    if (!responseBody || typeof responseBody !== 'object') return undefined;
    const errors = (responseBody as { errors?: unknown }).errors;
    if (!Array.isArray(errors)) return undefined;
    if (
      errors.every(
        (e) =>
          e &&
          typeof e === 'object' &&
          typeof (e as FieldError).field === 'string' &&
          typeof (e as FieldError).code === 'string' &&
          typeof (e as FieldError).message === 'string',
      )
    ) {
      return errors as FieldError[];
    }
    return undefined;
  }
}
