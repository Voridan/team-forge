import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { TeamMember, TeamRole } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { REQUIRED_ROLE_KEY } from '../decorators/require-role.decorator';

const ROLE_LEVEL: Record<TeamRole, number> = {
  GUEST: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

declare module 'express' {
  interface Request {
    membership?: TeamMember;
  }
}

@Injectable()
export class TeamRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.get<TeamRole>(REQUIRED_ROLE_KEY, ctx.getHandler()) ??
      this.reflector.get<TeamRole>(REQUIRED_ROLE_KEY, ctx.getClass());

    if (!required) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const userId = req.user?.id;
    const rawTeamId = req.params.teamId;
    const teamId = typeof rawTeamId === 'string' ? rawTeamId : undefined;

    if (!userId || !teamId) {
      throw new ForbiddenException('Missing authentication or team context');
    }

    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!member) {
      throw new NotFoundException('Team not found');
    }

    if (ROLE_LEVEL[member.role] < ROLE_LEVEL[required]) {
      throw new ForbiddenException(`Requires ${required} role or higher`);
    }

    req.membership = member;
    return true;
  }
}
