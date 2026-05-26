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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TeamRole } from '../../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { RequireRole } from '../teams/decorators/require-role.decorator';
import { TeamRoleGuard } from '../teams/guards/team-role.guard';
import { AttachmentsService } from './attachments.service';
import { PresignAttachmentDto } from './dto/presign-attachment.dto';

const ROLE_LEVEL: Record<TeamRole, number> = {
  GUEST: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

@Controller('teams/:teamId/attachments')
@UseGuards(TeamRoleGuard)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post('presign')
  @RequireRole(TeamRole.MEMBER)
  presign(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PresignAttachmentDto,
  ) {
    return this.attachments.presign(teamId, user.id, dto);
  }

  @Post(':id/confirm')
  @RequireRole(TeamRole.MEMBER)
  confirm(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachments.confirmUpload(teamId, user.id, id);
  }

  @Get(':id/download')
  @RequireRole(TeamRole.MEMBER)
  download(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachments.getDownload(teamId, user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRole(TeamRole.MEMBER)
  async remove(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    const requesterRole = req.membership?.role ?? TeamRole.GUEST;
    const isAdminOrHigher = ROLE_LEVEL[requesterRole] >= ROLE_LEVEL.ADMIN;
    await this.attachments.delete(teamId, user.id, id, isAdminOrHigher);
  }
}
