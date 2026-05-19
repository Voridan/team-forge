import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AttachmentStatus } from '../../../generated/prisma/client';
import { AttachmentsService } from './attachments.service';

type MockPrisma = {
  attachment: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

function makeMockPrisma(): MockPrisma {
  return {
    attachment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeMockStorage() {
  return {
    buildStorageKey: jest.fn((teamId: string, id: string, name: string) => `teams/${teamId}/attachments/${id}/${name}`),
    presignUpload: jest.fn().mockResolvedValue({
      url: 'https://minio.local/signed-upload',
      expiresAt: new Date(Date.now() + 900_000),
    }),
    presignDownload: jest.fn().mockResolvedValue({
      url: 'https://minio.local/signed-download',
      expiresAt: new Date(Date.now() + 3_600_000),
    }),
    headObject: jest.fn(),
    deleteObject: jest.fn(),
  };
}

const TEAM_ID = '11111111-1111-1111-1111-111111111111';
const ALICE = '22222222-2222-2222-2222-222222222222';
const BOB = '33333333-3333-3333-3333-333333333333';
const ATTACHMENT_ID = '44444444-4444-4444-4444-444444444444';

const baseAttachment = {
  id: ATTACHMENT_ID,
  teamId: TEAM_ID,
  uploaderUserId: ALICE,
  storageKey: 'teams/x/attachments/a/file.pdf',
  filename: 'file.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  status: AttachmentStatus.PENDING,
  linkedMessageId: null,
  createdAt: new Date(),
  uploadedAt: null,
};

describe('AttachmentsService', () => {
  let prisma: MockPrisma;
  let storage: ReturnType<typeof makeMockStorage>;
  let service: AttachmentsService;

  beforeEach(() => {
    prisma = makeMockPrisma();
    storage = makeMockStorage();
    service = new AttachmentsService(prisma as never, storage as never);
  });

  describe('presign', () => {
    it('creates a PENDING row and returns a signed upload URL', async () => {
      prisma.attachment.create.mockResolvedValue(baseAttachment);

      const result = await service.presign(TEAM_ID, ALICE, {
        filename: 'file.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      });

      expect(prisma.attachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: TEAM_ID,
          uploaderUserId: ALICE,
          filename: 'file.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          status: AttachmentStatus.PENDING,
        }),
      });
      expect(storage.presignUpload).toHaveBeenCalled();
      expect(result.uploadUrl).toBe('https://minio.local/signed-upload');
      expect(result.attachmentId).toEqual(expect.any(String));
    });
  });

  describe('confirmUpload', () => {
    it('throws NotFoundException when attachment is not in the team', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmUpload(TEAM_ID, ALICE, ATTACHMENT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses when caller is not the uploader', async () => {
      prisma.attachment.findFirst.mockResolvedValue(baseAttachment);

      await expect(
        service.confirmUpload(TEAM_ID, BOB, ATTACHMENT_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ConflictException for already-linked attachments', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        ...baseAttachment,
        status: AttachmentStatus.LINKED,
      });

      await expect(
        service.confirmUpload(TEAM_ID, ALICE, ATTACHMENT_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('is idempotent for already-uploaded attachments', async () => {
      const uploaded = { ...baseAttachment, status: AttachmentStatus.UPLOADED };
      prisma.attachment.findFirst.mockResolvedValue(uploaded);

      const result = await service.confirmUpload(TEAM_ID, ALICE, ATTACHMENT_ID);

      expect(result).toEqual(uploaded);
      expect(storage.headObject).not.toHaveBeenCalled();
      expect(prisma.attachment.update).not.toHaveBeenCalled();
    });

    it('throws when the file is missing from storage', async () => {
      prisma.attachment.findFirst.mockResolvedValue(baseAttachment);
      storage.headObject.mockResolvedValue(null);

      await expect(
        service.confirmUpload(TEAM_ID, ALICE, ATTACHMENT_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses when the uploaded size differs from declared, cleans up both sides', async () => {
      prisma.attachment.findFirst.mockResolvedValue(baseAttachment);
      storage.headObject.mockResolvedValue({ size: 999_999 });

      await expect(
        service.confirmUpload(TEAM_ID, ALICE, ATTACHMENT_ID),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(storage.deleteObject).toHaveBeenCalledWith(baseAttachment.storageKey);
      expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: ATTACHMENT_ID } });
    });

    it('transitions PENDING → UPLOADED on success', async () => {
      prisma.attachment.findFirst.mockResolvedValue(baseAttachment);
      storage.headObject.mockResolvedValue({ size: baseAttachment.sizeBytes });
      prisma.attachment.update.mockResolvedValue({
        ...baseAttachment,
        status: AttachmentStatus.UPLOADED,
        uploadedAt: new Date(),
      });

      const result = await service.confirmUpload(TEAM_ID, ALICE, ATTACHMENT_ID);

      expect(prisma.attachment.update).toHaveBeenCalledWith({
        where: { id: ATTACHMENT_ID },
        data: { status: AttachmentStatus.UPLOADED, uploadedAt: expect.any(Date) },
      });
      expect(result.status).toBe(AttachmentStatus.UPLOADED);
    });
  });

  describe('getDownload', () => {
    it('rejects PENDING attachments', async () => {
      prisma.attachment.findFirst.mockResolvedValue(baseAttachment);

      await expect(
        service.getDownload(TEAM_ID, ALICE, ATTACHMENT_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses UPLOADED-but-unlinked attachment to anyone but the uploader', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        ...baseAttachment,
        status: AttachmentStatus.UPLOADED,
      });

      await expect(
        service.getDownload(TEAM_ID, BOB, ATTACHMENT_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns a signed URL for the uploader on UPLOADED', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        ...baseAttachment,
        status: AttachmentStatus.UPLOADED,
      });

      const result = await service.getDownload(TEAM_ID, ALICE, ATTACHMENT_ID);

      expect(result.downloadUrl).toBe('https://minio.local/signed-download');
    });

    it('returns 404 for LINKED attachment whose parent message was soft-deleted', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        ...baseAttachment,
        status: AttachmentStatus.LINKED,
        linkedMessageId: 'm1',
        message: { id: 'm1', channelId: 'c1', deletedAt: new Date() },
      });

      await expect(
        service.getDownload(TEAM_ID, BOB, ATTACHMENT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns a signed URL for any team member on a LINKED attachment', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        ...baseAttachment,
        status: AttachmentStatus.LINKED,
        linkedMessageId: 'm1',
        message: { id: 'm1', channelId: 'c1', deletedAt: null },
      });

      const result = await service.getDownload(TEAM_ID, BOB, ATTACHMENT_ID);

      expect(result.downloadUrl).toBe('https://minio.local/signed-download');
    });
  });

  describe('delete', () => {
    it('refuses to delete LINKED attachments — they belong to a message', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        ...baseAttachment,
        status: AttachmentStatus.LINKED,
      });

      await expect(
        service.delete(TEAM_ID, ALICE, ATTACHMENT_ID, true),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lets the uploader delete an UPLOADED, unlinked attachment', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        ...baseAttachment,
        status: AttachmentStatus.UPLOADED,
      });

      await service.delete(TEAM_ID, ALICE, ATTACHMENT_ID, false);

      expect(storage.deleteObject).toHaveBeenCalledWith(baseAttachment.storageKey);
      expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: ATTACHMENT_ID } });
    });

    it('rejects non-uploader non-admin', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        ...baseAttachment,
        status: AttachmentStatus.UPLOADED,
      });

      await expect(
        service.delete(TEAM_ID, BOB, ATTACHMENT_ID, false),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
