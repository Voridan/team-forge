/**
 * Default thresholds for per-team analytics recommendations.
 *
 * Mirrors `analytics/app/constants.py`. Used when a team is created (initial row values)
 * and as a fallback in the analytics service if a settings row is missing.
 */
export const DEFAULT_ANALYTICS_THRESHOLDS = {
  workloadMaxMedianWarn: 2.0,
  workloadMaxMedianCrit: 3.0,
  reviewP75DaysWarn: 2.0,
  reviewP75DaysCrit: 4.0,
  throughputDropPctWarn: 20.0,
  throughputDropPctCrit: 40.0,
  overdueCountWarn: 3,
  overdueCountCrit: 7,
} as const;

export const ANALYTICS_THRESHOLD_BOUNDS = {
  ratioMin: 1.0,
  ratioMax: 100.0,
  daysMin: 0.0,
  daysMax: 365.0,
  pctMin: 0.0,
  pctMax: 100.0,
  countMin: 0,
  countMax: 10_000,
} as const;
