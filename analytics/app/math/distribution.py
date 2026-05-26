"""
Distribution / inequality helpers for the workload metric.

`max_median_ratio` is the headline number; `iqr_fence` identifies which
specific members sit above the upper fence (overloaded).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from app.math.percentile import safe_median, safe_percentile

_IQR_MULTIPLIER = 1.5


@dataclass(frozen=True, slots=True)
class IqrOutliers:
    upper_fence: float | None
    overloaded_indices: list[int]


def max_median_ratio(values: Sequence[float]) -> float | None:
    """
    max(values) / median(values). Returns None for empty input.

    For a perfectly even distribution the ratio is 1.0; values >> 1 indicate
    one member carrying disproportionately more than the team median.
    A median of 0 (no one has any tasks) returns None — the ratio is undefined.
    """
    med = safe_median(values)
    if med is None or med == 0:
        return None
    return max(values) / med


def iqr_fence(values: Sequence[float]) -> IqrOutliers:
    """
    Identify indices whose value exceeds `Q3 + 1.5 * IQR` (the upper Tukey
    fence). Returns the fence value plus the offending indices, sorted ascending.

    For samples with fewer than 4 values the fence is unstable; we return
    upper_fence=None and an empty outlier list.
    """
    if len(values) < 4:
        return IqrOutliers(upper_fence=None, overloaded_indices=[])

    q1 = safe_percentile(values, 25)
    q3 = safe_percentile(values, 75)
    if q1 is None or q3 is None:
        return IqrOutliers(upper_fence=None, overloaded_indices=[])

    iqr = q3 - q1
    fence = q3 + _IQR_MULTIPLIER * iqr
    overloaded = sorted(i for i, v in enumerate(values) if v > fence)
    return IqrOutliers(upper_fence=fence, overloaded_indices=overloaded)
