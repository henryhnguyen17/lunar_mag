from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from lunar_mag.benchmarks import load_nakagawa_2023_events
from lunar_mag.features import (
    enhancement_ratio,
    event_duration_seconds,
    magnetic_magnitude,
    orbit_scale_km,
)


def test_magnetic_magnitude_uses_vector_norm() -> None:
    assert magnetic_magnitude(3.0, 4.0, 12.0) == pytest.approx(13.0)


def test_enhancement_ratio_for_first_benchmark_event() -> None:
    events = load_nakagawa_2023_events()
    event = events[0]

    assert enhancement_ratio(event.b_peak_nt, event.b_pre_nt) == pytest.approx(1.6333, rel=1e-4)


def test_enhancement_ratio_rejects_nonpositive_baseline() -> None:
    with pytest.raises(ValueError, match="b_pre_nt must be positive"):
        enhancement_ratio(4.9, 0.0)


def test_event_duration_seconds() -> None:
    start = datetime.fromisoformat("2008-01-01T13:29:20.044200")
    end = start + timedelta(seconds=6.969)

    assert event_duration_seconds(start, end) == pytest.approx(6.969)


def test_event_duration_rejects_negative_time_order() -> None:
    start = datetime.fromisoformat("2008-01-01T13:29:20")
    end = start - timedelta(seconds=1)

    with pytest.raises(ValueError, match="end_time_utc must be after start_time_utc"):
        event_duration_seconds(start, end)


def test_kaguya_orbit_scale_matches_paper_order_of_magnitude() -> None:
    assert orbit_scale_km(6.969) == pytest.approx(11.0, rel=0.02)


def test_benchmark_event_table_is_machine_readable() -> None:
    events = load_nakagawa_2023_events()

    assert len(events) == 6
    assert [event.event_id for event in events] == [1, 2, 3, 4, 5, 6]
    assert all(event.duration_s < 10 for event in events)
    assert [event.interplanetary_discontinuity for event in events] == [
        False,
        False,
        True,
        True,
        True,
        True,
    ]

