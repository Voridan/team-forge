import { ConflictException, NotFoundException } from '@nestjs/common';
import { ChannelType } from '../../../generated/prisma/client';
import { ChannelsService } from './channels.service';

type MockPrisma = {
  channel: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

function makeMockPrisma(): MockPrisma {
  return {
    channel: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

const TEAM_ID = '11111111-1111-1111-1111-111111111111';
const CHANNEL_ID = '22222222-2222-2222-2222-222222222222';

const baseChannel = {
  id: CHANNEL_ID,
  teamId: TEAM_ID,
  name: 'general',
  description: null,
  type: ChannelType.PUBLIC,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ChannelsService', () => {
  let prisma: MockPrisma;
  let service: ChannelsService;

  beforeEach(() => {
    prisma = makeMockPrisma();
    service = new ChannelsService(prisma as never);
  });

  describe('create', () => {
    it('creates a PUBLIC channel when the name is unused', async () => {
      prisma.channel.findUnique.mockResolvedValue(null);
      prisma.channel.create.mockResolvedValue(baseChannel);

      const result = await service.create(TEAM_ID, { name: 'general', description: 'g chat' });

      expect(prisma.channel.findUnique).toHaveBeenCalledWith({
        where: { teamId_name: { teamId: TEAM_ID, name: 'general' } },
      });
      expect(prisma.channel.create).toHaveBeenCalledWith({
        data: {
          teamId: TEAM_ID,
          name: 'general',
          description: 'g chat',
          type: ChannelType.PUBLIC,
        },
      });
      expect(result).toEqual(baseChannel);
    });

    it('throws ConflictException when a channel with the same name exists in the team', async () => {
      prisma.channel.findUnique.mockResolvedValue(baseChannel);

      await expect(service.create(TEAM_ID, { name: 'general' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.channel.create).not.toHaveBeenCalled();
    });
  });

  describe('listForTeam', () => {
    it('returns non-archived channels ordered by name', async () => {
      prisma.channel.findMany.mockResolvedValue([baseChannel]);

      await service.listForTeam(TEAM_ID);

      expect(prisma.channel.findMany).toHaveBeenCalledWith({
        where: { teamId: TEAM_ID, archivedAt: null },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('getById', () => {
    it('returns the channel when it belongs to the team', async () => {
      prisma.channel.findFirst.mockResolvedValue(baseChannel);

      const result = await service.getById(TEAM_ID, CHANNEL_ID);

      expect(result).toEqual(baseChannel);
    });

    it('throws NotFoundException when the channel is in a different team', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);

      await expect(service.getById(TEAM_ID, CHANNEL_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates name and description when no name conflict', async () => {
      prisma.channel.findFirst.mockResolvedValue(baseChannel);
      prisma.channel.findUnique.mockResolvedValue(null);
      prisma.channel.update.mockResolvedValue({ ...baseChannel, name: 'general-v2' });

      await service.update(TEAM_ID, CHANNEL_ID, { name: 'general-v2', description: 'updated' });

      expect(prisma.channel.update).toHaveBeenCalledWith({
        where: { id: CHANNEL_ID },
        data: { name: 'general-v2', description: 'updated' },
      });
    });

    it('throws ConflictException when renaming to an existing name', async () => {
      prisma.channel.findFirst.mockResolvedValue(baseChannel);
      prisma.channel.findUnique.mockResolvedValue({ ...baseChannel, id: 'other-id' });

      await expect(
        service.update(TEAM_ID, CHANNEL_ID, { name: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('archive', () => {
    it('sets archivedAt to a fresh Date', async () => {
      prisma.channel.findFirst.mockResolvedValue(baseChannel);
      prisma.channel.update.mockResolvedValue({ ...baseChannel, archivedAt: new Date() });

      await service.archive(TEAM_ID, CHANNEL_ID);

      expect(prisma.channel.update).toHaveBeenCalledWith({
        where: { id: CHANNEL_ID },
        data: { archivedAt: expect.any(Date) },
      });
    });
  });
});
