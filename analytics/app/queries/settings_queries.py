"""
Read per-team analytics thresholds from the `team_analytics_settings` table.

If a team has no settings row (cold-start edge case), fall back to the named
constants in `app.constants` — same defaults as the API service creates on team
creation.
"""
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.constants import (
    OVERDUE_COUNT_CRIT,
    OVERDUE_COUNT_WARN,
    REVIEW_P75_DAYS_CRIT,
    REVIEW_P75_DAYS_WARN,
    THROUGHPUT_DROP_PCT_CRIT,
    THROUGHPUT_DROP_PCT_WARN,
    WORKLOAD_MAX_MEDIAN_CRIT,
    WORKLOAD_MAX_MEDIAN_WARN,
)
from app.core.db import get_pool


@dataclass(frozen=True, slots=True)
class TeamThresholds:
    workload_max_median_warn: float
    workload_max_median_crit: float
    review_p75_days_warn: float
    review_p75_days_crit: float
    throughput_drop_pct_warn: float
    throughput_drop_pct_crit: float
    overdue_count_warn: int
    overdue_count_crit: int


_DEFAULTS = TeamThresholds(
    workload_max_median_warn=WORKLOAD_MAX_MEDIAN_WARN,
    workload_max_median_crit=WORKLOAD_MAX_MEDIAN_CRIT,
    review_p75_days_warn=REVIEW_P75_DAYS_WARN,
    review_p75_days_crit=REVIEW_P75_DAYS_CRIT,
    throughput_drop_pct_warn=THROUGHPUT_DROP_PCT_WARN,
    throughput_drop_pct_crit=THROUGHPUT_DROP_PCT_CRIT,
    overdue_count_warn=OVERDUE_COUNT_WARN,
    overdue_count_crit=OVERDUE_COUNT_CRIT,
)


_SELECT_SQL = """
SELECT workload_max_median_warn, workload_max_median_crit,
       review_p75_days_warn, review_p75_days_crit,
       throughput_drop_pct_warn, throughput_drop_pct_crit,
       overdue_count_warn, overdue_count_crit
FROM team_analytics_settings
WHERE team_id = $1
"""


async def get_team_thresholds(team_id: UUID) -> TeamThresholds:
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(_SELECT_SQL, team_id)
    if row is None:
        return _DEFAULTS
    return TeamThresholds(
        workload_max_median_warn=float(row["workload_max_median_warn"]),
        workload_max_median_crit=float(row["workload_max_median_crit"]),
        review_p75_days_warn=float(row["review_p75_days_warn"]),
        review_p75_days_crit=float(row["review_p75_days_crit"]),
        throughput_drop_pct_warn=float(row["throughput_drop_pct_warn"]),
        throughput_drop_pct_crit=float(row["throughput_drop_pct_crit"]),
        overdue_count_warn=int(row["overdue_count_warn"]),
        overdue_count_crit=int(row["overdue_count_crit"]),
    )
