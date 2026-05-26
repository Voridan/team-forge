"""
Weekly throughput buckets, backlog (overdue + due-soon), and derived trend
statistics (4-week moving average, period-over-period delta, regression slope,
z-score for the latest week).
"""
from __future__ import annotations

from typing import Final
from uuid import UUID

from app.core.db import get_pool
from app.math.trend import moving_average, pop_delta_pct, regression_slope, z_score
from app.schemas.common import TaskStatus
from app.schemas.throughput import DueSoonTask, ThroughputResponse, WeeklyBucket

WEEKS_WINDOW: Final = 12
MA_WINDOW: Final = 4
BASELINE_WINDOW: Final = 4
DUE_SOON_DAYS: Final = 7
DUE_SOON_LIMIT: Final = 20


_WEEKLY_SQL = f"""
WITH week_starts AS (
  SELECT generate_series(
    date_trunc('week', CURRENT_DATE - INTERVAL '{WEEKS_WINDOW - 1} weeks'),
    date_trunc('week', CURRENT_DATE),
    INTERVAL '1 week'
  )::date AS week_start
),
created_per_week AS (
  SELECT date_trunc('week', created_at)::date AS week_start, COUNT(*) AS n
  FROM tasks
  WHERE team_id = $1
    AND created_at >= date_trunc('week', CURRENT_DATE - INTERVAL '{WEEKS_WINDOW - 1} weeks')
  GROUP BY 1
),
completed_per_week AS (
  SELECT date_trunc('week', changed_at)::date AS week_start, COUNT(*) AS n
  FROM task_status_history
  WHERE team_id = $1
    AND to_status = 'DONE'
    AND changed_at >= date_trunc('week', CURRENT_DATE - INTERVAL '{WEEKS_WINDOW - 1} weeks')
  GROUP BY 1
)
SELECT
  ws.week_start,
  COALESCE(c.n, 0)::int AS created,
  COALESCE(d.n, 0)::int AS completed
FROM week_starts ws
LEFT JOIN created_per_week c USING (week_start)
LEFT JOIN completed_per_week d USING (week_start)
ORDER BY ws.week_start
"""

_OVERDUE_COUNT_SQL = """
SELECT COUNT(*)::int AS n
FROM tasks
WHERE team_id = $1
  AND due_date IS NOT NULL
  AND due_date < CURRENT_DATE
  AND status <> 'DONE'
"""

_DUE_SOON_SQL = f"""
SELECT id, title, due_date, status, assignee_user_id
FROM tasks
WHERE team_id = $1
  AND due_date IS NOT NULL
  AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '{DUE_SOON_DAYS} days'
  AND status <> 'DONE'
ORDER BY due_date ASC
LIMIT {DUE_SOON_LIMIT}
"""


async def get_throughput(team_id: UUID) -> ThroughputResponse:
    pool = get_pool()
    async with pool.acquire() as conn:
        weekly_rows = await conn.fetch(_WEEKLY_SQL, team_id)
        overdue_row = await conn.fetchrow(_OVERDUE_COUNT_SQL, team_id)
        due_soon_rows = await conn.fetch(_DUE_SOON_SQL, team_id)

    weeks = [
        WeeklyBucket(
            weekStart=row["week_start"],
            created=row["created"],
            completed=row["completed"],
        )
        for row in weekly_rows
    ]

    completed_series = [float(w.completed) for w in weeks]
    ma_series = moving_average(completed_series, MA_WINDOW)

    latest = int(completed_series[-1]) if completed_series else 0
    baseline = completed_series[-(BASELINE_WINDOW + 1) : -1] if len(completed_series) > BASELINE_WINDOW else []
    delta = pop_delta_pct(latest, baseline)
    slope = regression_slope(completed_series)
    z = z_score(latest, baseline)

    due_soon = [
        DueSoonTask(
            id=row["id"],
            title=row["title"],
            dueDate=row["due_date"],
            status=TaskStatus(row["status"]),
            assigneeUserId=row["assignee_user_id"],
        )
        for row in due_soon_rows
    ]

    return ThroughputResponse(
        teamId=team_id,
        weeks=weeks,
        movingAverage4w=ma_series,
        latestWeekCompleted=latest,
        popDeltaPct=delta,
        regressionSlope=slope,
        zScore=z,
        overdueCount=int(overdue_row["n"]) if overdue_row else 0,
        dueSoon=due_soon,
    )
