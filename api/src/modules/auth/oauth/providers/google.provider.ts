import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import jwksClient, { JwksClient } from 'jwks-rsa';
import { AuthProvider } from '../../../../../generated/prisma/client';
import { EnvironmentVariables } from '../../../../config/env.validation';
import { NormalizedOAuthProfile, OAuthProvider } from '../oauth.types';

const GOOGLE_ISSUERS: [string, ...string[]] = [
  'https://accounts.google.com',
  'accounts.google.com',
];
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';

interface GoogleIdTokenPayload extends jwt.JwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

@Injectable()
export class GoogleProvider implements OAuthProvider, OnModuleInit {
  readonly name = 'google';
  readonly authProvider = AuthProvider.GOOGLE;
  private readonly logger = new Logger(GoogleProvider.name);
  private jwks!: JwksClient;
  private clientId!: string;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  onModuleInit(): void {
    this.clientId = this.config.get('GOOGLE_CLIENT_ID', { infer: true });
    this.jwks = jwksClient({
      jwksUri: GOOGLE_JWKS_URI,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  async verifyIdToken(idToken: string): Promise<NormalizedOAuthProfile> {
    const payload = await this.verifySignature(idToken);

    if (!payload.email) {
      throw new UnauthorizedException('Google ID token missing email claim');
    }
    if (payload.email_verified === false) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const { firstName, lastName } = splitName(payload.given_name, payload.family_name, payload.name);

    return {
      externalId: payload.sub,
      email: payload.email,
      firstName,
      lastName,
      avatarUrl: payload.picture,
    };
  }

  private verifySignature(token: string): Promise<GoogleIdTokenPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          if (!header.kid) {
            return callback(new Error('Token has no kid header'));
          }
          this.jwks.getSigningKey(header.kid, (err, key) => {
            if (err || !key) return callback(err ?? new Error('Signing key not found'));
            callback(null, key.getPublicKey());
          });
        },
        {
          algorithms: ['RS256'],
          issuer: GOOGLE_ISSUERS,
          audience: this.clientId,
        },
        (err, decoded) => {
          if (err) {
            this.logger.debug(`Google token verification failed: ${err.message}`);
            return reject(new UnauthorizedException('Invalid Google ID token'));
          }
          resolve(decoded as GoogleIdTokenPayload);
        },
      );
    });
  }
}

function splitName(
  given?: string,
  family?: string,
  fullName?: string,
): { firstName: string; lastName: string } {
  if (given || family) {
    return { firstName: given ?? '', lastName: family ?? '' };
  }
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
  }
  return { firstName: 'User', lastName: '' };
}
