"""
Safe percentile helpers that handle small / empty samples.

NumPy isn't a dependency; the stdlib `statistics` module covers what we need.
"""
from __future__ import annotations

from statistics import median
from typing import Sequence


def safe_percentile(values: Sequence[float], q: float) -> float | None:
    """
    Linear-interpolation percentile (matching numpy.percentile default).

    Returns None for an empty sample. For a single-element sample returns that
    element regardless of `q`. `q` is in [0, 100].
    """
    if not values:
        return None
    if len(values) == 1:
        return float(values[0])
    if not 0 <= q <= 100:
        raise ValueError("q must be in [0, 100]")

    sorted_vals = sorted(values)
    rank = (q / 100.0) * (len(sorted_vals) - 1)
    lo = int(rank)
    hi = min(lo + 1, len(sorted_vals) - 1)
    frac = rank - lo
    return sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac


def safe_median(values: Sequence[float]) -> float | None:
    return float(median(values)) if values else None
