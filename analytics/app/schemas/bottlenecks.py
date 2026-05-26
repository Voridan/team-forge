from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import TaskStatus


class StatusStats(BaseModel):
    status: TaskStatus
    sampleSize: int
    meanDays: float | None
    p50Days: float | None
    p75Days: float | None
    p95Days: float | None
    weeklyP75Trend: list[float | None]  # 12 weeks, oldest first


class StuckTask(BaseModel):
    id: UUID
    title: str
    status: TaskStatus
    enteredStatusAt: datetime
    ageDays: float
    assigneeUserId: UUID | None


class BottlenecksResponse(BaseModel):
    teamId: UUID
    perStatus: list[StatusStats]
    stuckTasks: list[StuckTask]


class CfdPoint(BaseModel):
    date: date
    todo: int
    inProgress: int
    inReview: int
    done: int


class CfdResponse(BaseModel):
    teamId: UUID
    points: list[CfdPoint]
