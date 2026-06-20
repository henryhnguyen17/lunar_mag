from __future__ import annotations

from datetime import datetime
from math import sqrt


KAGUYA_ORBIT_SPEED_KM_S = 1.58


def magnetic_magnitude(b_x_nt: float, b_y_nt: float, b_z_nt: float) -> float:
    return sqrt(b_x_nt**2 + b_y_nt**2 + b_z_nt**2)


def enhancement_ratio(b_peak_nt: float, b_pre_nt: float) -> float:
    if b_pre_nt <= 0:
        raise ValueError("b_pre_nt must be positive")
    return b_peak_nt / b_pre_nt


def event_duration_seconds(start_time_utc: datetime, end_time_utc: datetime) -> float:
    duration = (end_time_utc - start_time_utc).total_seconds()
    if duration < 0:
        raise ValueError("end_time_utc must be after start_time_utc")
    return duration


def orbit_scale_km(
    duration_s: float,
    orbit_speed_km_s: float = KAGUYA_ORBIT_SPEED_KM_S,
) -> float:
    if duration_s < 0:
        raise ValueError("duration_s must be non-negative")
    if orbit_speed_km_s <= 0:
        raise ValueError("orbit_speed_km_s must be positive")
    return duration_s * orbit_speed_km_s

