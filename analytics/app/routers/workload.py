from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.core.security import AuthenticatedUser
from app.deps.authz import require_team_admin
from app.middleware.rate_limit import limiter
from app.queries.workload_queries import get_workload
from app.schemas.workload import WorkloadResponse

router = APIRouter(prefix="/analytics/v1/teams/{teamId}", tags=["workload"])


@router.get("/workload", response_model=WorkloadResponse)
@limiter.limit("30/minute")
async def get_team_workload(
    request: Request,
    teamId: UUID,
    user: AuthenticatedUser = Depends(require_team_admin),
) -> WorkloadResponse:
    _ = user
    return await get_workload(teamId)
