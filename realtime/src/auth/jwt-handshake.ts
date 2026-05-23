import * as jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import type { AuthenticatedUser, JwtPayload } from './jwt-payload';

const BEARER_PREFIX = 'Bearer ';

declare module 'socket.io' {
  interface SocketData {
    user?: AuthenticatedUser;
  }
}

/**
 * Validates the JWT presented at handshake time.
 *
 * Order of precedence for the token:
 *   1. `socket.handshake.auth.token` (set by the official socket.io-client `auth` option)
 *   2. `Authorization: Bearer <token>` header
 *
 * Verifies with HS256 against the shared JWT_SECRET. On success, attaches a
 * minimal `AuthenticatedUser` to `socket.data.user`. On any failure (missing,
 * malformed, wrong secret, expired) the connection is rejected — the rejection
 * surfaces as `connect_error` on the client side.
 *
 * Per-event JWT validation is intentionally skipped: we treat the handshake as
 * the authenticated boundary. Access tokens are short-lived (15m by default);
 * when one expires the socket is disconnected by the client's refresh flow,
 * and a fresh token is presented on reconnect.
 */
export function jwtHandshake(secret: string) {
  return (socket: Socket, next: (err?: Error) => void): void => {
    const token = extractToken(socket);
    if (!token) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
      socket.data.user = { id: payload.sub, email: payload.email };
      next();
    } catch {
      // Don't leak which check failed — every auth failure looks the same.
      next(new Error('UNAUTHORIZED'));
    }
  };
}

function extractToken(socket: Socket): string | null {
  const fromAuth = socket.handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith(BEARER_PREFIX)) {
    const token = header.slice(BEARER_PREFIX.length);
    return token.length > 0 ? token : null;
  }
  return null;
}
