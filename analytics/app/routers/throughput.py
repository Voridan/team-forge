from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.core.security import AuthenticatedUser
from app.deps.authz import require_team_admin
from app.middleware.rate_limit import limiter
from app.queries.throughput_queries import get_throughput
from app.schemas.throughput import ThroughputResponse

router = APIRouter(prefix="/analytics/v1/teams/{teamId}", tags=["throughput"])


@router.get("/throughput", response_model=ThroughputResponse)
@limiter.limit("30/minute")
async def get_team_throughput(
    request: Request,
    teamId: UUID,
    user: AuthenticatedUser = Depends(require_team_admin),
) -> ThroughputResponse:
    _ = user
    return await get_throughput(teamId)
