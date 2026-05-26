from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.core.security import AuthenticatedUser
from app.deps.authz import require_team_admin
from app.middleware.rate_limit import limiter
from app.recommendations.engine import generate_recommendations
from app.schemas.recommendations import RecommendationsResponse

router = APIRouter(prefix="/analytics/v1/teams/{teamId}", tags=["recommendations"])


@router.get("/recommendations", response_model=RecommendationsResponse)
@limiter.limit("30/minute")
async def get_team_recommendations(
    request: Request,
    teamId: UUID,
    user: AuthenticatedUser = Depends(require_team_admin),
) -> RecommendationsResponse:
    _ = user
    return await generate_recommendations(teamId)
