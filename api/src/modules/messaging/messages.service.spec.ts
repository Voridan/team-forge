import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AttachmentStatus } from '../../../generated/prisma/client';
import { MessagesService } from './messages.service';

type MockPrisma = {
  channel: { findFirst: jest.Mock };
  message: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  attachment: {
    findMany: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makeMockPrisma(): MockPrisma {
  const tx = {
    message: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    attachment: {
      updateMany: jest.fn(),
    },
  };
  const prisma: MockPrisma = {
    channel: { findFirst: jest.fn() },
    message: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    attachment: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => {
      if (typeof callback === 'function') {
        return callback(tx);
      }
      return callback;
    }),
  };
  // Expose the transactional client so tests can configure its mocks.
  (prisma as MockPrisma & { __tx: typeof tx }).__tx = tx;
  return prisma;
}

const publisher = () => ({ publish: jest.fn() });
const storage = () => ({ deleteObject: jest.fn() });

const TEAM_ID = '11111111-1111-1111-1111-111111111111';
const CHANNEL_ID = '22222222-2222-2222-2222-222222222222';
const MESSAGE_ID = '33333333-3333-3333-3333-333333333333';
const ALICE = '44444444-4444-4444-4444-444444444444';
const BOB = '55555555-5555-5555-5555-555555555555';
const ATTACH_1 = '66666666-6666-6666-6666-666666666666';

const baseChannel = {
  id: CHANNEL_ID,
  archivedAt: null,
};

const baseMessage = {
  id: MESSAGE_ID,
  channelId: CHANNEL_ID,
  teamId: TEAM_ID,
  authorUserId: ALICE,
  content: 'hello',
  createdAt: new Date(),
  editedAt: null,
  deletedAt: null,
};

describe('MessagesService', () => {
  let prisma: MockPrisma & { __tx: ReturnType<typeof makeMockPrisma>['$transaction']['_tx'] };
  let pub: ReturnType<typeof publisher>;
  let store: ReturnType<typeof storage>;
  let service: MessagesService;

  beforeEach(() => {
    prisma = makeMockPrisma() as never;
    pub = publisher();
    store = storage();
    service = new MessagesService(prisma as never, pub as never, store as never);
  });

  describe('listForChannel', () => {
    it('throws NotFoundException when the channel is not in the team', async () => {
      prisma.channel.findFirst.mockResolvedValue(null);

      await expect(
        service.listForChannel(TEAM_ID, CHANNEL_ID, { limit: 50 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to read from an archived channel', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: CHANNEL_ID, archivedAt: new Date() });

      await expect(
        service.listForChannel(TEAM_ID, CHANNEL_ID, { limit: 50 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns items and a nextCursor when more than limit exist', async () => {
      prisma.channel.findFirst.mockResolvedValue(baseChannel);
      // 3 items requested with limit 2 → service fetches 3, peels the last as cursor
      const items = [
        { ...baseMessage, id: 'm1', createdAt: new Date('2026-05-01') },
        { ...baseMessage, id: 'm2', createdAt: new Date('2026-04-30') },
        { ...baseMessage, id: 'm3', createdAt: new Date('2026-04-29') },
      ];
      prisma.message.findMany.mockResolvedValue(items);

      const result = await service.listForChannel(TEAM_ID, CHANNEL_ID, { limit: 2 });

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 3,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toEqual(expect.any(String));
    });

    it('returns null cursor when fewer than limit items exist', async () => {
      prisma.channel.findFirst.mockResolvedValue(baseChannel);
      prisma.message.findMany.mockResolvedValue([baseMessage]);

      const result = await service.listForChannel(TEAM_ID, CHANNEL_ID, { limit: 50 });

      expect(result.nextCursor).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a message and publishes a created event', async () => {
      prisma.channel.findFirst.mockResolvedValue(baseChannel);
      const created = { ...baseMessage, id: 'new-id' };
      const withAttachments = { ...created, attachments: [] };
      prisma.__tx!.message.create.mockResolvedValue(created);
      prisma.__tx!.message.findUniqueOrThrow.mockResolvedValue(withAttachments);

      const result = await service.create(TEAM_ID, CHANNEL_ID, ALICE, { content: 'hi' });

      expect(prisma.__tx!.message.create).toHaveBeenCalledWith({
        data: {
          channelId: CHANNEL_ID,
          teamId: TEAM_ID,
          authorUserId: ALICE,
          content: 'hi',
        },
      });
      expect(pub.publish).toHaveBeenCalledWith({
        type: 'message:created',
        channelId: CHANNEL_ID,
        teamId: TEAM_ID,
        payload: withAttachments,
      });
      expect(result).toEqual(withAttachments);
    });

    it('links attachments owned by the sender and in UPLOADED state', async () => {
      prisma.channel.findFirst.mockResolvedValue(baseChannel);
      prisma.attachment.findMany.mockResolvedValue([{ id: ATTACH_1 }]);
      const created = { ...baseMessage, id: 'new-id' };
      prisma.__tx!.message.create.mockResolvedValue(created);
      prisma.__tx!.message.findUniqueOrThrow.mockResolvedValue({
        ...created,
        attachments: [{ id: ATTACH_1 }],
      });

      await service.create(TEAM_ID, CHANNEL_ID, ALICE, {
        content: 'see attached',
        attachmentIds: [ATTACH_1],
      });

      expect(prisma.attachment.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [ATTACH_1] },
          teamId: TEAM_ID,
          uploaderUserId: ALICE,
          status: AttachmentStatus.UPLOADED,
          linkedMessageId: null,
        },
        select: { id: true },
      });
      expect(prisma.__tx!.attachment.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [ATTACH_1] } },
        data: { status: AttachmentStatus.LINKED, linkedMessageId: 'new-id' },
      });
    });

    it('rejects when an attachment is not linkable', async () => {
      prisma.channel.findFirst.mockResolvedValue(baseChannel);
      prisma.attachment.findMany.mockResolvedValue([]); // none match

      await expect(
        service.create(TEAM_ID, CHANNEL_ID, ALICE, {
          content: 'x',
          attachmentIds: [ATTACH_1],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.__tx!.message.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('lets the author edit; sets editedAt and publishes', async () => {
      prisma.message.findFirst.mockResolvedValue(baseMessage);
      prisma.message.update.mockResolvedValue({
        ...baseMessage,
        content: 'edited',
        editedAt: new Date(),
        attachments: [],
      });

      await service.update(TEAM_ID, CHANNEL_ID, MESSAGE_ID, ALICE, { content: 'edited' });

      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: MESSAGE_ID },
        data: { content: 'edited', editedAt: expect.any(Date) },
        include: { attachments: true },
      });
      expect(pub.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'message:edited' }),
      );
    });

    it('rejects non-author edits', async () => {
      prisma.message.findFirst.mockResolvedValue(baseMessage);

      await expect(
        service.update(TEAM_ID, CHANNEL_ID, MESSAGE_ID, BOB, { content: 'edit' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects edits on already-deleted messages', async () => {
      prisma.message.findFirst.mockResolvedValue({ ...baseMessage, deletedAt: new Date() });

      await expect(
        service.update(TEAM_ID, CHANNEL_ID, MESSAGE_ID, ALICE, { content: 'edit' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('soft-deletes for the author and hard-deletes their attachments', async () => {
      prisma.message.findFirst.mockResolvedValue(baseMessage);
      prisma.attachment.findMany.mockResolvedValue([
        { id: ATTACH_1, storageKey: 'teams/x/attachments/a1/file.pdf' },
      ]);

      await service.delete(TEAM_ID, CHANNEL_ID, MESSAGE_ID, ALICE, false);

      expect(store.deleteObject).toHaveBeenCalledWith('teams/x/attachments/a1/file.pdf');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(pub.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'message:deleted', messageId: MESSAGE_ID }),
      );
    });

    it('lets an admin delete someone else’s message', async () => {
      prisma.message.findFirst.mockResolvedValue(baseMessage);
      prisma.attachment.findMany.mockResolvedValue([]);

      await service.delete(TEAM_ID, CHANNEL_ID, MESSAGE_ID, BOB, true);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('rejects non-author non-admin', async () => {
      prisma.message.findFirst.mockResolvedValue(baseMessage);

      await expect(
        service.delete(TEAM_ID, CHANNEL_ID, MESSAGE_ID, BOB, false),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('is idempotent on already-deleted messages', async () => {
      prisma.message.findFirst.mockResolvedValue({ ...baseMessage, deletedAt: new Date() });

      await service.delete(TEAM_ID, CHANNEL_ID, MESSAGE_ID, ALICE, false);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(pub.publish).not.toHaveBeenCalled();
    });
  });
});
