import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { AuthProvider, User } from '../../../generated/prisma/client';
import { EnvironmentVariables } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OAuthProviderRegistry } from './oauth/oauth-provider.registry';
import { JwtPayload, TokenPair } from './types/auth.types';

const BCRYPT_COST = 10;
const REFRESH_TOKEN_BYTES = 48;

interface NewRefreshToken {
  plaintext: string;
  data: { userId: string; tokenHash: string; expiresAt: Date };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly oauthRegistry: OAuthProviderRegistry,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        authProvider: AuthProvider.LOCAL,
        passwordHash,
      },
    });

    const tokens = await this.issueTokenPair(user);
    return { user: toPublicUser(user), tokens };
  }

  async login(dto: LoginDto): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.authProvider !== AuthProvider.LOCAL || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokenPair(user);
    return { user: toPublicUser(user), tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      this.logger.warn(
        `Reuse detected on revoked refresh token for user ${stored.userId}; revoking all sessions`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const newToken = this.buildRefreshToken(stored.userId);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({ data: newToken.data }),
    ]);

    const accessToken = this.signAccessToken(stored.user);
    return { accessToken, refreshToken: newToken.plaintext };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async oauthLogin(
    providerName: string,
    idToken: string,
  ): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const provider = this.oauthRegistry.get(providerName);
    const profile = await provider.verifyIdToken(idToken);

    let user = await this.prisma.user.findUnique({
      where: {
        authProvider_externalId: {
          authProvider: provider.authProvider,
          externalId: profile.externalId,
        },
      },
    });

    if (!user) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (emailTaken) {
        throw new ConflictException(
          'Email already registered with a different authentication method',
        );
      }

      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          authProvider: provider.authProvider,
          externalId: profile.externalId,
        },
      });
    }

    const tokens = await this.issueTokenPair(user);
    return { user: toPublicUser(user), tokens };
  }

  private async issueTokenPair(user: User): Promise<TokenPair> {
    const accessToken = this.signAccessToken(user);
    const newToken = this.buildRefreshToken(user.id);
    await this.prisma.refreshToken.create({ data: newToken.data });
    return { accessToken, refreshToken: newToken.plaintext };
  }

  private signAccessToken(user: User): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload, {
      expiresIn: this.config.get('JWT_ACCESS_EXPIRY', { infer: true }),
    });
  }

  private buildRefreshToken(userId: string): NewRefreshToken {
    const plaintext = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const tokenHash = hashToken(plaintext);
    const expiresAt = new Date(
      Date.now() + parseDurationMs(this.config.get('JWT_REFRESH_EXPIRY', { infer: true })),
    );
    return { plaintext, data: { userId, tokenHash, expiresAt } };
  }
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
  };
}

function hashToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

function parseDurationMs(input: string): number {
  const match = input.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration: ${input}`);
  const [, num, unit] = match;
  const multiplier = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return Number(num) * multiplier;
}
