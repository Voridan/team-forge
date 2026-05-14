import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import {
  InvitationStatus,
  TeamRole,
} from '../../../generated/prisma/client';
import { MailService } from '../mail/mail.types';
import { InvitationsService } from './invitations.service';

const sha256 = (input: string) =>
  crypto.createHash('sha256').update(input).digest('hex');

type MockPrisma = {
  user: { findUnique: jest.Mock; findMany: jest.Mock };
  team: { findUnique: jest.Mock };
  teamInvitation: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  teamMember: { findUnique: jest.Mock; create: jest.Mock };
  $transaction: jest.Mock;
};

function makeMockPrisma(): MockPrisma {
  return {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    team: { findUnique: jest.fn() },
    teamInvitation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    teamMember: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

class StubMailService extends MailService {
  sendInvitation = jest.fn().mockResolvedValue(undefined);
}

function makeService(): {
  service: InvitationsService;
  prisma: MockPrisma;
  mail: StubMailService;
} {
  const prisma = makeMockPrisma();
  const mail = new StubMailService();
  const config = {
    get: jest.fn((key: string) =>
      key === 'WEB_APP_URL' ? 'http://localhost:5173' : undefined,
    ),
  };
  const service = new InvitationsService(prisma as never, mail, config as never);
  return { service, prisma, mail };
}

const TEAM_ID = '11111111-1111-1111-1111-111111111111';
const INVITER = '22222222-2222-2222-2222-222222222222';
const ACCEPTER = '33333333-3333-3333-3333-333333333333';
const INVITATION_ID = '44444444-4444-4444-4444-444444444444';

const baseInvitation = {
  id: INVITATION_ID,
  teamId: TEAM_ID,
  email: 'newbie@example.com',
  role: TeamRole.MEMBER,
  invitedByUserId: INVITER,
  tokenHash: 'will-be-overwritten-per-test',
  status: InvitationStatus.PENDING,
  expiresAt: new Date(Date.now() + 86_400_000),
  createdAt: new Date(),
  acceptedAt: null,
};

describe('InvitationsService', () => {
  describe('createMany', () => {
    it('refuses OWNER role assignment up-front', async () => {
      const { service } = makeService();
      await expect(
        service.createMany(TEAM_ID, INVITER, ['a@x.com'], TeamRole.OWNER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException if the team does not exist', async () => {
      const { service, prisma } = makeService();
      prisma.team.findUnique.mockResolvedValue(null);
      await expect(
        service.createMany(TEAM_ID, INVITER, ['a@x.com']),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('skips already-member and already-invited emails, and creates the rest', async () => {
      const { service, prisma, mail } = makeService();
      prisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, name: 'Eng' });
      prisma.user.findUnique.mockResolvedValue({ firstName: 'Alice', lastName: 'Test' });

      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'member@x.com', teamMembers: [{ teamId: TEAM_ID }] },
      ]);
      prisma.teamInvitation.findMany.mockResolvedValue([{ email: 'pending@x.com' }]);
      prisma.teamInvitation.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...baseInvitation, email: data.email, status: data.status ?? 'PENDING' }),
      );

      const result = await service.createMany(
        TEAM_ID,
        INVITER,
        ['member@x.com', 'pending@x.com', 'new@x.com'],
      );

      expect(result.skipped).toEqual([
        { email: 'member@x.com', reason: 'Already a member' },
        { email: 'pending@x.com', reason: 'Invitation already pending' },
      ]);
      expect(result.created).toHaveLength(1);
      expect(result.created[0].email).toBe('new@x.com');
      expect(prisma.teamInvitation.create).toHaveBeenCalledTimes(1);
      expect(mail.sendInvitation).toHaveBeenCalledTimes(1);

      const call = mail.sendInvitation.mock.calls[0][0];
      expect(call.acceptUrl).toMatch(/^http:\/\/localhost:5173\/invitations\/accept\?token=/);
      expect(call.inviterName).toBe('Alice Test');
      expect(call.teamName).toBe('Eng');
    });

    it('persists tokenHash, never the plaintext token', async () => {
      const { service, prisma, mail } = makeService();
      prisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, name: 'Eng' });
      prisma.user.findUnique.mockResolvedValue({ firstName: 'Alice', lastName: 'Test' });
      prisma.user.findMany.mockResolvedValue([]);
      prisma.teamInvitation.findMany.mockResolvedValue([]);
      prisma.teamInvitation.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...baseInvitation, ...data }),
      );

      await service.createMany(TEAM_ID, INVITER, ['new@x.com']);

      const stored = prisma.teamInvitation.create.mock.calls[0][0].data;
      const sentUrl = mail.sendInvitation.mock.calls[0][0].acceptUrl as string;
      const plaintext = sentUrl.split('token=')[1];

      expect(stored.tokenHash).toBe(sha256(plaintext));
      expect(stored.tokenHash).not.toBe(plaintext);
    });

    it('still creates the invitation even if email delivery fails', async () => {
      const { service, prisma, mail } = makeService();
      prisma.team.findUnique.mockResolvedValue({ id: TEAM_ID, name: 'Eng' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.teamInvitation.findMany.mockResolvedValue([]);
      prisma.teamInvitation.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ ...baseInvitation, ...data }),
      );
      mail.sendInvitation.mockRejectedValue(new Error('SMTP down'));

      const result = await service.createMany(TEAM_ID, INVITER, ['new@x.com']);

      expect(result.created).toHaveLength(1);
    });
  });

  describe('resolveToken', () => {
    function invitationWith(overrides: Partial<typeof baseInvitation> = {}) {
      const plaintext = 'plain-token-value';
      return {
        plaintext,
        invitation: {
          ...baseInvitation,
          tokenHash: sha256(plaintext),
          ...overrides,
          team: { id: TEAM_ID, name: 'Eng' },
          invitedBy: { user: { firstName: 'Alice', lastName: 'Test' } },
        },
      };
    }

    it('returns a preview for a valid pending invitation', async () => {
      const { service, prisma } = makeService();
      const { plaintext, invitation } = invitationWith();
      prisma.teamInvitation.findUnique.mockResolvedValue(invitation);

      const result = await service.resolveToken(plaintext);

      expect(result).toMatchObject({
        email: invitation.email,
        teamId: TEAM_ID,
        teamName: 'Eng',
        role: TeamRole.MEMBER,
        inviterName: 'Alice Test',
      });
    });

    it('throws NotFoundException for an unknown token', async () => {
      const { service, prisma } = makeService();
      prisma.teamInvitation.findUnique.mockResolvedValue(null);
      await expect(service.resolveToken('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects revoked invitations', async () => {
      const { service, prisma } = makeService();
      const { plaintext, invitation } = invitationWith({ status: InvitationStatus.REVOKED });
      prisma.teamInvitation.findUnique.mockResolvedValue(invitation);

      await expect(service.resolveToken(plaintext)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('marks an overdue invitation EXPIRED on first access', async () => {
      const { service, prisma } = makeService();
      const { plaintext, invitation } = invitationWith({
        expiresAt: new Date(Date.now() - 1_000),
      });
      prisma.teamInvitation.findUnique.mockResolvedValue(invitation);

      await expect(service.resolveToken(plaintext)).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.teamInvitation.update).toHaveBeenCalledWith({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
    });

    it('rejects already-accepted invitations', async () => {
      const { service, prisma } = makeService();
      const { plaintext, invitation } = invitationWith({ status: InvitationStatus.ACCEPTED });
      prisma.teamInvitation.findUnique.mockResolvedValue(invitation);

      await expect(service.resolveToken(plaintext)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('accept', () => {
    const plaintext = 'plain-token-value';
    const tokenHash = sha256(plaintext);

    const makeInvitation = (overrides: Partial<typeof baseInvitation> = {}) => ({
      ...baseInvitation,
      tokenHash,
      ...overrides,
    });

    it('creates a TeamMember row and marks the invitation accepted', async () => {
      const { service, prisma } = makeService();
      const invitation = makeInvitation();
      prisma.user.findUnique.mockResolvedValue({
        id: ACCEPTER,
        email: invitation.email,
      });
      prisma.teamInvitation.findUnique.mockResolvedValue(invitation);
      prisma.teamMember.findUnique.mockResolvedValue(null);

      const result = await service.accept(plaintext, ACCEPTER);

      expect(result.teamId).toBe(TEAM_ID);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const ops = prisma.$transaction.mock.calls[0][0];
      // Two ops: create teamMember + update invitation
      expect(ops).toHaveLength(2);
    });

    it('still accepts and only updates status when the user is already a member', async () => {
      const { service, prisma } = makeService();
      const invitation = makeInvitation();
      prisma.user.findUnique.mockResolvedValue({
        id: ACCEPTER,
        email: invitation.email,
      });
      prisma.teamInvitation.findUnique.mockResolvedValue(invitation);
      prisma.teamMember.findUnique.mockResolvedValue({
        teamId: TEAM_ID,
        userId: ACCEPTER,
        role: TeamRole.MEMBER,
      });

      await service.accept(plaintext, ACCEPTER);

      const ops = prisma.$transaction.mock.calls[0][0];
      // Only one op: update invitation
      expect(ops).toHaveLength(1);
    });

    it('refuses when the authenticated user’s email does not match the invitation', async () => {
      const { service, prisma } = makeService();
      const invitation = makeInvitation();
      prisma.user.findUnique.mockResolvedValue({
        id: ACCEPTER,
        email: 'someone-else@example.com',
      });
      prisma.teamInvitation.findUnique.mockResolvedValue(invitation);

      await expect(service.accept(plaintext, ACCEPTER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses an expired invitation', async () => {
      const { service, prisma } = makeService();
      const invitation = makeInvitation({ expiresAt: new Date(Date.now() - 1_000) });
      prisma.user.findUnique.mockResolvedValue({ id: ACCEPTER, email: invitation.email });
      prisma.teamInvitation.findUnique.mockResolvedValue(invitation);

      await expect(service.accept(plaintext, ACCEPTER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('refuses a revoked invitation', async () => {
      const { service, prisma } = makeService();
      const invitation = makeInvitation({ status: InvitationStatus.REVOKED });
      prisma.user.findUnique.mockResolvedValue({ id: ACCEPTER, email: invitation.email });
      prisma.teamInvitation.findUnique.mockResolvedValue(invitation);

      await expect(service.accept(plaintext, ACCEPTER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('revoke', () => {
    it('marks a pending invitation REVOKED', async () => {
      const { service, prisma } = makeService();
      prisma.teamInvitation.findFirst.mockResolvedValue(baseInvitation);

      await service.revoke(TEAM_ID, INVITATION_ID);

      expect(prisma.teamInvitation.update).toHaveBeenCalledWith({
        where: { id: INVITATION_ID },
        data: { status: InvitationStatus.REVOKED },
      });
    });

    it('throws NotFoundException when the invitation does not exist for the team', async () => {
      const { service, prisma } = makeService();
      prisma.teamInvitation.findFirst.mockResolvedValue(null);

      await expect(service.revoke(TEAM_ID, INVITATION_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects revoking an invitation that is no longer pending', async () => {
      const { service, prisma } = makeService();
      prisma.teamInvitation.findFirst.mockResolvedValue({
        ...baseInvitation,
        status: InvitationStatus.ACCEPTED,
      });

      await expect(service.revoke(TEAM_ID, INVITATION_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
