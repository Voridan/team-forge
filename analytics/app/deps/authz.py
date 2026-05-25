from uuid import UUID

from fastapi import Depends, HTTPException, status

from app.core.db import get_pool
from app.core.logging import get_logger
from app.core.security import AuthenticatedUser
from app.deps.auth import get_current_user

_ADMIN_ROLES = ("OWNER", "ADMIN")
_logger = get_logger(__name__)


async def require_team_admin(
    teamId: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """
    Authorize the requesting user as OWNER or ADMIN of the given team.

    Returns 404 (not 403) for non-admins so attackers can't enumerate teams.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2",
            teamId,
            UUID(user.id),
        )

    if row is None or row["role"] not in _ADMIN_ROLES:
        _logger.info(
            "authz_denied",
            extra={
                "ctx_user_id": user.id,
                "ctx_team_id": str(teamId),
                "ctx_reason": "not_member" if row is None else "insufficient_role",
            },
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    return user
