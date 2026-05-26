from uuid import UUID

from pydantic import BaseModel


class OverviewResponse(BaseModel):
    teamId: UUID
    openTasks: int
    completedLast7d: int
    overdueCount: int
    maxMedianRatio: float | None
    reviewBacklogP75Days: float | None
    activeRecommendations: int
