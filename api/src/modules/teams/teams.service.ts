import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Team, TeamRole } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

export interface TeamSummary {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  role: TeamRole;
  createdAt: Date;
}

export interface TeamMemberPublic {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: TeamRole;
  joinedAt: Date;
}

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(creatorId: string, dto: CreateTeamDto): Promise<Team> {
    return this.prisma.team.create({
      data: {
        name: dto.name,
        description: dto.description,
        members: {
          create: { userId: creatorId, role: TeamRole.OWNER },
        },
      },
    });
  }

  async listForUser(userId: string): Promise<TeamSummary[]> {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: { include: { _count: { select: { members: true } } } },
      },
      orderBy: { team: { createdAt: 'desc' } },
    });

    return memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      description: m.team.description,
      memberCount: m.team._count.members,
      role: m.role,
      createdAt: m.team.createdAt,
    }));
  }

  async getById(teamId: string): Promise<Team> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async update(teamId: string, dto: UpdateTeamDto): Promise<Team> {
    return this.prisma.team.update({ where: { id: teamId }, data: dto });
  }

  async delete(teamId: string): Promise<void> {
    await this.prisma.team.delete({ where: { id: teamId } });
  }

  async listMembers(teamId: string): Promise<TeamMemberPublic[]> {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async addMembers(
    teamId: string,
    userIds: string[],
    role: TeamRole = TeamRole.MEMBER,
  ): Promise<{ added: { userId: string; role: TeamRole }[] }> {
    if (role === TeamRole.OWNER) {
      throw new BadRequestException('Use updateMemberRole to assign OWNER role');
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    });
    if (users.length !== userIds.length) {
      throw new BadRequestException('One or more user IDs are invalid');
    }

    const existing = await this.prisma.teamMember.findMany({
      where: { teamId, userId: { in: userIds } },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((m) => m.userId));
    const newIds = userIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) {
      throw new ConflictException('All specified users are already team members');
    }

    await this.prisma.teamMember.createMany({
      data: newIds.map((userId) => ({ teamId, userId, role })),
    });

    return { added: newIds.map((userId) => ({ userId, role })) };
  }

  async updateMemberRole(teamId: string, userId: string, newRole: TeamRole): Promise<void> {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found in this team');

    if (member.role === newRole) return;

    if (member.role === TeamRole.OWNER && newRole !== TeamRole.OWNER) {
      await this.assertNotLastOwner(teamId);
    }

    await this.prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role: newRole },
    });
  }

  async removeMember(teamId: string, userId: string, requesterId: string): Promise<void> {
    if (userId === requesterId) {
      throw new BadRequestException('Use POST /teams/:teamId/leave to remove yourself');
    }

    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new NotFoundException('Member not found in this team');

    if (member.role === TeamRole.OWNER) {
      await this.assertNotLastOwner(teamId);
    }

    await this.detachAndDelete(teamId, userId);
  }

  async leaveTeam(teamId: string, userId: string): Promise<void> {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new NotFoundException('You are not a member of this team');

    if (member.role === TeamRole.OWNER) {
      await this.assertNotLastOwner(teamId);
    }

    await this.detachAndDelete(teamId, userId);
  }

  private async assertNotLastOwner(teamId: string): Promise<void> {
    const ownerCount = await this.prisma.teamMember.count({
      where: { teamId, role: TeamRole.OWNER },
    });
    if (ownerCount <= 1) {
      throw new ConflictException(
        'Cannot remove the last owner. Promote another member or delete the team first.',
      );
    }
  }

  /**
   * Detaches a user from a team's task ecosystem before deleting their TeamMember row.
   * Required because Task/TaskComment FKs to TeamMember use onDelete: NoAction
   * (Postgres limitation — SET NULL on composite FK can't null only the user side).
   * All operations run in a single transaction so partial cleanup is impossible.
   */
  private async detachAndDelete(teamId: string, userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { teamId, assigneeUserId: userId },
        data: { assigneeUserId: null },
      }),
      this.prisma.task.updateMany({
        where: { teamId, reporterUserId: userId },
        data: { reporterUserId: null },
      }),
      this.prisma.taskComment.updateMany({
        where: { teamId, authorUserId: userId },
        data: { authorUserId: null },
      }),
      this.prisma.teamInvitation.updateMany({
        where: { teamId, invitedByUserId: userId },
        data: { invitedByUserId: null },
      }),
      this.prisma.message.updateMany({
        where: { teamId, authorUserId: userId },
        data: { authorUserId: null },
      }),
      this.prisma.attachment.updateMany({
        where: { teamId, uploaderUserId: userId },
        data: { uploaderUserId: null },
      }),
      this.prisma.teamMember.delete({
        where: { teamId_userId: { teamId, userId } },
      }),
    ]);
  }
}
