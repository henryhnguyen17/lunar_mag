from __future__ import annotations

from math import sqrt
from typing import Sequence


def rmse(measured: Sequence[float], predicted: Sequence[float]) -> float:
    if len(measured) != len(predicted):
        raise ValueError("measured and predicted must have the same length")
    if not measured:
        raise ValueError("sequences must not be empty")

    squared_error_sum = sum(
        (measured_value - predicted_value) ** 2
        for measured_value, predicted_value in zip(measured, predicted)
    )
    return sqrt(squared_error_sum / len(measured))


def error_reduction(prior_error_km: float, posterior_error_km: float) -> tuple[float, float]:
    if prior_error_km < 0:
        raise ValueError("prior_error_km must be non-negative")
    if posterior_error_km < 0:
        raise ValueError("posterior_error_km must be non-negative")

    reduction_km = prior_error_km - posterior_error_km
    if prior_error_km == 0:
        reduction_percent = 0.0
    else:
        reduction_percent = 100.0 * reduction_km / prior_error_km
    return reduction_km, reduction_percent

