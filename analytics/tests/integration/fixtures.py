"""
Small helpers to seed deterministic data inside integration tests.

Kept inline (rather than a fancy ORM) so each test reads as plain SQL — the
goal is to exercise the same Postgres queries the production code runs against.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Iterable
from uuid import UUID, uuid4

import asyncpg


async def insert_user(pool: asyncpg.Pool, email: str = "test@local") -> UUID:
    user_id = uuid4()
    await pool.execute(
        """
        INSERT INTO users (id, email, first_name, last_name, auth_provider, password_hash)
        VALUES ($1, $2, $3, $4, 'LOCAL', 'dummy')
        """,
        user_id, email, email.split("@")[0], "Test",
    )
    return user_id


async def insert_team(pool: asyncpg.Pool, name: str = "Test Team") -> UUID:
    team_id = uuid4()
    await pool.execute(
        "INSERT INTO teams (id, name) VALUES ($1, $2)",
        team_id, name,
    )
    return team_id


async def insert_member(
    pool: asyncpg.Pool, team_id: UUID, user_id: UUID, role: str = "MEMBER"
) -> None:
    await pool.execute(
        "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3::\"TeamRole\")",
        team_id, user_id, role,
    )


async def insert_task(
    pool: asyncpg.Pool,
    *,
    team_id: UUID,
    assignee_user_id: UUID | None = None,
    status: str = "TODO",
    priority: str = "MEDIUM",
    title: str = "task",
    due_date: date | None = None,
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
) -> UUID:
    task_id = uuid4()
    await pool.execute(
        """
        INSERT INTO tasks (id, team_id, title, status, priority,
                           assignee_user_id, due_date, created_at, updated_at,
                           position, labels)
        VALUES ($1, $2, $3, $4::"TaskStatus", $5::"TaskPriority",
                $6, $7, COALESCE($8, NOW()), COALESCE($9, NOW()), 0, ARRAY[]::text[])
        """,
        task_id, team_id, title, status, priority,
        assignee_user_id, due_date, created_at, updated_at,
    )
    return task_id


async def insert_status_history(
    pool: asyncpg.Pool,
    *,
    task_id: UUID,
    team_id: UUID,
    from_status: str | None,
    to_status: str,
    changed_at: datetime,
    changed_by_user_id: UUID | None = None,
) -> None:
    await pool.execute(
        """
        INSERT INTO task_status_history
            (id, task_id, team_id, from_status, to_status, changed_at, changed_by_user_id)
        VALUES ($1, $2, $3, $4::"TaskStatus", $5::"TaskStatus", $6, $7)
        """,
        uuid4(), task_id, team_id,
        from_status, to_status, changed_at, changed_by_user_id,
    )


async def insert_team_with_members(
    pool: asyncpg.Pool, member_count: int = 3
) -> tuple[UUID, list[UUID]]:
    """Convenience: create a team with N members. Returns (teamId, userIds)."""
    team_id = await insert_team(pool)
    user_ids: list[UUID] = []
    for i in range(member_count):
        u = await insert_user(pool, email=f"u{i}.{team_id}@local")
        await insert_member(pool, team_id, u, "OWNER" if i == 0 else "MEMBER")
        user_ids.append(u)
    return team_id, user_ids


async def lifecycle(
    pool: asyncpg.Pool,
    *,
    team_id: UUID,
    assignee_user_id: UUID,
    status_at_end: str,
    created_at: datetime,
    transitions: Iterable[tuple[str | None, str, datetime]],
    due_date: date | None = None,
) -> UUID:
    """
    Create a task and seed its full status-history walk. `transitions` is an
    iterable of (from_status, to_status, changed_at) tuples — the first should
    be (None, 'TODO', created_at) to mirror what TasksService.create writes.
    """
    task = await insert_task(
        pool,
        team_id=team_id,
        assignee_user_id=assignee_user_id,
        status=status_at_end,
        created_at=created_at,
        updated_at=created_at,
        due_date=due_date,
    )
    for from_s, to_s, when in transitions:
        await insert_status_history(
            pool,
            task_id=task,
            team_id=team_id,
            from_status=from_s,
            to_status=to_s,
            changed_at=when,
            changed_by_user_id=assignee_user_id,
        )
    return task


def days_ago(n: float) -> datetime:
    return datetime.utcnow() - timedelta(days=n)
