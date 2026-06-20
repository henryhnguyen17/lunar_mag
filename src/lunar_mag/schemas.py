from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal


ReferenceFrame = Literal["moon_fixed", "inertial", "sse", "unknown"]


@dataclass(frozen=True)
class Nasa42StateRecord:
    timestamp_utc: datetime
    position_x_km: float
    position_y_km: float
    position_z_km: float
    velocity_x_km_s: float
    velocity_y_km_s: float
    velocity_z_km_s: float
    attitude_q0: float | None = None
    attitude_q1: float | None = None
    attitude_q2: float | None = None
    attitude_q3: float | None = None
    source_simulator: str = "NASA 42"


@dataclass(frozen=True)
class OrbitSample:
    timestamp_utc: datetime
    latitude_deg: float
    longitude_deg: float
    altitude_km: float
    velocity_km_s: float
    orbit_id: str


@dataclass(frozen=True)
class MagneticMapRecord:
    latitude_deg: float
    longitude_deg: float
    altitude_km: float
    b_x_nt: float
    b_y_nt: float
    b_z_nt: float
    b_total_nt: float
    source_id: str
    reference_frame: ReferenceFrame


@dataclass(frozen=True)
class NavigationMagnetometerSample:
    timestamp_utc: datetime
    latitude_deg: float
    longitude_deg: float
    altitude_km: float
    b_x_nt: float
    b_y_nt: float
    b_z_nt: float
    b_total_nt: float
    sensor_noise_nt: float
    sensor_bias_nt: float


@dataclass(frozen=True)
class LocalizationResult:
    window_id: str
    prior_error_km: float
    posterior_error_km: float
    error_reduction_km: float
    error_reduction_percent: float
    match_score: float
    window_duration_s: float
    altitude_km: float
    region_label: str

