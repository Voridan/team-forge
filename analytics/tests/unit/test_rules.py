"""
Unit tests for the four recommendation rules. Each rule is exercised at the
three meaningful boundaries: below warn (None), warn threshold, critical threshold.
"""
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID, uuid4

from app.queries.settings_queries import TeamThresholds
from app.recommendations.rules import (
    overdue_accumulation_rule,
    review_backlog_rule,
    throughput_drop_rule,
    workload_imbalance_rule,
)
from app.schemas.bottlenecks import BottlenecksResponse, StatusStats
from app.schemas.common import Severity, TaskStatus
from app.schemas.throughput import ThroughputResponse
from app.schemas.workload import MemberLoad, WorkloadResponse


def _thresholds() -> TeamThresholds:
    return TeamThresholds(
        workload_max_median_warn=2.0,
        workload_max_median_crit=3.0,
        review_p75_days_warn=2.0,
        review_p75_days_crit=4.0,
        throughput_drop_pct_warn=20.0,
        throughput_drop_pct_crit=40.0,
        overdue_count_warn=3,
        overdue_count_crit=7,
    )


def _team_id() -> UUID:
    return uuid4()


def _workload(ratio: float | None, overloaded_count: int = 0) -> WorkloadResponse:
    return WorkloadResponse(
        teamId=_team_id(),
        members=[
            MemberLoad(
                userId=uuid4(),
                firstName=f"User{i}",
                lastName="Test",
                openCount=10,
                byStatus={
                    TaskStatus.TODO: 5,
                    TaskStatus.IN_PROGRESS: 3,
                    TaskStatus.IN_REVIEW: 2,
                    TaskStatus.DONE: 0,
                },
                isOverloaded=i < overloaded_count,
            )
            for i in range(4)
        ],
        maxMedianRatio=ratio,
        upperFence=None,
    )


def _bottlenecks(review_p75: float | None) -> BottlenecksResponse:
    return BottlenecksResponse(
        teamId=_team_id(),
        perStatus=[
            StatusStats(
                status=TaskStatus.IN_REVIEW,
                sampleSize=10,
                meanDays=2.0,
                p50Days=1.5,
                p75Days=review_p75,
                p95Days=5.0,
                weeklyP75Trend=[None] * 12,
            ),
        ],
        stuckTasks=[],
    )


def _throughput(
    pop_delta: float | None = None,
    overdue: int = 0,
    slope: float | None = None,
) -> ThroughputResponse:
    return ThroughputResponse(
        teamId=_team_id(),
        weeks=[],
        movingAverage4w=[],
        latestWeekCompleted=5,
        popDeltaPct=pop_delta,
        regressionSlope=slope,
        zScore=None,
        overdueCount=overdue,
        dueSoon=[],
    )


class TestWorkloadImbalanceRule:
    def test_no_ratio_returns_none(self):
        assert workload_imbalance_rule(_workload(ratio=None), _thresholds()) is None

    def test_below_warn_returns_none(self):
        # ratio 1.5 < warn 2.0
        assert workload_imbalance_rule(_workload(ratio=1.5), _thresholds()) is None

    def test_at_warn_emits_warning(self):
        rec = workload_imbalance_rule(_workload(ratio=2.0, overloaded_count=1), _thresholds())
        assert rec is not None
        assert rec.severity == Severity.WARNING
        assert rec.category == "workload"

    def test_at_critical_emits_critical(self):
        rec = workload_imbalance_rule(_workload(ratio=3.0, overloaded_count=2), _thresholds())
        assert rec is not None
        assert rec.severity == Severity.CRITICAL

    def test_body_mentions_overloaded_names(self):
        rec = workload_imbalance_rule(_workload(ratio=3.5, overloaded_count=1), _thresholds())
        assert rec is not None
        assert "User0" in rec.body


class TestReviewBacklogRule:
    def test_no_in_review_status_returns_none(self):
        bottlenecks = BottlenecksResponse(teamId=_team_id(), perStatus=[], stuckTasks=[])
        assert review_backlog_rule(bottlenecks, _thresholds()) is None

    def test_no_p75_returns_none(self):
        assert review_backlog_rule(_bottlenecks(review_p75=None), _thresholds()) is None

    def test_below_warn_returns_none(self):
        assert review_backlog_rule(_bottlenecks(review_p75=1.5), _thresholds()) is None

    def test_at_warn_emits_warning(self):
        rec = review_backlog_rule(_bottlenecks(review_p75=2.0), _thresholds())
        assert rec is not None
        assert rec.severity == Severity.WARNING

    def test_at_critical_emits_critical(self):
        rec = review_backlog_rule(_bottlenecks(review_p75=4.5), _thresholds())
        assert rec is not None
        assert rec.severity == Severity.CRITICAL


class TestThroughputDropRule:
    def test_none_delta_returns_none(self):
        assert throughput_drop_rule(_throughput(pop_delta=None), _thresholds()) is None

    def test_positive_delta_returns_none(self):
        # Improvement, not a drop
        assert throughput_drop_rule(_throughput(pop_delta=10.0), _thresholds()) is None

    def test_small_drop_below_warn_returns_none(self):
        # -10% < -20% warn
        assert throughput_drop_rule(_throughput(pop_delta=-10.0), _thresholds()) is None

    def test_at_warn_emits_warning(self):
        rec = throughput_drop_rule(_throughput(pop_delta=-25.0), _thresholds())
        assert rec is not None
        assert rec.severity == Severity.WARNING

    def test_at_critical_emits_critical(self):
        rec = throughput_drop_rule(_throughput(pop_delta=-50.0), _thresholds())
        assert rec is not None
        assert rec.severity == Severity.CRITICAL

    def test_includes_slope_in_body_when_negative(self):
        rec = throughput_drop_rule(
            _throughput(pop_delta=-30.0, slope=-1.5),
            _thresholds(),
        )
        assert rec is not None
        assert "-1.5" in rec.body


class TestOverdueAccumulationRule:
    def test_zero_returns_none(self):
        assert overdue_accumulation_rule(_throughput(overdue=0), _thresholds()) is None

    def test_below_warn_returns_none(self):
        assert overdue_accumulation_rule(_throughput(overdue=2), _thresholds()) is None

    def test_at_warn_emits_warning(self):
        rec = overdue_accumulation_rule(_throughput(overdue=3), _thresholds())
        assert rec is not None
        assert rec.severity == Severity.WARNING

    def test_at_critical_emits_critical(self):
        rec = overdue_accumulation_rule(_throughput(overdue=10), _thresholds())
        assert rec is not None
        assert rec.severity == Severity.CRITICAL

    def test_headline_pluralizes_correctly(self):
        rec_plural = overdue_accumulation_rule(_throughput(overdue=5), _thresholds())
        rec_singular_at_threshold = overdue_accumulation_rule(
            _throughput(overdue=3), _thresholds()
        )
        assert rec_plural is not None and "tasks" in rec_plural.headline
        assert rec_singular_at_threshold is not None
