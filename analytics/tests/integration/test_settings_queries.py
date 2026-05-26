"""Integration tests for get_team_thresholds()."""
from __future__ import annotations

from uuid import uuid4

from app.constants import (
    OVERDUE_COUNT_WARN,
    REVIEW_P75_DAYS_WARN,
    WORKLOAD_MAX_MEDIAN_WARN,
)
from app.queries.settings_queries import get_team_thresholds

from .fixtures import insert_team


class TestGetTeamThresholds:
    async def test_team_without_settings_returns_defaults(self, clean_db):
        team_id = await insert_team(clean_db)
        # No insert into team_analytics_settings → falls back to defaults

        result = await get_team_thresholds(team_id)

        assert result.workload_max_median_warn == WORKLOAD_MAX_MEDIAN_WARN
        assert result.review_p75_days_warn == REVIEW_P75_DAYS_WARN
        assert result.overdue_count_warn == OVERDUE_COUNT_WARN

    async def test_team_with_overrides_returns_those_values(self, clean_db):
        team_id = await insert_team(clean_db)
        await clean_db.execute(
            """
            INSERT INTO team_analytics_settings
              (team_id, workload_max_median_warn, workload_max_median_crit,
               review_p75_days_warn, review_p75_days_crit,
               throughput_drop_pct_warn, throughput_drop_pct_crit,
               overdue_count_warn, overdue_count_crit)
            VALUES ($1, 1.5, 2.5, 3.0, 6.0, 30, 50, 5, 10)
            """,
            team_id,
        )

        result = await get_team_thresholds(team_id)

        assert result.workload_max_median_warn == 1.5
        assert result.workload_max_median_crit == 2.5
        assert result.review_p75_days_warn == 3.0
        assert result.review_p75_days_crit == 6.0
        assert result.throughput_drop_pct_warn == 30.0
        assert result.overdue_count_warn == 5
        assert result.overdue_count_crit == 10

    async def test_unknown_team_id_returns_defaults(self, clean_db):
        # No team at all — should still return defaults, not raise
        result = await get_team_thresholds(uuid4())

        assert result.workload_max_median_warn == WORKLOAD_MAX_MEDIAN_WARN
