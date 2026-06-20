"""Tools for lunar magnetic compression event detection."""

from lunar_mag.features import (
    enhancement_ratio,
    event_duration_seconds,
    magnetic_magnitude,
    orbit_scale_km,
)
from lunar_mag.schemas import BenchmarkEvent, EventDetection, MagnetometerSample

__all__ = [
    "BenchmarkEvent",
    "EventDetection",
    "MagnetometerSample",
    "enhancement_ratio",
    "event_duration_seconds",
    "magnetic_magnitude",
    "orbit_scale_km",
]

