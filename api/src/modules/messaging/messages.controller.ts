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
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessagesService } from './messages.service';

const ROLE_LEVEL: Record<TeamRole, number> = {
  GUEST: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

@Controller('teams/:teamId/channels/:channelId/messages')
@UseGuards(TeamRoleGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @RequireRole(TeamRole.MEMBER)
  list(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
    @Query() filters: ListMessagesDto,
  ) {
    return this.messages.listForChannel(teamId, channelId, filters);
  }

  @Post()
  @RequireRole(TeamRole.MEMBER)
  create(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messages.create(teamId, channelId, user.id, dto);
  }

  @Patch(':messageId')
  @RequireRole(TeamRole.MEMBER)
  update(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messages.update(teamId, channelId, messageId, user.id, dto);
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(TeamRole.MEMBER)
  async remove(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    const requesterRole = req.membership?.role ?? TeamRole.GUEST;
    const isAdminOrHigher = ROLE_LEVEL[requesterRole] >= ROLE_LEVEL.ADMIN;
    await this.messages.delete(teamId, channelId, messageId, user.id, isAdminOrHigher);
  }
}
