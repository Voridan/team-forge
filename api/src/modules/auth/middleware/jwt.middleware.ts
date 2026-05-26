import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { JwtPayload } from '../types/auth.types';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  private readonly logger = new Logger(JwtMiddleware.name);

  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const token = this.extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      req.user = { id: payload.sub, email: payload.email };
      next();
    } catch (err) {
      this.logger.debug(`JWT verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractBearerToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
    return token;
  }
}
