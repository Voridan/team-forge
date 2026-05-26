"""
Bottleneck metrics: per-status dwell-time percentiles, weekly p75 sparkline,
currently-stuck tasks, and Cumulative Flow Diagram reconstruction.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Final
from uuid import UUID

from app.core.db import get_pool
from app.math.percentile import safe_percentile
from app.schemas.bottlenecks import (
    BottlenecksResponse,
    CfdPoint,
    CfdResponse,
    StatusStats,
    StuckTask,
)
from app.schemas.common import TaskStatus

DWELL_WINDOW_DAYS: Final = 30
SPARKLINE_WEEKS: Final = 12
CFD_DAYS: Final = 90
STUCK_TASK_LIMIT: Final = 25

# We exclude DONE from the per-status tracking; nothing "leaves" DONE in this
# domain so dwell-in-DONE is uninteresting (and would be effectively infinite).
_TRACKED_STATUSES: tuple[TaskStatus, ...] = (
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.IN_REVIEW,
)


_DWELL_LAST_30D_SQL = """
WITH transitions AS (
  SELECT
    task_id,
    from_status,
    changed_at,
    LAG(changed_at) OVER (PARTITION BY task_id ORDER BY changed_at) AS prev_changed_at
  FROM task_status_history
  WHERE team_id = $1
)
SELECT
  from_status::text AS status,
  EXTRACT(EPOCH FROM (changed_at - prev_changed_at)) / 86400.0 AS days
FROM transitions
WHERE prev_changed_at IS NOT NULL
  AND from_status IS NOT NULL
  AND changed_at >= NOW() - INTERVAL '%s days'
""" % DWELL_WINDOW_DAYS


_DWELL_WEEKLY_SQL = """
WITH transitions AS (
  SELECT
    task_id,
    from_status,
    changed_at,
    LAG(changed_at) OVER (PARTITION BY task_id ORDER BY changed_at) AS prev_changed_at
  FROM task_status_history
  WHERE team_id = $1
)
SELECT
  from_status::text AS status,
  date_trunc('week', changed_at)::date AS week_start,
  EXTRACT(EPOCH FROM (changed_at - prev_changed_at)) / 86400.0 AS days
FROM transitions
WHERE prev_changed_at IS NOT NULL
  AND from_status IS NOT NULL
  AND changed_at >= date_trunc('week', CURRENT_DATE - INTERVAL '%s weeks')
""" % (SPARKLINE_WEEKS - 1)


_STUCK_CANDIDATES_SQL = """
SELECT
  t.id, t.title, t.status::text AS status, t.assignee_user_id,
  latest.changed_at AS entered_status_at
FROM tasks t
JOIN LATERAL (
  SELECT changed_at
  FROM task_status_history
  WHERE task_id = t.id AND to_status = t.status
  ORDER BY changed_at DESC
  LIMIT 1
) latest ON true
WHERE t.team_id = $1
  AND t.status <> 'DONE'
ORDER BY latest.changed_at ASC
"""


_CFD_SQL = """
WITH days AS (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '%s days')::date,
    CURRENT_DATE,
    INTERVAL '1 day'
  )::date AS day
),
state_at_day AS (
  SELECT
    d.day,
    h.task_id,
    h.to_status::text AS status,
    ROW_NUMBER() OVER (PARTITION BY d.day, h.task_id ORDER BY h.changed_at DESC) AS rn
  FROM days d
  JOIN task_status_history h
    ON h.team_id = $1
    AND h.changed_at < d.day + INTERVAL '1 day'
)
SELECT
  day,
  COUNT(*) FILTER (WHERE status = 'TODO')::int        AS todo,
  COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress,
  COUNT(*) FILTER (WHERE status = 'IN_REVIEW')::int   AS in_review,
  COUNT(*) FILTER (WHERE status = 'DONE')::int        AS done
