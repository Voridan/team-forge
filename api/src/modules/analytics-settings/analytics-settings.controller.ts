import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { TeamRole } from '../../../generated/prisma/client';
import { RequireRole } from '../teams/decorators/require-role.decorator';
import { TeamRoleGuard } from '../teams/guards/team-role.guard';
import { AnalyticsSettingsService } from './analytics-settings.service';
import { UpdateAnalyticsSettingsDto } from './dto/update-analytics-settings.dto';

@Controller('teams/:teamId/analytics-settings')
@UseGuards(TeamRoleGuard)
export class AnalyticsSettingsController {
  constructor(private readonly service: AnalyticsSettingsService) {}

  @Get()
  @RequireRole(TeamRole.ADMIN)
  get(@Param('teamId', new ParseUUIDPipe()) teamId: string) {
    return this.service.get(teamId);
  }

  @Patch()
  @RequireRole(TeamRole.ADMIN)
  update(
    @Param('teamId', new ParseUUIDPipe()) teamId: string,
    @Body() dto: UpdateAnalyticsSettingsDto,
  ) {
    return this.service.update(teamId, dto);
  }
}
