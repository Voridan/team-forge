from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.core.config import settings
from app.core.security import AuthenticatedUser
from app.deps.authz import require_team_admin
from app.middleware.rate_limit import limiter
from app.queries.bottleneck_queries import get_bottlenecks, get_cfd
from app.schemas.bottlenecks import BottlenecksResponse, CfdResponse

router = APIRouter(prefix="/analytics/v1/teams/{teamId}", tags=["bottlenecks"])


@router.get("/bottlenecks", response_model=BottlenecksResponse)
@limiter.limit("30/minute")
async def get_team_bottlenecks(
    request: Request,
    teamId: UUID,
    user: AuthenticatedUser = Depends(require_team_admin),
) -> BottlenecksResponse:
    _ = user
    return await get_bottlenecks(teamId)


@router.get("/bottlenecks/cfd", response_model=CfdResponse)
@limiter.limit(settings.rate_limit_cfd)
async def get_team_cfd(
    request: Request,
    teamId: UUID,
    user: AuthenticatedUser = Depends(require_team_admin),
) -> CfdResponse:
    _ = user
    return await get_cfd(teamId)
