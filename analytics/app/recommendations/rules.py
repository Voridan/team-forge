"""
One pure function per recommendation rule.

Each rule takes a metric value plus the team's thresholds and returns a
`Recommendation` (or None if below the warn threshold). Thresholds come from
`TeamThresholds` so admins can tune them per team.
"""
from __future__ import annotations

from app.queries.settings_queries import TeamThresholds
from app.schemas.bottlenecks import BottlenecksResponse
from app.schemas.common import Severity, TaskStatus
from app.schemas.recommendations import Recommendation
from app.schemas.throughput import ThroughputResponse
from app.schemas.workload import WorkloadResponse


def workload_imbalance_rule(
    workload: WorkloadResponse, thresholds: TeamThresholds
) -> Recommendation | None:
    ratio = workload.maxMedianRatio
    if ratio is None:
        return None
    if ratio >= thresholds.workload_max_median_crit:
        severity = Severity.CRITICAL
    elif ratio >= thresholds.workload_max_median_warn:
        severity = Severity.WARNING
    else:
        return None

    overloaded = [m for m in workload.members if m.isOverloaded]
    names = ", ".join(f"{m.firstName} {m.lastName}" for m in overloaded[:3])
    body = (
        f"The most-loaded member holds {ratio:.1f}× the team median open-task count. "
    )
    if overloaded:
        body += f"Currently flagged: {names}."
    else:
        body += "Consider reassigning a few tasks to even the load."

    return Recommendation(
        id="workload-imbalance",
        severity=severity,
        category="workload",
        headline=f"Workload imbalance ({ratio:.1f}× median)",
        body=body,
        metricLink="workload",
    )


def review_backlog_rule(
    bottlenecks: BottlenecksResponse, thresholds: TeamThresholds
) -> Recommendation | None:
    in_review = next(
        (s for s in bottlenecks.perStatus if s.status == TaskStatus.IN_REVIEW), None
    )
    if in_review is None or in_review.p75Days is None:
        return None
    p75 = in_review.p75Days
    if p75 >= thresholds.review_p75_days_crit:
        severity = Severity.CRITICAL
    elif p75 >= thresholds.review_p75_days_warn:
        severity = Severity.WARNING
    else:
        return None

    stuck_in_review = [t for t in bottlenecks.stuckTasks if t.status == TaskStatus.IN_REVIEW]
    body = (
        f"75% of recent IN_REVIEW transitions took longer than {p75:.1f} days. "
        f"{len(stuck_in_review)} task(s) currently stuck in review. "
        "Consider adding reviewers or unblocking the queue."
    )
    return Recommendation(
        id="review-backlog",
        severity=severity,
        category="bottleneck",
        headline=f"Review backlog forming (p75 = {p75:.1f}d)",
        body=body,
        metricLink="bottlenecks",
    )


def throughput_drop_rule(
    throughput: ThroughputResponse, thresholds: TeamThresholds
) -> Recommendation | None:
    delta = throughput.popDeltaPct
    if delta is None or delta >= 0:
        return None
    drop = -delta  # positive percentage drop
    if drop >= thresholds.throughput_drop_pct_crit:
        severity = Severity.CRITICAL
    elif drop >= thresholds.throughput_drop_pct_warn:
        severity = Severity.WARNING
    else:
        return None

    slope_str = ""
    if throughput.regressionSlope is not None and throughput.regressionSlope < 0:
        slope_str = f" Trend slope: {throughput.regressionSlope:.1f} tasks/week."
    return Recommendation(
        id="throughput-drop",
        severity=severity,
        category="throughput",
        headline=f"Throughput dropping ({drop:.0f}% below recent average)",
        body=(
            f"Last week completed {throughput.latestWeekCompleted} task(s), "
            f"{drop:.0f}% below the prior 4-week average.{slope_str} "
            "Check for blockers or capacity changes."
        ),
        metricLink="throughput",
    )


def overdue_accumulation_rule(
    throughput: ThroughputResponse, thresholds: TeamThresholds
) -> Recommendation | None:
    n = throughput.overdueCount
    if n >= thresholds.overdue_count_crit:
        severity = Severity.CRITICAL
    elif n >= thresholds.overdue_count_warn:
        severity = Severity.WARNING
    else:
        return None

    return Recommendation(
        id="overdue-accumulation",
        severity=severity,
        category="overdue",
        headline=f"{n} overdue task{'s' if n != 1 else ''}",
        body=(
            f"{n} task(s) are past their due date and not yet DONE. "
            "Review the throughput tab for the full list."
        ),
        metricLink="throughput",
    )
