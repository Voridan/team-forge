from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import Severity


class Recommendation(BaseModel):
    id: str  # stable per-rule key, e.g. "workload-imbalance"
    severity: Severity
    category: str  # "workload" | "bottleneck" | "throughput" | "overdue"
    headline: str
    body: str
    metricLink: str | None  # sub-tab anchor, e.g. "workload"


class RecommendationsResponse(BaseModel):
    teamId: UUID
    items: list[Recommendation]  # sorted by severity desc, then category
