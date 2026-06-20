from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal


EventClass = Literal[
    "limb_compression",
    "discontinuity_compression",
    "crustal_anomaly_crossing",
    "solar_wind_noise",
    "unknown",
]


@dataclass(frozen=True)
class MagnetometerSample:
    timestamp_utc: datetime
    spacecraft: str
    latitude_deg: float
    longitude_deg: float
    altitude_km: float
    x_sse_km: float
    y_sse_km: float
    z_sse_km: float
    b_x_nt: float
    b_y_nt: float
    b_z_nt: float
    b_total_nt: float
    sample_rate_hz: float
    source_id: str


@dataclass(frozen=True)
class BenchmarkEvent:
    event_id: int
    timestamp_utc: datetime
    duration_s: float
    b_peak_nt: float
    b_pre_nt: float
    altitude_km: float
    interplanetary_discontinuity: bool


@dataclass(frozen=True)
class EventDetection:
    event_id: str
    start_time_utc: datetime
    peak_time_utc: datetime
    end_time_utc: datetime
    duration_s: float
    altitude_km: float
    b_pre_nt: float
    b_peak_nt: float
    enhancement_ratio: float
    delta_direction_deg: float | None
    estimated_scale_km: float | None
    terminator_distance_km: float | None
    dayside_nightside: Literal["dayside", "nightside", "terminator", "unknown"]
    upstream_discontinuity_flag: bool | None
    near_crustal_anomaly_flag: bool | None
    predicted_class: EventClass
    confidence: float | None

