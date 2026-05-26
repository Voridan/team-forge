"""
Orchestrates the rule pipeline: load metrics + thresholds → run each rule →
return a severity-ordered list.
"""
from __future__ import annotations

from uuid import UUID

from app.queries.bottleneck_queries import get_bottlenecks
from app.queries.settings_queries import get_team_thresholds
from app.queries.throughput_queries import get_throughput
from app.queries.workload_queries import get_workload
from app.recommendations.rules import (
    overdue_accumulation_rule,
    review_backlog_rule,
    throughput_drop_rule,
    workload_imbalance_rule,
)
from app.schemas.common import Severity
from app.schemas.recommendations import Recommendation, RecommendationsResponse

_SEVERITY_RANK = {
    Severity.CRITICAL: 0,
    Severity.WARNING: 1,
    Severity.INFO: 2,
}


async def generate_recommendations(team_id: UUID) -> RecommendationsResponse:
    workload = await get_workload(team_id)
    throughput = await get_throughput(team_id)
    bottlenecks = await get_bottlenecks(team_id)
    thresholds = await get_team_thresholds(team_id)

    items: list[Recommendation] = []
    for maybe in (
        workload_imbalance_rule(workload, thresholds),
        review_backlog_rule(bottlenecks, thresholds),
        throughput_drop_rule(throughput, thresholds),
        overdue_accumulation_rule(throughput, thresholds),
    ):
        if maybe is not None:
            items.append(maybe)

    items.sort(key=lambda r: (_SEVERITY_RANK[r.severity], r.category))
    return RecommendationsResponse(teamId=team_id, items=items)
