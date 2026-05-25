from fastapi import Header, HTTPException, status

from app.core.security import AuthenticatedUser, InvalidTokenError, decode_access_token

_BEARER_PREFIX = "Bearer "


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith(_BEARER_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    return authorization[len(_BEARER_PREFIX):]


def get_current_user(authorization: str | None = Header(default=None)) -> AuthenticatedUser:
    token = _extract_bearer(authorization)
    try:
        return decode_access_token(token)
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None
