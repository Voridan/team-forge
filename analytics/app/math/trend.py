"""
Time-series helpers for the throughput metric.

All operate on lists of weekly counts ordered oldest-first. Functions return
None where the sample is too small to compute meaningfully.
"""
from __future__ import annotations

from statistics import mean, pstdev
from typing import Sequence


def moving_average(values: Sequence[float], window: int) -> list[float | None]:
    """
    Right-aligned moving average. Index i is the mean of values[i-window+1..i].
    Returns None for indices where the window doesn't fully fit.
    """
    if window <= 0:
        raise ValueError("window must be > 0")
    out: list[float | None] = []
    for i in range(len(values)):
        if i + 1 < window:
            out.append(None)
        else:
            out.append(sum(values[i - window + 1 : i + 1]) / window)
    return out


def pop_delta_pct(latest: float, baseline: Sequence[float]) -> float | None:
    """
    Percentage change of `latest` vs the mean of `baseline`. Returns None when
    baseline is empty or its mean is zero.
    """
    if not baseline:
        return None
    base_mean = mean(baseline)
    if base_mean == 0:
        return None
    return (latest - base_mean) / base_mean * 100.0


def regression_slope(values: Sequence[float]) -> float | None:
    """
    Least-squares slope (units per index step) for y = m*x + b where x is the
    sample index. Returns None for fewer than 2 points or zero variance in x.
    """
    n = len(values)
    if n < 2:
        return None
    x = list(range(n))
    x_mean = (n - 1) / 2.0
    y_mean = sum(values) / n
    num = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
    den = sum((x[i] - x_mean) ** 2 for i in range(n))
    if den == 0:
        return None
    return num / den


def z_score(latest: float, baseline: Sequence[float]) -> float | None:
    """
    z = (latest - mean(baseline)) / stdev(baseline). Returns None when baseline
    has fewer than 2 points or zero variance.
    """
    if len(baseline) < 2:
        return None
    sd = pstdev(baseline)
    if sd == 0:
        return None
    return (latest - mean(baseline)) / sd
