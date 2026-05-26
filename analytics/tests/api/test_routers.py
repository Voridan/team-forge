"""
Smoke tests for each analytics router. Verifies:
 - unauthenticated requests get 401
 - authenticated admin requests get 200 with the expected response shape

Query functions are monkey-patched so these tests run without a database.
"""
from __future__ import annotations

from datetime import date
from uuid import uuid4

from app.schemas.bottlenecks import (
    BottlenecksResponse,
    CfdPoint,
    CfdResponse,
    StatusStats,
)
from app.schemas.common import TaskStatus
from app.schemas.overview import OverviewResponse
from app.schemas.recommendations import RecommendationsResponse
from app.schemas.throughput import ThroughputResponse, WeeklyBucket
from app.schemas.workload import MemberLoad, WorkloadResponse

from .conftest import TEST_TEAM_ID

_PATH_PREFIX = f"/analytics/v1/teams/{TEST_TEAM_ID}"


def _async_returning(value):
    """Build an async function that ignores its args and returns `value`."""

    async def _fn(*_args, **_kwargs):
        return value

    return _fn


# ---------- canned responses ----------

def _fake_overview() -> OverviewResponse:
    return OverviewResponse(
        teamId=TEST_TEAM_ID,
        openTasks=10,
        completedLast7d=4,
        overdueCount=1,
        maxMedianRatio=1.5,
        reviewBacklogP75Days=2.0,
        activeRecommendations=0,
    )


def _fake_workload() -> WorkloadResponse:
    return WorkloadResponse(
        teamId=TEST_TEAM_ID,
        members=[
            MemberLoad(
                userId=uuid4(),
                firstName="A",
                lastName="B",
                openCount=3,
                byStatus={
                    TaskStatus.TODO: 1,
                    TaskStatus.IN_PROGRESS: 1,
                    TaskStatus.IN_REVIEW: 1,
                    TaskStatus.DONE: 0,
                },
                isOverloaded=False,
            )
        ],
        maxMedianRatio=1.0,
        upperFence=None,
    )


def _fake_throughput() -> ThroughputResponse:
    return ThroughputResponse(
        teamId=TEST_TEAM_ID,
        weeks=[WeeklyBucket(weekStart=date(2026, 1, 1), created=2, completed=1)],
        movingAverage4w=[None],
        latestWeekCompleted=1,
        popDeltaPct=None,
        regressionSlope=None,
        zScore=None,
        overdueCount=0,
        dueSoon=[],
    )


def _fake_bottlenecks() -> BottlenecksResponse:
    return BottlenecksResponse(
        teamId=TEST_TEAM_ID,
        perStatus=[
            StatusStats(
                status=TaskStatus.IN_REVIEW,
                sampleSize=0,
                meanDays=None,
                p50Days=None,
                p75Days=None,
                p95Days=None,
                weeklyP75Trend=[None] * 12,
            )
        ],
        stuckTasks=[],
    )


def _fake_cfd() -> CfdResponse:
    return CfdResponse(
        teamId=TEST_TEAM_ID,
        points=[CfdPoint(date=date(2026, 1, 1), todo=0, inProgress=0, inReview=0, done=0)],
    )


def _fake_recommendations() -> RecommendationsResponse:
    return RecommendationsResponse(teamId=TEST_TEAM_ID, items=[])


# ---------- auth gating ----------

class TestAuthGating:
    def test_overview_without_token_is_401(self, unauth_client):
        r = unauth_client.get(f"{_PATH_PREFIX}/overview")
        assert r.status_code == 401

    def test_workload_without_token_is_401(self, unauth_client):
        r = unauth_client.get(f"{_PATH_PREFIX}/workload")
        assert r.status_code == 401

    def test_bottlenecks_cfd_without_token_is_401(self, unauth_client):
        r = unauth_client.get(f"{_PATH_PREFIX}/bottlenecks/cfd")
        assert r.status_code == 401


# ---------- successful admin requests ----------

class TestRouterShapes:
    def test_overview_returns_expected_keys(self, admin_client, monkeypatch):
        from app.queries.settings_queries import TeamThresholds

        thresholds = TeamThresholds(
            workload_max_median_warn=2.0,
            workload_max_median_crit=3.0,
            review_p75_days_warn=2.0,
            review_p75_days_crit=4.0,
            throughput_drop_pct_warn=20.0,
            throughput_drop_pct_crit=40.0,
            overdue_count_warn=3,
            overdue_count_crit=7,
        )
        monkeypatch.setattr(
            "app.routers.overview.get_workload", _async_returning(_fake_workload())
        )
        monkeypatch.setattr(
            "app.routers.overview.get_throughput", _async_returning(_fake_throughput())
        )
        monkeypatch.setattr(
            "app.routers.overview.get_bottlenecks", _async_returning(_fake_bottlenecks())
        )
        monkeypatch.setattr(
            "app.routers.overview.get_team_thresholds", _async_returning(thresholds)
        )
        monkeypatch.setattr(
            "app.routers.overview.get_completed_last_7d", _async_returning(4)
        )

        r = admin_client.get(f"{_PATH_PREFIX}/overview")

        assert r.status_code == 200
        body = r.json()
        for key in (
            "teamId",
            "openTasks",
            "completedLast7d",
            "overdueCount",
            "maxMedianRatio",
            "reviewBacklogP75Days",
            "activeRecommendations",
        ):
            assert key in body

    def test_workload_returns_expected_keys(self, admin_client, monkeypatch):
        monkeypatch.setattr(
            "app.routers.workload.get_workload", _async_returning(_fake_workload())
        )

        r = admin_client.get(f"{_PATH_PREFIX}/workload")

        assert r.status_code == 200
        body = r.json()
        assert "members" in body
        assert "maxMedianRatio" in body

    def test_throughput_returns_expected_keys(self, admin_client, monkeypatch):
        monkeypatch.setattr(
            "app.routers.throughput.get_throughput", _async_returning(_fake_throughput())
        )

        r = admin_client.get(f"{_PATH_PREFIX}/throughput")

        assert r.status_code == 200
        body = r.json()
        assert "weeks" in body
        assert "movingAverage4w" in body

    def test_bottlenecks_returns_expected_keys(self, admin_client, monkeypatch):
        monkeypatch.setattr(
            "app.routers.bottlenecks.get_bottlenecks", _async_returning(_fake_bottlenecks())
        )

        r = admin_client.get(f"{_PATH_PREFIX}/bottlenecks")

        assert r.status_code == 200
        body = r.json()
        assert "perStatus" in body
        assert "stuckTasks" in body

    def test_cfd_returns_expected_keys(self, admin_client, monkeypatch):
        monkeypatch.setattr(
            "app.routers.bottlenecks.get_cfd", _async_returning(_fake_cfd())
        )

        r = admin_client.get(f"{_PATH_PREFIX}/bottlenecks/cfd")

        assert r.status_code == 200
        body = r.json()
        assert "points" in body

    def test_recommendations_returns_expected_keys(self, admin_client, monkeypatch):
        monkeypatch.setattr(
            "app.routers.recommendations.generate_recommendations",
            _async_returning(_fake_recommendations()),
        )

        r = admin_client.get(f"{_PATH_PREFIX}/recommendations")

        assert r.status_code == 200
        body = r.json()
        assert "items" in body


