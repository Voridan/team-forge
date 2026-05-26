import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TeamRole } from '../../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { RequireRole } from './decorators/require-role.decorator';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamRoleGuard } from './guards/team-role.guard';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(TeamRoleGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.listForUser(user.id);
  }

  @Post(':teamId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(TeamRole.MEMBER)
  async leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
  ): Promise<void> {
    await this.teamsService.leaveTeam(teamId, user.id);
  }

  @Get(':teamId/members')
  @RequireRole(TeamRole.MEMBER)
  listMembers(@Param('teamId', new ParseUUIDPipe()) teamId: string) {
    return this.teamsService.listMembers(teamId);
  }

  @Post(':teamId/members')
  @RequireRole(TeamRole.ADMIN)
  addMembers(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.teamsService.addMembers(teamId, dto.userIds, dto.role);
  }

  @Patch(':teamId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(TeamRole.OWNER)
  async updateMemberRole(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<void> {
    await this.teamsService.updateMemberRole(teamId, userId, dto.role);
  }

  @Delete(':teamId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(TeamRole.ADMIN)
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    await this.teamsService.removeMember(teamId, userId, user.id);
  }

  @Get(':teamId')
  @RequireRole(TeamRole.MEMBER)
  getOne(@Param('teamId', new ParseUUIDPipe()) teamId: string) {
    return this.teamsService.getById(teamId);
  }

  @Patch(':teamId')
  @RequireRole(TeamRole.ADMIN)
  update(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.update(teamId, dto);
  }

  @Delete(':teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(TeamRole.OWNER)
  async remove(@Param('teamId', new ParseUUIDPipe()) teamId: string): Promise<void> {
    await this.teamsService.delete(teamId);
  }
}
