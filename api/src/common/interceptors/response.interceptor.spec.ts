import { CallHandler, ExecutionContext, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

function makeContext(statusCode: number): ExecutionContext {
  const res = { statusCode } as Response;
  return {
    switchToHttp: () => ({
      getResponse: <T>() => res as T,
      getRequest: <T>() => ({}) as T,
      getNext: <T>() => undefined as T,
    }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    getType: () => 'http' as const,
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToRpc: () => ({}) as never,
    switchToWs: () => ({}) as never,
  } as unknown as ExecutionContext;
}

function callHandlerOf<T>(value: T): CallHandler<T> {
  return { handle: () => of(value) };
}

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  it('wraps a returned object in a data envelope', async () => {
    const ctx = makeContext(HttpStatus.OK);
    const handler = callHandlerOf({ id: 'u1', email: 'a@b.com' });

    const result = await lastValueFrom(interceptor.intercept(ctx, handler));

    expect(result).toEqual({ data: { id: 'u1', email: 'a@b.com' } });
  });

  it('wraps an array result without flattening it', async () => {
    const ctx = makeContext(HttpStatus.OK);
    const handler = callHandlerOf([1, 2, 3]);

    const result = await lastValueFrom(interceptor.intercept(ctx, handler));

    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('emits undefined for 204 No Content responses', async () => {
    const ctx = makeContext(HttpStatus.NO_CONTENT);
    const handler = callHandlerOf({ shouldNotAppear: true });

    const result = await lastValueFrom(interceptor.intercept(ctx, handler));

    expect(result).toBeUndefined();
  });

  it('emits undefined when the handler returned undefined', async () => {
    const ctx = makeContext(HttpStatus.OK);
    const handler = callHandlerOf(undefined);

    const result = await lastValueFrom(interceptor.intercept(ctx, handler));

    expect(result).toBeUndefined();
  });
});
