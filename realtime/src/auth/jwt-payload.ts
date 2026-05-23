/**
 * Mirror of api/src/modules/auth/types/auth.types.ts → JwtPayload.
 * Both services validate the same HS256 JWTs signed with JWT_SECRET.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}
