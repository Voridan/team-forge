import { Module } from '@nestjs/common';
import { TeamRoleGuard } from './guards/team-role.guard';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, TeamRoleGuard],
  exports: [TeamsService],
})
export class TeamsModule {}
