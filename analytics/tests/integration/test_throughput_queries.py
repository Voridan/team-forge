"""Integration tests for get_throughput(team_id)."""
from __future__ import annotations

from datetime import date, timedelta

from app.queries.throughput_queries import get_throughput

from .fixtures import (
    days_ago,
    insert_task,
    insert_team_with_members,
    lifecycle,
)


class TestGetThroughput:
    async def test_empty_team_returns_zero_filled_window(self, clean_db):
        team_id, _ = await insert_team_with_members(clean_db, member_count=1)

        result = await get_throughput(team_id)

        # 12 weekly buckets, all zeros
        assert len(result.weeks) == 12
        assert all(w.created == 0 and w.completed == 0 for w in result.weeks)
        assert result.latestWeekCompleted == 0
        assert result.overdueCount == 0

    async def test_completed_tasks_in_window_are_counted(self, clean_db):
        team_id, users = await insert_team_with_members(clean_db, member_count=1)
        # Three tasks all completed within the last 30 days
        for i in range(3):
            t_created = days_ago(20 - i * 3)
            t_done = days_ago(5 - i)
            await lifecycle(
                clean_db,
                team_id=team_id,
                assignee_user_id=users[0],
                status_at_end="DONE",
                created_at=t_created,
                transitions=[
                    (None, "TODO", t_created),
                    ("TODO", "IN_PROGRESS", t_done - timedelta(days=2)),
                    ("IN_PROGRESS", "DONE", t_done),
                ],
            )

        result = await get_throughput(team_id)

        total_completed = sum(w.completed for w in result.weeks)
        assert total_completed == 3

    async def test_overdue_count(self, clean_db):
        team_id, users = await insert_team_with_members(clean_db, member_count=1)
        # Two tasks overdue (past due date, not DONE)
        for _ in range(2):
            await insert_task(
                clean_db,
                team_id=team_id,
                assignee_user_id=users[0],
                status="IN_PROGRESS",
                due_date=date.today() - timedelta(days=5),
            )
        # One overdue task that IS done — shouldn't count
        await insert_task(
            clean_db,
            team_id=team_id,
            assignee_user_id=users[0],
            status="DONE",
            due_date=date.today() - timedelta(days=5),
        )

        result = await get_throughput(team_id)

        assert result.overdueCount == 2

    async def test_due_soon_within_7_days_listed(self, clean_db):
        team_id, users = await insert_team_with_members(clean_db, member_count=1)
        await insert_task(
            clean_db,
            team_id=team_id,
            assignee_user_id=users[0],
            status="IN_PROGRESS",
            due_date=date.today() + timedelta(days=3),
            title="Soon",
        )
        # Outside the window
        await insert_task(
            clean_db,
            team_id=team_id,
            assignee_user_id=users[0],
            status="IN_PROGRESS",
            due_date=date.today() + timedelta(days=14),
            title="Later",
        )

        result = await get_throughput(team_id)

        assert len(result.dueSoon) == 1
        assert result.dueSoon[0].title == "Soon"
