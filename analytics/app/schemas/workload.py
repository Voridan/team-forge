from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import TaskStatus


class MemberLoad(BaseModel):
    userId: UUID
    firstName: str
    lastName: str
    openCount: int  # TODO + IN_PROGRESS + IN_REVIEW
    byStatus: dict[TaskStatus, int]
    isOverloaded: bool  # above IQR upper fence


class WorkloadResponse(BaseModel):
    teamId: UUID
    members: list[MemberLoad]
    maxMedianRatio: float | None
    upperFence: float | None
