import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { JwtMiddleware } from './jwt.middleware';

describe('JwtMiddleware', () => {
  let middleware: JwtMiddleware;
  let jwtService: JwtService;
  let next: NextFunction;
  const res = {} as Response;

  beforeEach(() => {
    jwtService = new JwtService({ secret: 'test-secret-at-least-thirty-two-chars' });
    middleware = new JwtMiddleware(jwtService);
    next = jest.fn();
  });

  function makeReq(authHeader?: string): Request {
    return {
      headers: authHeader ? { authorization: authHeader } : {},
    } as Request;
  }

  it('throws when authorization header is missing', () => {
    expect(() => middleware.use(makeReq(), res, next)).toThrow(UnauthorizedException);
    expect(next).not.toHaveBeenCalled();
  });

  it('throws on a non-bearer scheme', () => {
    expect(() => middleware.use(makeReq('Basic abc123'), res, next)).toThrow(
      UnauthorizedException,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('throws when bearer scheme has no token', () => {
    expect(() => middleware.use(makeReq('Bearer'), res, next)).toThrow(UnauthorizedException);
    expect(next).not.toHaveBeenCalled();
  });

  it('throws on a malformed JWT', () => {
    expect(() => middleware.use(makeReq('Bearer not.a.real.jwt'), res, next)).toThrow(
      UnauthorizedException,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('throws on a token signed with the wrong secret', () => {
    const otherJwt = new JwtService({ secret: 'different-secret-at-least-thirty-two-chars' });
    const token = otherJwt.sign({ sub: 'user-1', email: 'a@b.com' });

    expect(() => middleware.use(makeReq(`Bearer ${token}`), res, next)).toThrow(
      UnauthorizedException,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('throws on an expired token', () => {
    const token = jwtService.sign({ sub: 'user-1', email: 'a@b.com' }, { expiresIn: '-1s' });

    expect(() => middleware.use(makeReq(`Bearer ${token}`), res, next)).toThrow(
      UnauthorizedException,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches user to request and calls next on a valid token', () => {
    const token = jwtService.sign({ sub: 'user-1', email: 'alice@example.com' });
    const req = makeReq(`Bearer ${token}`);

    middleware.use(req, res, next);

    expect(req.user).toEqual({ id: 'user-1', email: 'alice@example.com' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
