from dataclasses import dataclass

import jwt

from app.core.config import settings


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    id: str
    email: str


class InvalidTokenError(Exception):
    """Raised when a JWT is missing, malformed, expired, or signed with the wrong key."""


def decode_access_token(token: str) -> AuthenticatedUser:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as err:
        raise InvalidTokenError(str(err)) from err

    sub = payload.get("sub")
    email = payload.get("email")
    if not isinstance(sub, str) or not isinstance(email, str):
        raise InvalidTokenError("Token payload missing required claims (sub, email).")

    return AuthenticatedUser(id=sub, email=email)
