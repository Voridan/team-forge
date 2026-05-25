import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TeamAnalyticsSettings } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_ANALYTICS_THRESHOLDS } from './analytics-thresholds.constants';
import { UpdateAnalyticsSettingsDto } from './dto/update-analytics-settings.dto';

@Injectable()
export class AnalyticsSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(teamId: string): Promise<TeamAnalyticsSettings> {
    const settings = await this.prisma.teamAnalyticsSettings.findUnique({
      where: { teamId },
    });
    if (!settings) {
      throw new NotFoundException('Analytics settings not initialized for this team');
    }
    return settings;
  }

  async update(
    teamId: string,
    dto: UpdateAnalyticsSettingsDto,
  ): Promise<TeamAnalyticsSettings> {
    const next = { ...(await this.get(teamId)), ...dto };
    this.assertCritExceedsWarn(next);

    return this.prisma.teamAnalyticsSettings.update({
      where: { teamId },
      data: dto,
    });
  }

  /**
   * The "critical" threshold must be strictly greater than its "warn" counterpart;
   * otherwise the recommendation engine can never produce a 'critical' severity.
   */
  private assertCritExceedsWarn(s: {
    workloadMaxMedianWarn: number;
    workloadMaxMedianCrit: number;
    reviewP75DaysWarn: number;
    reviewP75DaysCrit: number;
    throughputDropPctWarn: number;
    throughputDropPctCrit: number;
    overdueCountWarn: number;
    overdueCountCrit: number;
  }): void {
    const checks: [string, number, number][] = [
      ['workloadMaxMedian', s.workloadMaxMedianWarn, s.workloadMaxMedianCrit],
      ['reviewP75Days', s.reviewP75DaysWarn, s.reviewP75DaysCrit],
      ['throughputDropPct', s.throughputDropPctWarn, s.throughputDropPctCrit],
      ['overdueCount', s.overdueCountWarn, s.overdueCountCrit],
    ];

    const invalid = checks.filter(([, warn, crit]) => crit <= warn);
    if (invalid.length > 0) {
      const names = invalid.map(([name]) => name).join(', ');
      throw new BadRequestException(
        `Critical threshold must exceed warn for: ${names}`,
      );
    }
  }

  static defaults(): typeof DEFAULT_ANALYTICS_THRESHOLDS {
    return DEFAULT_ANALYTICS_THRESHOLDS;
  }
}
