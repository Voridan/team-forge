from datetime import date
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import TaskStatus


class WeeklyBucket(BaseModel):
    weekStart: date
    created: int
    completed: int


class DueSoonTask(BaseModel):
    id: UUID
    title: str
    dueDate: date | None
    status: TaskStatus
    assigneeUserId: UUID | None


class ThroughputResponse(BaseModel):
    teamId: UUID
    weeks: list[WeeklyBucket]
    movingAverage4w: list[float | None]
    latestWeekCompleted: int
    popDeltaPct: float | None
    regressionSlope: float | None
    zScore: float | None
    overdueCount: int
    dueSoon: list[DueSoonTask]
