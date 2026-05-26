"""
Shared fixtures for integration tests. Spins up a single Postgres container
per session (testcontainers), applies the Prisma migrations, and exposes a
clean asyncpg pool to each test.

These tests are marked `@pytest.mark.integration` — they require Docker.
Run only the unit tests with `pytest -m "not integration"`.
"""
from __future__ import annotations

import glob
import os
from pathlib import Path
from typing import AsyncIterator, Iterator

import asyncpg
import pytest
import pytest_asyncio
from testcontainers.postgres import PostgresContainer

from app.core.db import db_state

_MIGRATIONS_DIR = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "api"
    / "prisma"
    / "migrations"
)


def _migration_files() -> list[Path]:
    paths = sorted(glob.glob(str(_MIGRATIONS_DIR / "*/migration.sql")))
    if not paths:
        raise RuntimeError(f"No migrations found at {_MIGRATIONS_DIR}")
    return [Path(p) for p in paths]


@pytest.fixture(scope="session")
def postgres_container() -> Iterator[PostgresContainer]:
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def db_pool(postgres_container: PostgresContainer) -> AsyncIterator[asyncpg.Pool]:
    host = postgres_container.get_container_host_ip()
    port = postgres_container.get_exposed_port(5432)
    dsn = (
        f"postgresql://{postgres_container.username}:"
        f"{postgres_container.password}@{host}:{port}/{postgres_container.dbname}"
    )

    pool = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=5)

    # Apply all Prisma migrations in directory (timestamp) order so the test DB
    # has exactly the production schema.
    async with pool.acquire() as conn:
        for path in _migration_files():
            sql = path.read_text()
            await conn.execute(sql)

    # Wire into the app's pool slot so query functions can call `get_pool()`.
    db_state.pool = pool
    try:
        yield pool
    finally:
        db_state.pool = None
        await pool.close()


_TRUNCATE_SQL = """
TRUNCATE TABLE
  task_status_history,
  task_comments,
  tasks,
  messages,
  attachments,
  channels,
  call_participants,
  calls,
  team_invitations,
  team_analytics_settings,
  team_members,
  refresh_tokens,
  teams,
  users
RESTART IDENTITY CASCADE
"""


@pytest_asyncio.fixture
async def clean_db(db_pool: asyncpg.Pool) -> AsyncIterator[asyncpg.Pool]:
    """Wipe all data tables before each test so cases don't bleed into each other."""
    async with db_pool.acquire() as conn:
        await conn.execute(_TRUNCATE_SQL)
    yield db_pool


def pytest_collection_modifyitems(config, items):
    """Auto-mark every test in this folder as `integration`."""
    for item in items:
        if "tests/integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
