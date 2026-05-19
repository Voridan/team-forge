import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Attachment,
  AttachmentStatus,
  Message,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { MessagingPublisher } from './messaging.publisher';
import { UpdateMessageDto } from './dto/update-message.dto';

export type MessageWithAttachments = Message & { attachments: Attachment[] };

export interface MessagePage {
  items: MessageWithAttachments[];
  nextCursor: string | null;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: MessagingPublisher,
    private readonly storage: StorageService,
  ) {}

  async listForChannel(
    teamId: string,
    channelId: string,
    filters: ListMessagesDto,
  ): Promise<MessagePage> {
    await this.assertChannelInTeam(teamId, channelId);

    const limit = filters.limit ?? 50;
    const cursor = parseCursor(filters.cursor);

    const where: Prisma.MessageWhereInput = {
      channelId,
      deletedAt: null,
    };
    if (cursor) {
      where.OR = [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ];
    }

    const items = await this.prisma.message.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { attachments: true },
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const next = items.pop()!;
      nextCursor = encodeCursor({ createdAt: next.createdAt, id: next.id });
    }

    return { items, nextCursor };
  }

  async create(
    teamId: string,
    channelId: string,
    authorUserId: string,
    dto: CreateMessageDto,
  ): Promise<MessageWithAttachments> {
    await this.assertChannelInTeam(teamId, channelId);

    const attachmentIds = dto.attachmentIds ?? [];
    await this.assertLinkableAttachments(teamId, authorUserId, attachmentIds);

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          channelId,
          teamId,
          authorUserId,
          content: dto.content,
        },
      });
      if (attachmentIds.length > 0) {
        await tx.attachment.updateMany({
          where: { id: { in: attachmentIds } },
          data: { status: AttachmentStatus.LINKED, linkedMessageId: created.id },
        });
      }
      return tx.message.findUniqueOrThrow({
        where: { id: created.id },
        include: { attachments: true },
      });
    });

    await this.publisher.publish({
      type: 'message:created',
      channelId,
      teamId,
      payload: message,
    });

    return message;
  }

  async update(
    teamId: string,
    channelId: string,
    messageId: string,
    requesterId: string,
    dto: UpdateMessageDto,
  ): Promise<MessageWithAttachments> {
    const existing = await this.findMessageInChannel(teamId, channelId, messageId);
    if (existing.authorUserId !== requesterId) {
      throw new ForbiddenException('Only the author can edit a message');
    }
    if (existing.deletedAt) {
      throw new ForbiddenException('Cannot edit a deleted message');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: dto.content, editedAt: new Date() },
      include: { attachments: true },
    });

    await this.publisher.publish({
      type: 'message:edited',
      channelId,
      teamId,
      payload: updated,
    });

    return updated;
  }

  async delete(
    teamId: string,
    channelId: string,
    messageId: string,
    requesterId: string,
    requesterIsAdminOrHigher: boolean,
  ): Promise<void> {
    const existing = await this.findMessageInChannel(teamId, channelId, messageId);
    const isAuthor = existing.authorUserId === requesterId;
    if (!isAuthor && !requesterIsAdminOrHigher) {
      throw new ForbiddenException('Only the author or an admin can delete a message');
    }
    if (existing.deletedAt) return; // idempotent

    // Hard-delete attachments (S3 + DB rows) so the bytes don't linger.
    const attachments = await this.prisma.attachment.findMany({
      where: { linkedMessageId: messageId },
    });
    for (const a of attachments) {
      try {
        await this.storage.deleteObject(a.storageKey);
      } catch {
        // Already-deleted S3 objects are fine; the row removal proceeds.
      }
    }

    await this.prisma.$transaction([
      this.prisma.attachment.deleteMany({ where: { linkedMessageId: messageId } }),
      this.prisma.message.update({
        where: { id: messageId },
        data: { deletedAt: new Date() },
      }),
    ]);

    await this.publisher.publish({
      type: 'message:deleted',
      channelId,
      teamId,
      messageId,
    });
  }

  // --- helpers ---

  private async assertChannelInTeam(teamId: string, channelId: string): Promise<void> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, teamId },
      select: { id: true, archivedAt: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.archivedAt) throw new ForbiddenException('Channel is archived');
  }

  private async findMessageInChannel(
    teamId: string,
    channelId: string,
    messageId: string,
  ): Promise<Message> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, channelId, teamId },
    });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  private async assertLinkableAttachments(
    teamId: string,
    uploaderUserId: string,
    attachmentIds: string[],
  ): Promise<void> {
    if (attachmentIds.length === 0) return;
    const found = await this.prisma.attachment.findMany({
      where: {
        id: { in: attachmentIds },
        teamId,
        uploaderUserId,
        status: AttachmentStatus.UPLOADED,
        linkedMessageId: null,
      },
      select: { id: true },
    });
    if (found.length !== attachmentIds.length) {
      throw new BadRequestException(
        'One or more attachments are missing, already linked, or not yours',
      );
    }
  }
}

function parseCursor(raw?: string): { createdAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const { c, i } = JSON.parse(decoded) as { c: string; i: string };
    return { createdAt: new Date(c), id: i };
  } catch {
    return null;
  }
}

function encodeCursor(cursor: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ c: cursor.createdAt.toISOString(), i: cursor.id }),
    'utf8',
  ).toString('base64url');
}
