import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { Attachment, AttachmentStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PresignAttachmentDto } from './dto/presign-attachment.dto';

export interface PresignResult {
  attachmentId: string;
  uploadUrl: string;
  expiresAt: Date;
}

export interface DownloadResult {
  downloadUrl: string;
  expiresAt: Date;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async presign(
    teamId: string,
    uploaderUserId: string,
    dto: PresignAttachmentDto,
  ): Promise<PresignResult> {
    const attachmentId = crypto.randomUUID();
    const storageKey = this.storage.buildStorageKey(teamId, attachmentId, dto.filename);

    await this.prisma.attachment.create({
      data: {
        id: attachmentId,
        teamId,
        uploaderUserId,
        storageKey,
        filename: dto.filename,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        status: AttachmentStatus.PENDING,
      },
    });

    const { url, expiresAt } = await this.storage.presignUpload({
      storageKey,
      contentType: dto.mimeType,
      contentLength: dto.sizeBytes,
    });

    return { attachmentId, uploadUrl: url, expiresAt };
  }

  async confirmUpload(
    teamId: string,
    uploaderUserId: string,
    attachmentId: string,
  ): Promise<Attachment> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, teamId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.uploaderUserId !== uploaderUserId) {
      throw new ForbiddenException('Only the uploader can confirm');
    }
    if (attachment.status === AttachmentStatus.LINKED) {
      throw new ConflictException('Attachment already linked to a message');
    }
    if (attachment.status === AttachmentStatus.UPLOADED) {
      return attachment; // idempotent
    }

    const head = await this.storage.headObject(attachment.storageKey);
    if (!head) {
      throw new BadRequestException('File not found in storage; upload may not have completed');
    }
    if (head.size !== attachment.sizeBytes) {
      // Different size than declared: refuse and require a fresh presign.
      await this.storage.deleteObject(attachment.storageKey);
      await this.prisma.attachment.delete({ where: { id: attachmentId } });
      throw new BadRequestException(
        `Uploaded file size (${head.size}) does not match declared (${attachment.sizeBytes})`,
      );
    }

    return this.prisma.attachment.update({
      where: { id: attachmentId },
      data: { status: AttachmentStatus.UPLOADED, uploadedAt: new Date() },
    });
  }

  async getDownload(
    teamId: string,
    requesterUserId: string,
    attachmentId: string,
  ): Promise<DownloadResult> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, teamId },
      include: {
        message: {
          select: {
            id: true,
            channelId: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.status === AttachmentStatus.PENDING) {
      throw new BadRequestException('Attachment has not been uploaded yet');
    }
    if (attachment.message?.deletedAt) {
      throw new NotFoundException('Attachment was deleted with the parent message');
    }

    // If the attachment isn't linked to a message yet (still UPLOADED), only the
    // uploader can preview/download it.
    if (attachment.status === AttachmentStatus.UPLOADED && attachment.uploaderUserId !== requesterUserId) {
      throw new ForbiddenException('Attachment not visible to you yet');
    }

    // LINKED attachments are visible to anyone with access to the channel.
    // (TeamRoleGuard MEMBER check on the route already validated team membership.)

    const { url, expiresAt } = await this.storage.presignDownload({
      storageKey: attachment.storageKey,
      filename: attachment.filename,
    });

    return {
      downloadUrl: url,
      expiresAt,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    };
  }

  async delete(
    teamId: string,
    requesterUserId: string,
    attachmentId: string,
    requesterIsAdminOrHigher: boolean,
  ): Promise<void> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, teamId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const isUploader = attachment.uploaderUserId === requesterUserId;
    if (!isUploader && !requesterIsAdminOrHigher) {
      throw new ForbiddenException('Only the uploader or an admin can delete');
    }
    if (attachment.status === AttachmentStatus.LINKED) {
      throw new ConflictException(
        'Attachment is part of a message; delete the message to remove it',
      );
    }

    try {
      await this.storage.deleteObject(attachment.storageKey);
    } catch {
      // Already deleted in storage — proceed.
    }
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
  }
}
