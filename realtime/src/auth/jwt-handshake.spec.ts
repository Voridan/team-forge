import * as jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import { jwtHandshake } from './jwt-handshake';

const SECRET = 'test-secret-at-least-thirty-two-chars-long';

function makeSocket(opts: {
  authToken?: string;
  authHeader?: string;
}): Socket {
  return {
    handshake: {
      auth: opts.authToken ? { token: opts.authToken } : {},
      headers: opts.authHeader ? { authorization: opts.authHeader } : {},
    },
    data: {} as Socket['data'],
  } as unknown as Socket;
}

function signValid(claims: object = {}): string {
  return jwt.sign(
    { sub: 'user-123', email: 'a@b.com', ...claims },
    SECRET,
    { algorithm: 'HS256', expiresIn: '15m' },
  );
}

describe('jwtHandshake', () => {
  it('rejects when neither auth.token nor Authorization header is present', () => {
    const socket = makeSocket({});
    const next = jest.fn();
    jwtHandshake(SECRET)(socket, next);
    expect(next).toHaveBeenCalledWith(new Error('UNAUTHORIZED'));
    expect(socket.data.user).toBeUndefined();
  });

  it('rejects a non-bearer Authorization header', () => {
    const socket = makeSocket({ authHeader: 'Basic abc123' });
    const next = jest.fn();
    jwtHandshake(SECRET)(socket, next);
    expect(next).toHaveBeenCalledWith(new Error('UNAUTHORIZED'));
  });

  it('rejects an empty Bearer token', () => {
    const socket = makeSocket({ authHeader: 'Bearer ' });
    const next = jest.fn();
    jwtHandshake(SECRET)(socket, next);
    expect(next).toHaveBeenCalledWith(new Error('UNAUTHORIZED'));
  });

  it('rejects a malformed JWT', () => {
    const socket = makeSocket({ authToken: 'not.a.jwt' });
    const next = jest.fn();
    jwtHandshake(SECRET)(socket, next);
    expect(next).toHaveBeenCalledWith(new Error('UNAUTHORIZED'));
  });

  it('rejects a JWT signed with the wrong secret', () => {
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com' }, 'other-secret-thirty-two-chars-long', {
      algorithm: 'HS256',
    });
    const socket = makeSocket({ authToken: token });
    const next = jest.fn();
    jwtHandshake(SECRET)(socket, next);
    expect(next).toHaveBeenCalledWith(new Error('UNAUTHORIZED'));
  });

  it('rejects an expired JWT', () => {
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, {
      algorithm: 'HS256',
    });
    const socket = makeSocket({ authToken: token });
    const next = jest.fn();
    jwtHandshake(SECRET)(socket, next);
    expect(next).toHaveBeenCalledWith(new Error('UNAUTHORIZED'));
  });

  it('accepts a valid token from socket.handshake.auth.token and attaches the user', () => {
    const socket = makeSocket({ authToken: signValid() });
    const next = jest.fn();
    jwtHandshake(SECRET)(socket, next);
    expect(next).toHaveBeenCalledWith(); // called with no args = success
    expect(socket.data.user).toEqual({ id: 'user-123', email: 'a@b.com' });
  });

  it('accepts a valid token from the Authorization header as fallback', () => {
    const token = signValid();
    const socket = makeSocket({ authHeader: `Bearer ${token}` });
    const next = jest.fn();
    jwtHandshake(SECRET)(socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toEqual({ id: 'user-123', email: 'a@b.com' });
  });

  it('prefers auth.token over Authorization header when both are present', () => {
    const authToken = signValid({ sub: 'from-auth' });
    const headerToken = signValid({ sub: 'from-header' });
    const socket = makeSocket({
      authToken,
      authHeader: `Bearer ${headerToken}`,
    });
    const next = jest.fn();
    jwtHandshake(SECRET)(socket, next);
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user?.id).toBe('from-auth');
  });

  it('does not allow algorithm=none — only HS256 is accepted', () => {
    // jsonwebtoken refuses to sign with `none` algorithm directly. We construct
    // the token manually to simulate an attacker stripping the signature.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'attacker', email: 'a@b.com' })).toString('base64url');
    const token = `${header}.${payload}.`;
    const socket = makeSocket({ authToken: token });
    const next = jest.fn();
    jwtHandshake(SECRET)(socket, next);
    expect(next).toHaveBeenCalledWith(new Error('UNAUTHORIZED'));
  });
});
