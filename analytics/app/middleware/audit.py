import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import get_logger, request_id_var

_logger = get_logger("audit")
_AUDITED_STATUSES = {401, 403, 404, 429}
_REQUEST_ID_HEADER = "x-request-id"


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get(_REQUEST_ID_HEADER) or uuid.uuid4().hex
        token = request_id_var.set(request_id)
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)

        response.headers[_REQUEST_ID_HEADER] = request_id

        if response.status_code in _AUDITED_STATUSES:
            _logger.info(
                "auth_event",
                extra={
                    "ctx_status": response.status_code,
                    "ctx_method": request.method,
                    "ctx_path": request.url.path,
                    "ctx_request_id": request_id,
                },
            )

        return response
