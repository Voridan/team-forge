"""
Composite headline endpoint. Runs the four detail queries + thresholds in
parallel, then computes recommendation count locally so we don't re-issue the
queries via the engine.
"""
from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.core.security import AuthenticatedUser
from app.deps.authz import require_team_admin
from app.middleware.rate_limit import limiter
from app.queries.bottleneck_queries import get_bottlenecks
from app.queries.overview_queries import get_completed_last_7d
from app.queries.settings_queries import get_team_thresholds
from app.queries.throughput_queries import get_throughput
from app.queries.workload_queries import get_workload
from app.recommendations.rules import (
    overdue_accumulation_rule,
    review_backlog_rule,
    throughput_drop_rule,
    workload_imbalance_rule,
)
from app.schemas.common import TaskStatus
from app.schemas.overview import OverviewResponse

router = APIRouter(prefix="/analytics/v1/teams/{teamId}", tags=["overview"])


@router.get("/overview", response_model=OverviewResponse)
@limiter.limit("30/minute")
async def get_team_overview(
    request: Request,
    teamId: UUID,
    user: AuthenticatedUser = Depends(require_team_admin),
) -> OverviewResponse:
    _ = user

    workload, throughput, bottlenecks, thresholds, completed_7d = await asyncio.gather(
        get_workload(teamId),
        get_throughput(teamId),
        get_bottlenecks(teamId),
        get_team_thresholds(teamId),
        get_completed_last_7d(teamId),
    )

    # Run rules in-process to avoid re-querying.
    active_recs = sum(
        1
        for r in (
            workload_imbalance_rule(workload, thresholds),
            review_backlog_rule(bottlenecks, thresholds),
            throughput_drop_rule(throughput, thresholds),
            overdue_accumulation_rule(throughput, thresholds),
        )
        if r is not None
    )

    open_tasks = sum(m.openCount for m in workload.members)
    review = next((s for s in bottlenecks.perStatus if s.status == TaskStatus.IN_REVIEW), None)

    return OverviewResponse(
        teamId=teamId,
        openTasks=open_tasks,
        completedLast7d=completed_7d,
        overdueCount=throughput.overdueCount,
        maxMedianRatio=workload.maxMedianRatio,
        reviewBacklogP75Days=review.p75Days if review else None,
        activeRecommendations=active_recs,
    )