FROM state_at_day
WHERE rn = 1
GROUP BY day
ORDER BY day
""" % (CFD_DAYS - 1)


def _week_starts_window(weeks: int) -> list:
    """Generate the ordered list of Monday-aligned week start dates client-side."""
    # Postgres date_trunc('week', X) is Monday-aligned. We replicate here to
    # know which weeks the sparkline should cover (so we can None-fill misses).
    from datetime import date, timedelta

    today = date.today()
    days_since_monday = today.weekday()
    current_week_start = today - timedelta(days=days_since_monday)
    return [current_week_start - timedelta(weeks=weeks - 1 - i) for i in range(weeks)]


async def _per_status_stats(team_id: UUID) -> list[StatusStats]:
    pool = get_pool()
    async with pool.acquire() as conn:
        dwell_rows = await conn.fetch(_DWELL_LAST_30D_SQL, team_id)
        weekly_rows = await conn.fetch(_DWELL_WEEKLY_SQL, team_id)

    # Group last-30d dwell by status
    by_status: dict[str, list[float]] = defaultdict(list)
    for r in dwell_rows:
        by_status[r["status"]].append(float(r["days"]))

    # Group weekly dwell by (status, week_start)
    weekly_by_status_week: dict[tuple[str, object], list[float]] = defaultdict(list)
    for r in weekly_rows:
        weekly_by_status_week[(r["status"], r["week_start"])].append(float(r["days"]))

    week_starts = _week_starts_window(SPARKLINE_WEEKS)

    result: list[StatusStats] = []
    for status in _TRACKED_STATUSES:
        samples = by_status.get(status.value, [])
        sparkline: list[float | None] = []
        for ws in week_starts:
            week_samples = weekly_by_status_week.get((status.value, ws), [])
            sparkline.append(safe_percentile(week_samples, 75) if week_samples else None)

        result.append(
            StatusStats(
                status=status,
                sampleSize=len(samples),
                meanDays=(sum(samples) / len(samples)) if samples else None,
                p50Days=safe_percentile(samples, 50),
                p75Days=safe_percentile(samples, 75),
                p95Days=safe_percentile(samples, 95),
                weeklyP75Trend=sparkline,
            )
        )
    return result


async def _stuck_tasks(team_id: UUID, per_status: list[StatusStats]) -> list[StuckTask]:
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(_STUCK_CANDIDATES_SQL, team_id)

    # Map status → p75 threshold (fall back to a generous threshold if no history yet)
    threshold_by_status: dict[str, float] = {}
    for s in per_status:
        if s.p75Days is not None:
            threshold_by_status[s.status.value] = s.p75Days

    # Prisma maps DateTime to PostgreSQL timestamp(3) without timezone, so asyncpg
    # returns naive datetimes. Compare against a naive UTC "now" to avoid mixing
    # offset-naive and offset-aware values.
    now = datetime.utcnow()
    stuck: list[StuckTask] = []
    for row in rows:
        status_value = row["status"]
        entered = row["entered_status_at"]
        if entered.tzinfo is not None:
            entered = entered.replace(tzinfo=None)
        age_days = (now - entered).total_seconds() / 86400.0
        threshold = threshold_by_status.get(status_value)
        if threshold is None:
            # No historical p75 yet — flag anything older than 3 days as a fallback
            if age_days < 3.0:
                continue
        elif age_days <= threshold:
            continue

        stuck.append(
            StuckTask(
                id=row["id"],
                title=row["title"],
                status=TaskStatus(status_value),
                enteredStatusAt=entered,
                ageDays=age_days,
                assigneeUserId=row["assignee_user_id"],
            )
        )

    # Oldest-stuck first, capped
    stuck.sort(key=lambda s: s.ageDays, reverse=True)
    return stuck[:STUCK_TASK_LIMIT]


async def get_bottlenecks(team_id: UUID) -> BottlenecksResponse:
    per_status = await _per_status_stats(team_id)
    stuck = await _stuck_tasks(team_id, per_status)
    return BottlenecksResponse(teamId=team_id, perStatus=per_status, stuckTasks=stuck)


async def get_cfd(team_id: UUID) -> CfdResponse:
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(_CFD_SQL, team_id)

    points = [
        CfdPoint(
            date=row["day"],
            todo=row["todo"],
            inProgress=row["in_progress"],
            inReview=row["in_review"],
            done=row["done"],
        )
        for row in rows
    ]
    return CfdResponse(teamId=team_id, points=points)
