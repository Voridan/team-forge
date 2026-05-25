"""
Default recommendation thresholds.

Mirrors `api/src/modules/analytics-settings/analytics-thresholds.constants.ts`. Used as a
fallback when a team has no `team_analytics_settings` row (cold-start defense). Per-team
overrides come from that table when present.
"""
from typing import Final

WORKLOAD_MAX_MEDIAN_WARN: Final = 2.0
WORKLOAD_MAX_MEDIAN_CRIT: Final = 3.0

REVIEW_P75_DAYS_WARN: Final = 2.0
REVIEW_P75_DAYS_CRIT: Final = 4.0

THROUGHPUT_DROP_PCT_WARN: Final = 20.0
THROUGHPUT_DROP_PCT_CRIT: Final = 40.0

OVERDUE_COUNT_WARN: Final = 3
OVERDUE_COUNT_CRIT: Final = 7
