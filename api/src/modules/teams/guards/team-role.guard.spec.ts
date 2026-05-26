import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TeamRole } from '../../../../generated/prisma/client';
import { REQUIRED_ROLE_KEY } from '../decorators/require-role.decorator';
import { TeamRoleGuard } from './team-role.guard';

const TEAM_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

type MockPrisma = { teamMember: { findUnique: jest.Mock } };

function makeMockPrisma(): MockPrisma {
  return { teamMember: { findUnique: jest.fn() } };
}

function makeContext({
  required,
  userId,
  teamId,
}: {
  required?: TeamRole;
  userId?: string;
  teamId?: string;
}): { ctx: ExecutionContext; req: any } {
  const handler = jest.fn();
  const cls = jest.fn();
  const req: any = {
    user: userId ? { id: userId } : undefined,
    params: teamId ? { teamId } : {},
  };

  const ctx = {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;

  // Tag handler with metadata for the reflector to pick up
  if (required) {
    Reflect.defineMetadata(REQUIRED_ROLE_KEY, required, handler);
  }

  return { ctx, req };
}

describe('TeamRoleGuard', () => {
  let prisma: MockPrisma;
  let guard: TeamRoleGuard;
  let reflector: Reflector;

  beforeEach(() => {
    prisma = makeMockPrisma();
    reflector = new Reflector();
    guard = new TeamRoleGuard(reflector, prisma as never);
  });

  it('allows the request when no role is required', async () => {
    const { ctx } = makeContext({ userId: USER_ID, teamId: TEAM_ID });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when authentication context is missing', async () => {
    const { ctx } = makeContext({ required: TeamRole.MEMBER, teamId: TEAM_ID });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFoundException when the user is not a member (hides team existence)', async () => {
    prisma.teamMember.findUnique.mockResolvedValue(null);
    const { ctx } = makeContext({
      required: TeamRole.MEMBER,
      userId: USER_ID,
      teamId: TEAM_ID,
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException when the user’s role is below the required level', async () => {
    prisma.teamMember.findUnique.mockResolvedValue({ role: TeamRole.MEMBER });
    const { ctx } = makeContext({
      required: TeamRole.ADMIN,
      userId: USER_ID,
      teamId: TEAM_ID,
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('passes when the user’s role meets the requirement and attaches membership', async () => {
    const member = { role: TeamRole.OWNER, teamId: TEAM_ID, userId: USER_ID };
    prisma.teamMember.findUnique.mockResolvedValue(member);
    const { ctx, req } = makeContext({
      required: TeamRole.ADMIN,
      userId: USER_ID,
      teamId: TEAM_ID,
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.membership).toEqual(member);
  });

  it('passes at exactly the required role level', async () => {
    prisma.teamMember.findUnique.mockResolvedValue({ role: TeamRole.MEMBER });
    const { ctx } = makeContext({
      required: TeamRole.MEMBER,
      userId: USER_ID,
      teamId: TEAM_ID,
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
