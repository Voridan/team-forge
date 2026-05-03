import { NotFoundException } from '@nestjs/common';
import { AuthProvider, User } from '../../../generated/prisma/client';
import { UsersService } from './users.service';

type MockPrisma = {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
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
  passwordHash: 'should-not-leak',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function makeMockPrisma(): MockPrisma {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

describe('UsersService', () => {
  let prisma: MockPrisma;
  let service: UsersService;

  beforeEach(() => {
    prisma = makeMockPrisma();
    service = new UsersService(prisma as never);
  });

  describe('getById', () => {
    it('returns the public user when found', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.getById(baseUser.id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: baseUser.id } });
      expect(result).toEqual({
        id: baseUser.id,
        email: baseUser.email,
        firstName: baseUser.firstName,
        lastName: baseUser.lastName,
        avatarUrl: baseUser.avatarUrl,
        status: baseUser.status,
        createdAt: baseUser.createdAt,
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('externalId');
      expect(result).not.toHaveProperty('authProvider');
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getById('22222222-2222-2222-2222-222222222222')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateById', () => {
    it('persists allowed fields and returns the public user', async () => {
      const updated = { ...baseUser, firstName: 'NewName', timezone: 'Europe/Kyiv' };
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.updateById(baseUser.id, {
        firstName: 'NewName',
        timezone: 'Europe/Kyiv',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { firstName: 'NewName', timezone: 'Europe/Kyiv' },
      });
      expect(result.firstName).toBe('NewName');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('search', () => {
    it('runs a case-insensitive OR query across email, firstName, lastName', async () => {
      prisma.user.findMany.mockResolvedValue([baseUser]);

      const result = await service.search('ali', 20);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: 'ali', mode: 'insensitive' } },
            { firstName: { contains: 'ali', mode: 'insensitive' } },
            { lastName: { contains: 'ali', mode: 'insensitive' } },
          ],
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('passwordHash');
    });

    it('returns an empty array when no matches', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.search('nobody', 20);

      expect(result).toEqual([]);
    });
  });
});
