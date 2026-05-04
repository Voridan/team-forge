import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProblemDetails } from '../errors/problem-details';
import { HttpExceptionFilter } from './http-exception.filter';

function makeHost({ url, method }: { url: string; method?: string }): {
  host: ArgumentsHost;
  res: jest.Mocked<Response>;
} {
  const status = jest.fn().mockReturnThis();
  const type = jest.fn().mockReturnThis();
  const json = jest.fn();
  const res = { status, type, json } as unknown as jest.Mocked<Response>;
  const req = { url, method: method ?? 'GET' } as Request;

  const host = {
    switchToHttp: () => ({
      getRequest: <T>() => req as T,
      getResponse: <T>() => res as T,
      getNext: <T>() => undefined as T,
    }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getType: () => 'http' as const,
    switchToRpc: () => ({}) as never,
    switchToWs: () => ({}) as never,
  } as unknown as ArgumentsHost;

  return { host, res };
}

function captured(res: jest.Mocked<Response>): ProblemDetails {
  return (res.json.mock.calls[0]?.[0] as ProblemDetails) ?? ({} as ProblemDetails);
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('formats UnauthorizedException as authentication problem', () => {
    const { host, res } = makeHost({ url: '/api/v1/users/me' });

    filter.catch(new UnauthorizedException('Missing bearer token'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(res.type).toHaveBeenCalledWith('application/problem+json');

    const problem = captured(res);
    expect(problem.title).toBe('Authentication Error');
    expect(problem.type).toContain('authentication-error');
    expect(problem.status).toBe(401);
    expect(problem.detail).toBe('Missing bearer token');
    expect(problem.instance).toBe('/api/v1/users/me');
    expect(problem.errors).toBeUndefined();
  });

  it('formats ForbiddenException as authorization problem', () => {
    const { host, res } = makeHost({ url: '/api/v1/teams/123' });

    filter.catch(new ForbiddenException('Requires ADMIN role or higher'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(captured(res).type).toContain('authorization-error');
  });

  it('formats NotFoundException with the resource-not-found type', () => {
    const { host, res } = makeHost({ url: '/api/v1/users/abc' });

    filter.catch(new NotFoundException('User not found'), host);

    const problem = captured(res);
    expect(problem.status).toBe(404);
    expect(problem.type).toContain('resource-not-found');
  });

  it('formats ConflictException with the conflict type', () => {
    const { host, res } = makeHost({ url: '/api/v1/auth/register' });

    filter.catch(new ConflictException('Email already in use'), host);

    expect(captured(res).type).toContain('conflict-error');
    expect(captured(res).status).toBe(409);
  });

  it('lifts structured field errors from a BadRequestException into the validation problem', () => {
    const { host, res } = makeHost({ url: '/api/v1/auth/register' });

    filter.catch(
      new BadRequestException({
        message: 'Validation failed',
        errors: [
          { field: 'email', code: 'IS_EMAIL', message: 'must be an email' },
          { field: 'password', code: 'MIN_LENGTH', message: 'too short' },
        ],
      }),
      host,
    );

    const problem = captured(res);
    expect(problem.type).toContain('validation-error');
    expect(problem.title).toBe('Validation Error');
    expect(problem.errors).toHaveLength(2);
    expect(problem.errors?.[0]).toEqual({
      field: 'email',
      code: 'IS_EMAIL',
      message: 'must be an email',
    });
  });

  it('treats a plain BadRequestException without structured errors as bad-request, not validation', () => {
    const { host, res } = makeHost({ url: '/x' });

    filter.catch(new BadRequestException('Bad input'), host);

    const problem = captured(res);
    expect(problem.type).toContain('bad-request');
    expect(problem.title).toBe('Bad Request');
    expect(problem.errors).toBeUndefined();
  });

  it('catches non-HttpException throwables as 500 internal-error and logs them', () => {
    const { host, res } = makeHost({ url: '/x' });

    filter.catch(new Error('boom'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const problem = captured(res);
    expect(problem.title).toBe('Internal Error');
    expect(problem.detail).toBe('An unexpected error occurred');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('does not log 4xx errors as errors', () => {
    const { host } = makeHost({ url: '/x' });

    filter.catch(new BadRequestException('Bad input'), host);

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
