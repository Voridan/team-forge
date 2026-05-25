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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TeamRole } from '../../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { RequireRole } from '../teams/decorators/require-role.decorator';
import { TeamRoleGuard } from '../teams/guards/team-role.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

const ROLE_LEVEL: Record<TeamRole, number> = {
  GUEST: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

@Controller('teams/:teamId/tasks')
@UseGuards(TeamRoleGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @RequireRole(TeamRole.MEMBER)
  create(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(teamId, user.id, dto);
  }

  @Get()
  @RequireRole(TeamRole.MEMBER)
  list(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Query() filters: ListTasksDto,
  ) {
    return this.tasksService.list(teamId, filters);
  }

  @Get(':taskId')
  @RequireRole(TeamRole.MEMBER)
  getOne(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.tasksService.getById(teamId, taskId);
  }

  @Patch(':taskId')
  @RequireRole(TeamRole.MEMBER)
  update(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(teamId, taskId, user.id, dto);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(TeamRole.ADMIN)
  async remove(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ): Promise<void> {
    await this.tasksService.delete(teamId, taskId);
  }

  @Get(':taskId/comments')
  @RequireRole(TeamRole.MEMBER)
  listComments(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.tasksService.listComments(teamId, taskId);
  }

  @Post(':taskId/comments')
  @RequireRole(TeamRole.MEMBER)
  addComment(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.tasksService.addComment(teamId, taskId, user.id, dto);
  }

  @Patch(':taskId/comments/:commentId')
  @RequireRole(TeamRole.MEMBER)
  updateComment(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.tasksService.updateComment(teamId, commentId, user.id, dto);
  }

  @Delete(':taskId/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(TeamRole.MEMBER)
  async removeComment(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    const requesterRole = req.membership?.role ?? TeamRole.GUEST;
    const isAdminOrHigher = ROLE_LEVEL[requesterRole] >= ROLE_LEVEL.ADMIN;
    await this.tasksService.deleteComment(teamId, commentId, user.id, isAdminOrHigher);
  }
}
