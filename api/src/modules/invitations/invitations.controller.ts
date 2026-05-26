import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TeamRole } from '../../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { RequireRole } from '../teams/decorators/require-role.decorator';
import { TeamRoleGuard } from '../teams/guards/team-role.guard';
import { CreateInvitationsDto } from './dto/create-invitations.dto';
import { InvitationsService } from './invitations.service';

@Controller('teams/:teamId/invitations')
@UseGuards(TeamRoleGuard)
export class TeamInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @RequireRole(TeamRole.ADMIN)
  create(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationsDto,
  ) {
    return this.invitations.createMany(teamId, user.id, dto.emails, dto.role);
  }

  @Get()
  @RequireRole(TeamRole.ADMIN)
  list(@Param('teamId', new ParseUUIDPipe()) teamId: string) {
    return this.invitations.listForTeam(teamId);
  }

  @Delete(':invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(TeamRole.ADMIN)
  async revoke(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
  ): Promise<void> {
    await this.invitations.revoke(teamId, invitationId);
  }
}

@Controller('invitations')
export class PublicInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  /** Public preview — does not consume the invitation. */
  @Get(':token')
  resolve(@Param('token') token: string) {
    return this.invitations.resolveToken(token);
  }

  /** Requires authentication — the JWT middleware applies. */
  @Post(':token/accept')
  accept(@Param('token') token: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invitations.accept(token, user.id);
  }
}
