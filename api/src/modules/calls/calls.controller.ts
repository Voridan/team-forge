import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TeamRole } from '../../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { RequireRole } from '../teams/decorators/require-role.decorator';
import { TeamRoleGuard } from '../teams/guards/team-role.guard';
import { CallsService } from './calls.service';
import { ListCallsHistoryDto } from './dto/list-calls-history.dto';

@Controller('teams/:teamId/calls')
@UseGuards(TeamRoleGuard)
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Post()
  @RequireRole(TeamRole.MEMBER)
  start(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calls.start(teamId, user.id);
  }

  @Get('active')
  @RequireRole(TeamRole.MEMBER)
  getActive(@Param('teamId', new ParseUUIDPipe()) teamId: string) {
    return this.calls.getActive(teamId);
  }

  @Get()
  @RequireRole(TeamRole.ADMIN)
  listHistory(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Query() filters: ListCallsHistoryDto,
  ) {
    return this.calls.listHistory(teamId, filters);
  }

  @Get(':callId')
  @RequireRole(TeamRole.MEMBER)
  getById(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('callId', new ParseUUIDPipe()) callId: string,
  ) {
    return this.calls.getById(teamId, callId);
  }

  @Post(':callId/join')
  @RequireRole(TeamRole.MEMBER)
  join(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('callId', new ParseUUIDPipe()) callId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calls.join(teamId, callId, user.id);
  }

  @Delete(':callId/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(TeamRole.MEMBER)
  async leave(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('callId', new ParseUUIDPipe()) callId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.calls.leave(teamId, callId, user.id);
  }
}
