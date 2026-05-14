import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TeamRole } from '../../../generated/prisma/client';
import { TeamsService } from './teams.service';

type MockPrisma = {
  team: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
  teamMember: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    createMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  task: { updateMany: jest.Mock };
  taskComment: { updateMany: jest.Mock };
  user: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

function makeMockPrisma(): MockPrisma {
  return {
    team: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    teamMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    task: { updateMany: jest.fn() },
    taskComment: { updateMany: jest.fn() },
    user: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

const TEAM_ID = '11111111-1111-1111-1111-111111111111';
const ALICE = '22222222-2222-2222-2222-222222222222';
const BOB = '33333333-3333-3333-3333-333333333333';
const CHARLIE = '44444444-4444-4444-4444-444444444444';

describe('TeamsService', () => {
  let prisma: MockPrisma;
  let service: TeamsService;

  beforeEach(() => {
    prisma = makeMockPrisma();
    service = new TeamsService(prisma as never);
  });

  describe('create', () => {
    it('creates the team with the creator as OWNER in a single nested write', async () => {
      const created = { id: TEAM_ID, name: 'Eng', description: null };
      prisma.team.create.mockResolvedValue(created);

      const result = await service.create(ALICE, { name: 'Eng' });

      expect(prisma.team.create).toHaveBeenCalledWith({
        data: {
          name: 'Eng',
          description: undefined,
          members: { create: { userId: ALICE, role: TeamRole.OWNER } },
        },
      });
      expect(result).toEqual(created);
    });
  });

  describe('listForUser', () => {
    it('flattens membership + team + count into a TeamSummary', async () => {
      prisma.teamMember.findMany.mockResolvedValue([
        {
          role: TeamRole.OWNER,
          team: {
            id: TEAM_ID,
            name: 'Eng',
            description: 'Engineering team',
            createdAt: new Date('2026-01-01'),
            _count: { members: 3 },
          },
        },
      ]);

      const result = await service.listForUser(ALICE);

      expect(result).toEqual([
        {
          id: TEAM_ID,
          name: 'Eng',
          description: 'Engineering team',
          memberCount: 3,
          role: TeamRole.OWNER,
          createdAt: new Date('2026-01-01'),
        },
      ]);
    });
  });

  describe('addMembers', () => {
    it('rejects assigning OWNER role through the bulk add endpoint', async () => {
      await expect(
        service.addMembers(TEAM_ID, [BOB], TeamRole.OWNER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('rejects when one or more userIds do not exist', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: BOB }]); // CHARLIE missing

      await expect(
        service.addMembers(TEAM_ID, [BOB, CHARLIE]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.teamMember.createMany).not.toHaveBeenCalled();
    });

    it('skips existing members and inserts only the new ones', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: BOB }, { id: CHARLIE }]);
      prisma.teamMember.findMany.mockResolvedValue([{ userId: BOB }]); // BOB already in team
      prisma.teamMember.createMany.mockResolvedValue({ count: 1 });

      const result = await service.addMembers(TEAM_ID, [BOB, CHARLIE]);

      expect(prisma.teamMember.createMany).toHaveBeenCalledWith({
        data: [{ teamId: TEAM_ID, userId: CHARLIE, role: TeamRole.MEMBER }],
      });
      expect(result).toEqual({ added: [{ userId: CHARLIE, role: TeamRole.MEMBER }] });
    });

    it('throws ConflictException when all candidates are already members', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: BOB }]);
      prisma.teamMember.findMany.mockResolvedValue([{ userId: BOB }]);

      await expect(service.addMembers(TEAM_ID, [BOB])).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.teamMember.createMany).not.toHaveBeenCalled();
    });
  });

  describe('updateMemberRole', () => {
    it('updates the member’s role on a normal change', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: TeamRole.MEMBER });

      await service.updateMemberRole(TEAM_ID, BOB, TeamRole.ADMIN);

      expect(prisma.teamMember.update).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId: TEAM_ID, userId: BOB } },
        data: { role: TeamRole.ADMIN },
      });
    });

    it('is a no-op when the role is unchanged', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: TeamRole.ADMIN });

      await service.updateMemberRole(TEAM_ID, BOB, TeamRole.ADMIN);

      expect(prisma.teamMember.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the member is not on the team', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(TEAM_ID, BOB, TeamRole.ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to demote the last OWNER', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: TeamRole.OWNER });
      prisma.teamMember.count.mockResolvedValue(1);

      await expect(
        service.updateMemberRole(TEAM_ID, ALICE, TeamRole.ADMIN),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.teamMember.update).not.toHaveBeenCalled();
    });

    it('allows demoting an OWNER when others remain', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: TeamRole.OWNER });
      prisma.teamMember.count.mockResolvedValue(2);

      await service.updateMemberRole(TEAM_ID, ALICE, TeamRole.ADMIN);

      expect(prisma.teamMember.update).toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('rejects a self-removal request and points users to /leave', async () => {
      await expect(service.removeMember(TEAM_ID, ALICE, ALICE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.teamMember.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when target is not a member', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.removeMember(TEAM_ID, BOB, ALICE)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuses to remove the last OWNER', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: TeamRole.OWNER });
      prisma.teamMember.count.mockResolvedValue(1);

      await expect(service.removeMember(TEAM_ID, BOB, ALICE)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.teamMember.delete).not.toHaveBeenCalled();
    });

    it('removes a non-owner member', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: TeamRole.MEMBER });

      await service.removeMember(TEAM_ID, BOB, ALICE);

      expect(prisma.teamMember.delete).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId: TEAM_ID, userId: BOB } },
      });
    });
  });

  describe('leaveTeam', () => {
    it('throws when the requester is not a member', async () => {
      prisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.leaveTeam(TEAM_ID, ALICE)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('refuses if the requester is the only OWNER', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: TeamRole.OWNER });
      prisma.teamMember.count.mockResolvedValue(1);

      await expect(service.leaveTeam(TEAM_ID, ALICE)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('lets a non-owner leave', async () => {
      prisma.teamMember.findUnique.mockResolvedValue({ role: TeamRole.MEMBER });

      await service.leaveTeam(TEAM_ID, ALICE);

      expect(prisma.teamMember.delete).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId: TEAM_ID, userId: ALICE } },
      });
    });
  });
});
