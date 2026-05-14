import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import {
  InvitationStatus,
  TeamInvitation,
  TeamRole,
} from '../../../generated/prisma/client';
import { EnvironmentVariables } from '../../config/env.validation';
import { MailService } from '../mail/mail.types';
import { PrismaService } from '../../prisma/prisma.service';

const INVITATION_TOKEN_BYTES = 32;
const INVITATION_TTL_DAYS = 7;

export interface InvitationPreview {
  email: string;
  teamId: string;
  teamName: string;
  role: TeamRole;
  inviterName: string | null;
  expiresAt: Date;
}

export interface CreateInvitationsResult {
  created: { id: string; email: string; status: InvitationStatus }[];
  skipped: { email: string; reason: string }[];
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async createMany(
    teamId: string,
    inviterUserId: string,
    emails: string[],
    role: TeamRole = TeamRole.MEMBER,
  ): Promise<CreateInvitationsResult> {
    if (role === TeamRole.OWNER) {
      throw new BadRequestException('Cannot invite as OWNER; promote after joining');
    }

    const normalizedEmails = emails.map((e) => e.trim().toLowerCase());
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');

    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterUserId },
      select: { firstName: true, lastName: true },
    });

    const existingMembers = await this.prisma.user.findMany({
      where: { email: { in: normalizedEmails } },
      select: { id: true, email: true, teamMembers: { where: { teamId }, select: { teamId: true } } },
    });
    const alreadyMemberEmails = new Set(
      existingMembers
        .filter((u) => u.teamMembers.length > 0)
        .map((u) => u.email.toLowerCase()),
    );

    const activeInvitations = await this.prisma.teamInvitation.findMany({
      where: {
        teamId,
        status: InvitationStatus.PENDING,
        email: { in: normalizedEmails, mode: 'insensitive' },
      },
      select: { email: true },
    });
    const alreadyInvitedEmails = new Set(
      activeInvitations.map((i) => i.email.toLowerCase()),
    );

    const skipped: CreateInvitationsResult['skipped'] = [];
    const eligible: string[] = [];
    for (const email of normalizedEmails) {
      if (alreadyMemberEmails.has(email)) {
        skipped.push({ email, reason: 'Already a member' });
      } else if (alreadyInvitedEmails.has(email)) {
        skipped.push({ email, reason: 'Invitation already pending' });
      } else {
        eligible.push(email);
      }
    }

    if (eligible.length === 0) {
      return { created: [], skipped };
    }

    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : 'A teammate';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);

    const created: CreateInvitationsResult['created'] = [];
    for (const email of eligible) {
      const plaintext = crypto.randomBytes(INVITATION_TOKEN_BYTES).toString('base64url');
      const tokenHash = hashToken(plaintext);

      const invitation = await this.prisma.teamInvitation.create({
        data: {
          teamId,
          email,
          role,
          invitedByUserId: inviterUserId,
          tokenHash,
          expiresAt,
        },
      });

      const acceptUrl = `${this.config.get('WEB_APP_URL', { infer: true })}/invitations/accept?token=${plaintext}`;
      try {
        await this.mail.sendInvitation({
          to: email,
          inviterName,
          teamName: team.name,
          acceptUrl,
          expiresAt,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to deliver invitation email for ${email}: ${(err as Error).message}`,
        );
      }

      created.push({ id: invitation.id, email, status: invitation.status });
    }

    return { created, skipped };
  }

  async listForTeam(teamId: string): Promise<TeamInvitation[]> {
    return this.prisma.teamInvitation.findMany({
      where: { teamId, status: InvitationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(teamId: string, invitationId: string): Promise<void> {
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: { id: invitationId, teamId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException('Invitation is no longer pending');
    }
    await this.prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    });
  }

  /**
   * Resolve a token to a preview without consuming it. Public — used by the
   * frontend to show invitation context before login/register.
   */
  async resolveToken(token: string): Promise<InvitationPreview> {
    const tokenHash = hashToken(token);
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { tokenHash },
      include: {
        team: { select: { id: true, name: true } },
        invitedBy: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!invitation) throw new NotFoundException('Invitation not found');

    await this.maybeMarkExpired(invitation);

    if (invitation.status === InvitationStatus.REVOKED) {
      throw new ForbiddenException('Invitation has been revoked');
    }
    if (
      invitation.status === InvitationStatus.EXPIRED ||
      invitation.expiresAt < new Date()
    ) {
      throw new ForbiddenException('Invitation has expired');
    }
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException('Invitation has already been accepted');
    }

    const inviterName = invitation.invitedBy?.user
      ? `${invitation.invitedBy.user.firstName} ${invitation.invitedBy.user.lastName}`.trim()
      : null;

    return {
      email: invitation.email,
      teamId: invitation.team.id,
      teamName: invitation.team.name,
      role: invitation.role,
      inviterName,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Accept an invitation as the currently-authenticated user. Verifies the
   * user's email matches the invite email, then adds them to the team and
   * marks the invitation accepted in one transaction.
   */
  async accept(token: string, userId: string): Promise<{ teamId: string }> {
    const tokenHash = hashToken(token);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { tokenHash },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    await this.maybeMarkExpired(invitation);

    if (invitation.status === InvitationStatus.REVOKED) {
      throw new ForbiddenException('Invitation has been revoked');
    }
    if (
      invitation.status === InvitationStatus.EXPIRED ||
      invitation.expiresAt < new Date()
    ) {
      throw new ForbiddenException('Invitation has expired');
    }
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException('Invitation has already been accepted');
    }
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException(
        `Invitation is for ${invitation.email}; your account is ${user.email}`,
      );
    }

    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: invitation.teamId, userId: user.id } },
    });

    await this.prisma.$transaction([
      ...(existing
        ? []
        : [
            this.prisma.teamMember.create({
              data: {
                teamId: invitation.teamId,
                userId: user.id,
                role: invitation.role,
              },
            }),
          ]),
      this.prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
      }),
    ]);

    return { teamId: invitation.teamId };
  }

  private async maybeMarkExpired(invitation: TeamInvitation): Promise<void> {
    if (
      invitation.status === InvitationStatus.PENDING &&
      invitation.expiresAt < new Date()
    ) {
      await this.prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      invitation.status = InvitationStatus.EXPIRED;
    }
  }
}

function hashToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}
