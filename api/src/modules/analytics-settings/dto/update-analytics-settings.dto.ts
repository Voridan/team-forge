import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ANALYTICS_THRESHOLD_BOUNDS as B } from '../analytics-thresholds.constants';

export class UpdateAnalyticsSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(B.ratioMin)
  @Max(B.ratioMax)
  workloadMaxMedianWarn?: number;

  @IsOptional()
  @IsNumber()
  @Min(B.ratioMin)
  @Max(B.ratioMax)
  workloadMaxMedianCrit?: number;

  @IsOptional()
  @IsNumber()
  @Min(B.daysMin)
  @Max(B.daysMax)
  reviewP75DaysWarn?: number;

  @IsOptional()
  @IsNumber()
  @Min(B.daysMin)
  @Max(B.daysMax)
  reviewP75DaysCrit?: number;

  @IsOptional()
  @IsNumber()
  @Min(B.pctMin)
  @Max(B.pctMax)
  throughputDropPctWarn?: number;

  @IsOptional()
  @IsNumber()
  @Min(B.pctMin)
  @Max(B.pctMax)
  throughputDropPctCrit?: number;

  @IsOptional()
  @IsInt()
  @Min(B.countMin)
  @Max(B.countMax)
  overdueCountWarn?: number;

  @IsOptional()
  @IsInt()
  @Min(B.countMin)
  @Max(B.countMax)
  overdueCountCrit?: number;
}
