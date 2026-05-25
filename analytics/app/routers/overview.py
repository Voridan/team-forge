from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.core.security import AuthenticatedUser
from app.deps.authz import require_team_admin
from app.middleware.rate_limit import limiter

router = APIRouter(prefix="/analytics/v1/teams/{teamId}", tags=["overview"])


class OverviewResponse(BaseModel):
    teamId: UUID
    openTasks: int
    completedLast7d: int
    overdueCount: int
    maxMedianRatio: float
    activeRecommendations: int


@router.get("/overview", response_model=OverviewResponse)
@limiter.limit("30/minute")
async def get_team_overview(
    request: Request,
    teamId: UUID,
    user: AuthenticatedUser = Depends(require_team_admin),
) -> OverviewResponse:
    # Stub data until query layer is implemented.
    # TODO: replace with real aggregations once queries/ modules land.
    _ = user  # authz proved the requester is an admin of teamId
    return OverviewResponse(
        teamId=teamId,
        openTasks=0,
        completedLast7d=0,
        overdueCount=0,
        maxMedianRatio=1.0,
        activeRecommendations=0,
    )
