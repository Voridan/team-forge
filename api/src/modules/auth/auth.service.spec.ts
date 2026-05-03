import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { AuthProvider, User } from '../../../generated/prisma/client';
import { AuthService } from './auth.service';
import { NormalizedOAuthProfile, OAuthProvider } from './oauth/oauth.types';

type MockPrisma = {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
  refreshToken: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

type MockRegistry = {
  get: jest.Mock<OAuthProvider, [string]>;
};

const baseUser: User = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Test',
  avatarUrl: null,
  timezone: null,
  status: 'OFFLINE',
  authProvider: AuthProvider.LOCAL,
  externalId: null,
  passwordHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sha256 = (input: string) => crypto.createHash('sha256').update(input).digest('hex');

function makeMockPrisma(): MockPrisma {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

function makeMockRegistry(): MockRegistry {
  return { get: jest.fn() };
}

function makeService(
  prisma: MockPrisma,
  registry: MockRegistry = makeMockRegistry(),
): { service: AuthService; jwtService: JwtService; registry: MockRegistry } {
  const jwtService = new JwtService({ secret: 'test-secret-at-least-thirty-two-chars' });
  const config = {
    get: jest.fn(
      (key: string) =>
        ({
          JWT_ACCESS_EXPIRY: '15m',
          JWT_REFRESH_EXPIRY: '7d',
        })[key],
    ),
  };
  const service = new AuthService(
    prisma as never,
    jwtService,
    config as never,
    registry as never,
  );
  return { service, jwtService, registry };
}

describe('AuthService', () => {
  let prisma: MockPrisma;
  let service: AuthService;
  let jwtService: JwtService;

  beforeEach(() => {
    prisma = makeMockPrisma();
    ({ service, jwtService } = makeService(prisma));
  });

  describe('register', () => {
    const dto = {
      email: 'new@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
    };

    it('creates a user with hashed password and issues a token pair', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...baseUser, email: dto.email });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.email).toBe(dto.email);
      expect(createArgs.data.authProvider).toBe(AuthProvider.LOCAL);
      expect(createArgs.data.passwordHash).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, createArgs.data.passwordHash)).toBe(true);

      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
      expect(result.user).not.toHaveProperty('passwordHash');

      const decoded = jwtService.verify<{ sub: string; email: string }>(result.tokens.accessToken);
      expect(decoded.sub).toBe(baseUser.id);
      expect(decoded.email).toBe(dto.email);
    });

    it('persists the refresh token as a hash, never plaintext', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...baseUser, email: dto.email });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      const stored = prisma.refreshToken.create.mock.calls[0][0].data;
      expect(stored.tokenHash).not.toBe(result.tokens.refreshToken);
      expect(stored.tokenHash).toBe(sha256(result.tokens.refreshToken));
      expect(stored.userId).toBe(baseUser.id);
      expect(stored.expiresAt).toBeInstanceOf(Date);
      expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('throws ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(service.register(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const password = 'Password123!';

    it('returns a token pair when credentials are valid', async () => {
      const passwordHash = await bcrypt.hash(password, 4);
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: baseUser.email, password });

      expect(result.user.email).toBe(baseUser.email);
      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
    });

    it('rejects when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', password }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an OAuth-only user attempting password login', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        authProvider: AuthProvider.GOOGLE,
        externalId: 'google-sub-123',
        passwordHash: null,
      });

      await expect(
        service.login({ email: baseUser.email, password }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when password is wrong', async () => {
      const passwordHash = await bcrypt.hash('correctPassword', 4);
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });

      await expect(
        service.login({ email: baseUser.email, password: 'wrongPassword' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const plaintext = 'plaintext-refresh-token-value';
    const tokenHash = sha256(plaintext);

    const validStored = {
      id: 'rt-1',
      userId: baseUser.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      createdAt: new Date(),
      user: baseUser,
    };

    it('rotates the token pair on a valid refresh', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validStored);
      prisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.refresh(plaintext);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
        include: { user: true },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      const transactionOps = prisma.$transaction.mock.calls[0][0];
      expect(transactionOps).toHaveLength(2);

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.refreshToken).not.toBe(plaintext);
    });

    it('rejects an unknown refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('unknown')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('detects reuse and revokes all the user’s active tokens', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...validStored,
        revokedAt: new Date(),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 4 });

      await expect(service.refresh(plaintext)).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: baseUser.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...validStored,
        expiresAt: new Date(Date.now() - 1_000),
      });

      await expect(service.refresh(plaintext)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the matching active token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('some-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256('some-token'), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('does not throw when no active token matches', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.logout('garbage')).resolves.toBeUndefined();
    });
  });

  describe('oauthLogin', () => {
    const profile: NormalizedOAuthProfile = {
      externalId: 'google-sub-123',
      email: 'oauth-user@example.com',
      firstName: 'OAuth',
      lastName: 'User',
      avatarUrl: 'https://example.com/pic.png',
    };

    function makeFakeProvider(): jest.Mocked<OAuthProvider> {
      return {
        name: 'google',
        authProvider: AuthProvider.GOOGLE,
        verifyIdToken: jest.fn(),
      };
    }

    let registry: MockRegistry;
    let provider: jest.Mocked<OAuthProvider>;

    beforeEach(() => {
      provider = makeFakeProvider();
      ({ service, registry } = makeService(prisma));
      registry.get.mockReturnValue(provider);
    });

    it('throws BadRequestException for an unknown provider', async () => {
      registry.get.mockImplementation(() => {
        throw new BadRequestException('Unsupported OAuth provider: facebook');
      });

      await expect(service.oauthLogin('facebook', 'token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(provider.verifyIdToken).not.toHaveBeenCalled();
    });

    it('creates a new user and issues a token pair on first login', async () => {
      provider.verifyIdToken.mockResolvedValue(profile);
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // composite (authProvider, externalId) lookup
        .mockResolvedValueOnce(null); // email collision check
      const created: User = {
        ...baseUser,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl ?? null,
        authProvider: AuthProvider.GOOGLE,
        externalId: profile.externalId,
      };
      prisma.user.create.mockResolvedValue(created);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.oauthLogin('google', 'id-token-value');

      expect(provider.verifyIdToken).toHaveBeenCalledWith('id-token-value');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          authProvider: AuthProvider.GOOGLE,
          externalId: profile.externalId,
        },
      });
      expect(result.user.email).toBe(profile.email);
      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
    });

    it('reuses the existing user on a returning login (no email check, no create)', async () => {
      provider.verifyIdToken.mockResolvedValue(profile);
      const existing: User = {
        ...baseUser,
        email: profile.email,
        authProvider: AuthProvider.GOOGLE,
        externalId: profile.externalId,
      };
      prisma.user.findUnique.mockResolvedValueOnce(existing);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.oauthLogin('google', 'id-token-value');

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.user.id).toBe(existing.id);
    });

    it('throws ConflictException when email is taken by a different auth method', async () => {
      provider.verifyIdToken.mockResolvedValue(profile);
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // no match on (provider, externalId)
        .mockResolvedValueOnce({
          ...baseUser,
          email: profile.email,
          authProvider: AuthProvider.LOCAL,
        }); // email collision

      await expect(service.oauthLogin('google', 'id-token-value')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('propagates UnauthorizedException when the provider rejects the token', async () => {
      provider.verifyIdToken.mockRejectedValue(new UnauthorizedException('Invalid token'));

      await expect(service.oauthLogin('google', 'bad-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });
});
