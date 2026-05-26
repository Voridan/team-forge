"""Integration tests for get_workload(team_id)."""
from __future__ import annotations

from app.queries.workload_queries import get_workload

from .fixtures import insert_task, insert_team_with_members


class TestGetWorkload:
    async def test_empty_team_yields_zero_open_counts(self, clean_db):
        team_id, users = await insert_team_with_members(clean_db, member_count=3)

        result = await get_workload(team_id)

        assert len(result.members) == 3
        assert all(m.openCount == 0 for m in result.members)
        assert result.maxMedianRatio is None  # median 0 → undefined

    async def test_only_done_tasks_count_as_zero_open(self, clean_db):
        team_id, users = await insert_team_with_members(clean_db, member_count=2)
        for u in users:
            await insert_task(clean_db, team_id=team_id, assignee_user_id=u, status="DONE")

        result = await get_workload(team_id)

        assert all(m.openCount == 0 for m in result.members)
        assert result.maxMedianRatio is None

    async def test_balanced_team_has_ratio_one(self, clean_db):
        team_id, users = await insert_team_with_members(clean_db, member_count=4)
        for u in users:
            await insert_task(clean_db, team_id=team_id, assignee_user_id=u, status="TODO")

        result = await get_workload(team_id)

        assert result.maxMedianRatio == 1.0
        assert all(not m.isOverloaded for m in result.members)

    async def test_imbalanced_team_flags_outlier(self, clean_db):
        team_id, users = await insert_team_with_members(clean_db, member_count=6)
        # User 0 gets 10 tasks, others get 1 each
        for _ in range(10):
            await insert_task(
                clean_db, team_id=team_id, assignee_user_id=users[0], status="IN_PROGRESS"
            )
        for u in users[1:]:
            await insert_task(clean_db, team_id=team_id, assignee_user_id=u, status="TODO")

        result = await get_workload(team_id)

        # Rows ordered by open_count desc — user 0 is first.
        assert result.members[0].openCount == 10
        assert result.members[0].isOverloaded is True
        # Ratio is 10 / 1 = 10
        assert result.maxMedianRatio == 10.0

    async def test_per_status_breakdown_is_correct(self, clean_db):
        team_id, users = await insert_team_with_members(clean_db, member_count=1)
        await insert_task(clean_db, team_id=team_id, assignee_user_id=users[0], status="TODO")
        await insert_task(clean_db, team_id=team_id, assignee_user_id=users[0], status="TODO")
        await insert_task(clean_db, team_id=team_id, assignee_user_id=users[0], status="IN_PROGRESS")
        await insert_task(clean_db, team_id=team_id, assignee_user_id=users[0], status="IN_REVIEW")

        result = await get_workload(team_id)

        m = result.members[0]
        assert m.byStatus["TODO"] == 2
        assert m.byStatus["IN_PROGRESS"] == 1
        assert m.byStatus["IN_REVIEW"] == 1
        assert m.openCount == 4
