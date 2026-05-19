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
import { RequireRole } from '../teams/decorators/require-role.decorator';
import { TeamRoleGuard } from '../teams/guards/team-role.guard';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Controller('teams/:teamId/channels')
@UseGuards(TeamRoleGuard)
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Post()
  @RequireRole(TeamRole.MEMBER)
  create(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.channels.create(teamId, dto);
  }

  @Get()
  @RequireRole(TeamRole.MEMBER)
  list(@Param('teamId', new ParseUUIDPipe()) teamId: string) {
    return this.channels.listForTeam(teamId);
  }

  @Get(':channelId')
  @RequireRole(TeamRole.MEMBER)
  getOne(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
  ) {
    return this.channels.getById(teamId, channelId);
  }

  @Patch(':channelId')
  @RequireRole(TeamRole.ADMIN)
  update(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channels.update(teamId, channelId, dto);
  }

  @Delete(':channelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(TeamRole.ADMIN)
  async archive(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('channelId', new ParseUUIDPipe()) channelId: string,
  ): Promise<void> {
    await this.channels.archive(teamId, channelId);
  }
}
