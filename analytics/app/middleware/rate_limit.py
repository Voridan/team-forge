from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.security import decode_access_token, InvalidTokenError

_BEARER_PREFIX = "Bearer "


def _user_key(request) -> str:
    """
    Rate-limit per authenticated user when possible; fall back to remote address.

    Decoding here is best-effort — if the token is invalid we hand back the IP and let the
    auth dependency reject the request with 401.
    """
    header = request.headers.get("authorization")
    if header and header.startswith(_BEARER_PREFIX):
        try:
            return decode_access_token(header[len(_BEARER_PREFIX):]).id
        except InvalidTokenError:
            pass
    return get_remote_address(request)


limiter = Limiter(
    key_func=_user_key,
    storage_uri=settings.redis_url,
    default_limits=[settings.rate_limit_default],
)
