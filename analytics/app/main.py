from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.db import db_lifespan
from app.core.logging import configure_logging
from app.middleware.audit import AuditMiddleware
from app.middleware.rate_limit import limiter
from app.routers import overview

configure_logging()

app = FastAPI(
    title="Analytics Service",
    description="Analytics service for team collaboration platform",
    version="0.1.0",
    docs_url="/analytics/docs",
    openapi_url="/analytics/openapi.json",
    lifespan=db_lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(AuditMiddleware)

app.include_router(overview.router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "analytics"}
