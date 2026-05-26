"""
Targeted query for the small headline numbers that don't naturally fall out of
the detail-endpoint functions (e.g. "completed in the last 7 days" is a rolling
window, not aligned to the weekly buckets returned by throughput_queries).
"""
from __future__ import annotations

from uuid import UUID

from app.core.db import get_pool

_COMPLETED_LAST_7D_SQL = """
SELECT COUNT(*)::int AS n
FROM task_status_history
WHERE team_id = $1
  AND to_status = 'DONE'
  AND changed_at >= NOW() - INTERVAL '7 days'
"""


async def get_completed_last_7d(team_id: UUID) -> int:
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(_COMPLETED_LAST_7D_SQL, team_id)
    return int(row["n"]) if row else 0
