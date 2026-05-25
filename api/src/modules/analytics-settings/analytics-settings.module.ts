import { Module } from '@nestjs/common';
import { TeamsModule } from '../teams/teams.module';
import { AnalyticsSettingsController } from './analytics-settings.controller';
import { AnalyticsSettingsService } from './analytics-settings.service';

@Module({
  imports: [TeamsModule],
  controllers: [AnalyticsSettingsController],
  providers: [AnalyticsSettingsService],
  exports: [AnalyticsSettingsService],
})
export class AnalyticsSettingsModule {}
