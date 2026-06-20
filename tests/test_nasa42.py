from __future__ import annotations

from pathlib import Path

import pytest

from lunar_mag.nasa42 import load_orbit_samples_from_state_log, load_state_log


SAMPLE_STATE_LOG = Path("data/synthetic/nasa42/state_logs/sample_lunar_orbit_state.csv")


def test_load_state_log_reads_sample_fixture() -> None:
    records = load_state_log(SAMPLE_STATE_LOG)

    assert len(records) == 1441
    assert records[0].source_simulator == "NASA 42-compatible Lunar Prospector baseline"
    assert records[0].attitude_q0 == pytest.approx(1.0)


def test_load_orbit_samples_from_state_log_converts_to_navigation_records() -> None:
    samples = load_orbit_samples_from_state_log(SAMPLE_STATE_LOG, orbit_id="sample")

    assert len(samples) == 1441
    assert samples[0].latitude_deg == pytest.approx(-89.45)
    assert samples[0].altitude_km == pytest.approx(99.45)
    assert max(sample.altitude_km for sample in samples) == pytest.approx(101.2)
    assert samples[0].velocity_km_s == pytest.approx(1.6342, rel=1e-4)
    assert all(sample.orbit_id == "sample" for sample in samples)
