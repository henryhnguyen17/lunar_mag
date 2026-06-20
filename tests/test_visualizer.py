from __future__ import annotations

import json
from datetime import datetime

import pytest

from lunar_mag.schemas import OrbitSample
from lunar_mag.bodies import BodyConfig
from lunar_mag.visualizer import orbit_samples_to_payload, write_orbit_payload


def test_orbit_samples_to_payload() -> None:
    samples = [
        OrbitSample(
            timestamp_utc=datetime.fromisoformat("2026-01-01T00:00:00"),
            latitude_deg=1.0,
            longitude_deg=2.0,
            altitude_km=100.0,
            velocity_km_s=1.6,
            orbit_id="test-orbit",
        )
    ]

    payload = orbit_samples_to_payload(samples)

    assert payload["schema"] == "lunar_mag.visualizer.orbit.v1"
    assert payload["sample_count"] == 1
    assert payload["orbit_id"] == "test-orbit"
    assert payload["samples"][0]["latitude_deg"] == pytest.approx(1.0)


def test_orbit_samples_to_payload_can_include_center_body() -> None:
    samples = [
        OrbitSample(
            timestamp_utc=datetime.fromisoformat("2026-01-01T00:00:00"),
            latitude_deg=1.0,
            longitude_deg=2.0,
            altitude_km=100.0,
            velocity_km_s=1.6,
            orbit_id="test-orbit",
        )
    ]
    body = BodyConfig(
        body_id="moon",
        display_name="Moon",
        radius_km=1737.4,
        color="#b8bec8",
        map_longitude_min_deg=-180.0,
        map_longitude_max_deg=180.0,
        map_latitude_min_deg=-90.0,
        map_latitude_max_deg=90.0,
    )

    payload = orbit_samples_to_payload(samples, body=body)

    assert payload["center_body"]["body_id"] == "moon"
    assert payload["center_body"]["radius_km"] == pytest.approx(1737.4)


def test_orbit_samples_to_payload_rejects_empty_input() -> None:
    with pytest.raises(ValueError, match="at least one orbit sample"):
        orbit_samples_to_payload([])


def test_write_orbit_payload(tmp_path) -> None:
    output_path = tmp_path / "orbit.json"
    samples = [
        OrbitSample(
            timestamp_utc=datetime.fromisoformat("2026-01-01T00:00:00"),
            latitude_deg=1.0,
            longitude_deg=2.0,
            altitude_km=100.0,
            velocity_km_s=1.6,
            orbit_id="test-orbit",
        )
    ]

    write_orbit_payload(samples, output_path)

    payload = json.loads(output_path.read_text())
    assert payload["sample_count"] == 1
    assert payload["samples"][0]["timestamp_utc"] == "2026-01-01T00:00:00"
