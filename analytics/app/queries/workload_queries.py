"""
Per-member open-task counts and workload distribution math.
"""
from __future__ import annotations

from uuid import UUID

from app.core.db import get_pool
from app.math.distribution import iqr_fence, max_median_ratio
from app.schemas.common import TaskStatus
from app.schemas.workload import MemberLoad, WorkloadResponse


_SELECT_PER_MEMBER_SQL = """
SELECT
  tm.user_id,
  u.first_name,
  u.last_name,
  COUNT(t.id) FILTER (WHERE t.status = 'TODO')         AS todo_count,
  COUNT(t.id) FILTER (WHERE t.status = 'IN_PROGRESS')  AS in_progress_count,
  COUNT(t.id) FILTER (WHERE t.status = 'IN_REVIEW')    AS in_review_count,
  COUNT(t.id) FILTER (WHERE t.status <> 'DONE')        AS open_count
FROM team_members tm
JOIN users u ON u.id = tm.user_id
LEFT JOIN tasks t
  ON t.team_id = tm.team_id
  AND t.assignee_user_id = tm.user_id
WHERE tm.team_id = $1
GROUP BY tm.user_id, u.first_name, u.last_name
ORDER BY open_count DESC
"""


async def get_workload(team_id: UUID) -> WorkloadResponse:
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(_SELECT_PER_MEMBER_SQL, team_id)

    open_counts = [int(r["open_count"]) for r in rows]
    ratio = max_median_ratio(open_counts) if open_counts else None
    fence = iqr_fence(open_counts)

    members: list[MemberLoad] = []
    for idx, row in enumerate(rows):
        members.append(
            MemberLoad(
                userId=row["user_id"],
                firstName=row["first_name"],
                lastName=row["last_name"],
                openCount=int(row["open_count"]),
                byStatus={
                    TaskStatus.TODO: int(row["todo_count"]),
                    TaskStatus.IN_PROGRESS: int(row["in_progress_count"]),
                    TaskStatus.IN_REVIEW: int(row["in_review_count"]),
                    TaskStatus.DONE: 0,  # DONE intentionally excluded from "open"
                },
                isOverloaded=idx in fence.overloaded_indices,
            )
        )

    return WorkloadResponse(
        teamId=team_id,
        members=members,
        maxMedianRatio=ratio,
        upperFence=fence.upper_fence,
    )
