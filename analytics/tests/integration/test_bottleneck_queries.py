"""Integration tests for get_bottlenecks() and get_cfd()."""
from __future__ import annotations

from datetime import timedelta

from app.queries.bottleneck_queries import get_bottlenecks, get_cfd
from app.schemas.common import TaskStatus

from .fixtures import days_ago, insert_team_with_members, lifecycle


class TestGetBottlenecks:
    async def test_empty_team_has_zero_samples(self, clean_db):
        team_id, _ = await insert_team_with_members(clean_db, member_count=1)

        result = await get_bottlenecks(team_id)

        for s in result.perStatus:
            assert s.sampleSize == 0
            assert s.p50Days is None
        assert result.stuckTasks == []

    async def test_in_review_dwell_p75_is_computed(self, clean_db):
        team_id, users = await insert_team_with_members(clean_db, member_count=1)
        # Three tasks that spent 1, 3, 5 days in IN_REVIEW, all completed in last 30d.
        # p75 of [1, 3, 5] = 4.0
        for dwell in (1, 3, 5):
            t_created = days_ago(10 + dwell)
            t_review_enter = days_ago(2 + dwell)
            t_done = days_ago(2)
            assert (t_done - t_review_enter).days == dwell - 0  # sanity
            await lifecycle(
                clean_db,
                team_id=team_id,
                assignee_user_id=users[0],
                status_at_end="DONE",
                created_at=t_created,
                transitions=[
                    (None, "TODO", t_created),
                    ("TODO", "IN_PROGRESS", t_created + timedelta(hours=2)),
                    ("IN_PROGRESS", "IN_REVIEW", t_review_enter),
                    ("IN_REVIEW", "DONE", t_done),
                ],
            )

        result = await get_bottlenecks(team_id)

        in_review = next(s for s in result.perStatus if s.status == TaskStatus.IN_REVIEW)
        assert in_review.sampleSize == 3
        assert in_review.p75Days is not None
        # p75 of [1,3,5] = 4.0 with linear interpolation
        assert 3.5 <= in_review.p75Days <= 4.5

    async def test_stuck_task_above_p75_is_flagged(self, clean_db):
        team_id, users = await insert_team_with_members(clean_db, member_count=1)
        # Two short IN_REVIEW completions to establish historical p75 ≈ 1-2 days
        for _ in range(2):
            t_created = days_ago(10)
            t_review_enter = days_ago(3)
            t_done = days_ago(2)
            await lifecycle(
                clean_db,
                team_id=team_id,
                assignee_user_id=users[0],
                status_at_end="DONE",
                created_at=t_created,
                transitions=[
                    (None, "TODO", t_created),
                    ("TODO", "IN_PROGRESS", t_created + timedelta(hours=1)),
                    ("IN_PROGRESS", "IN_REVIEW", t_review_enter),
                    ("IN_REVIEW", "DONE", t_done),
                ],
            )
        # Plus a current IN_REVIEW task that's been stuck 7 days
        t_created = days_ago(10)
        t_review = days_ago(7)
        await lifecycle(
            clean_db,
            team_id=team_id,
            assignee_user_id=users[0],
            status_at_end="IN_REVIEW",
            created_at=t_created,
            transitions=[
                (None, "TODO", t_created),
                ("TODO", "IN_PROGRESS", t_created + timedelta(hours=1)),
                ("IN_PROGRESS", "IN_REVIEW", t_review),
            ],
        )

        result = await get_bottlenecks(team_id)

        assert len(result.stuckTasks) >= 1
        stuck = result.stuckTasks[0]
        assert stuck.status == TaskStatus.IN_REVIEW
        assert stuck.ageDays > 6.0


class TestGetCfd:
    async def test_empty_team_returns_zero_filled_days(self, clean_db):
        team_id, _ = await insert_team_with_members(clean_db, member_count=1)

        result = await get_cfd(team_id)

        assert len(result.points) == 90
        assert all(
            p.todo == 0 and p.inProgress == 0 and p.inReview == 0 and p.done == 0
            for p in result.points
        )

    async def test_cfd_shows_done_count_growing_over_time(self, clean_db):
        team_id, users = await insert_team_with_members(clean_db, member_count=1)
        # Create a task and immediately complete it 30 days ago
        t_created = days_ago(30)
        t_done = days_ago(29)
        await lifecycle(
            clean_db,
            team_id=team_id,
            assignee_user_id=users[0],
            status_at_end="DONE",
            created_at=t_created,
            transitions=[
                (None, "TODO", t_created),
                ("TODO", "IN_PROGRESS", t_created + timedelta(hours=2)),
                ("IN_PROGRESS", "DONE", t_done),
            ],
        )

        result = await get_cfd(team_id)

        # Last point: 1 task in DONE
        last = result.points[-1]
        assert last.done == 1
        assert last.todo == 0
