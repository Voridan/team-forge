from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI

from app.core.config import settings

_POOL_MIN_SIZE = 1
_POOL_MAX_SIZE = 10


class _DbState:
    pool: asyncpg.Pool | None = None


db_state = _DbState()


@asynccontextmanager
async def db_lifespan(_app: FastAPI) -> AsyncIterator[None]:
    db_state.pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=_POOL_MIN_SIZE,
        max_size=_POOL_MAX_SIZE,
    )
    try:
        yield
    finally:
        if db_state.pool is not None:
            await db_state.pool.close()
            db_state.pool = None


def get_pool() -> asyncpg.Pool:
    if db_state.pool is None:
        raise RuntimeError("Database pool is not initialized. Did the lifespan run?")
    return db_state.pool
