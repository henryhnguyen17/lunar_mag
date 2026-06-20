from __future__ import annotations

from datetime import datetime

import pytest

from lunar_mag.geometry import (
    MOON_MEAN_RADIUS_KM,
    cartesian_to_selenographic,
    great_circle_distance_km,
    normalize_longitude_deg,
    state_record_to_orbit_sample,
)
from lunar_mag.interpolation import bilinear_interpolate
from lunar_mag.schemas import Nasa42StateRecord
from lunar_mag.scoring import error_reduction, rmse


def test_cartesian_to_selenographic_equator_prime_meridian() -> None:
    latitude_deg, longitude_deg, altitude_km = cartesian_to_selenographic(
        MOON_MEAN_RADIUS_KM + 100.0,
        0.0,
        0.0,
    )

    assert latitude_deg == pytest.approx(0.0)
    assert longitude_deg == pytest.approx(0.0)
    assert altitude_km == pytest.approx(100.0)


def test_cartesian_to_selenographic_north_pole() -> None:
    latitude_deg, longitude_deg, altitude_km = cartesian_to_selenographic(
        0.0,
        0.0,
        MOON_MEAN_RADIUS_KM + 50.0,
    )

    assert latitude_deg == pytest.approx(90.0)
    assert longitude_deg == pytest.approx(0.0)
    assert altitude_km == pytest.approx(50.0)


def test_cartesian_to_selenographic_rejects_zero_vector() -> None:
    with pytest.raises(ValueError, match="position vector must be non-zero"):
        cartesian_to_selenographic(0.0, 0.0, 0.0)


def test_normalize_longitude_deg() -> None:
    assert normalize_longitude_deg(190.0) == pytest.approx(-170.0)
    assert normalize_longitude_deg(-190.0) == pytest.approx(170.0)


def test_great_circle_distance_quarter_lunar_circumference() -> None:
    distance_km = great_circle_distance_km(0.0, 0.0, 0.0, 90.0)

    assert distance_km == pytest.approx(0.5 * 3.141592653589793 * MOON_MEAN_RADIUS_KM)


def test_state_record_to_orbit_sample() -> None:
    state = Nasa42StateRecord(
        timestamp_utc=datetime.fromisoformat("2026-01-01T00:00:00"),
        position_x_km=MOON_MEAN_RADIUS_KM + 100.0,
        position_y_km=0.0,
        position_z_km=0.0,
        velocity_x_km_s=0.0,
        velocity_y_km_s=1.6,
        velocity_z_km_s=0.0,
    )

    orbit_sample = state_record_to_orbit_sample(state, orbit_id="test-orbit")

    assert orbit_sample.latitude_deg == pytest.approx(0.0)
    assert orbit_sample.longitude_deg == pytest.approx(0.0)
    assert orbit_sample.altitude_km == pytest.approx(100.0)
    assert orbit_sample.velocity_km_s == pytest.approx(1.6)
    assert orbit_sample.orbit_id == "test-orbit"


def test_bilinear_interpolate_center_value() -> None:
    value = bilinear_interpolate(
        x=0.5,
        y=0.5,
        x0=0.0,
        x1=1.0,
        y0=0.0,
        y1=1.0,
        q11=0.0,
        q21=10.0,
        q12=20.0,
        q22=30.0,
    )

    assert value == pytest.approx(15.0)


def test_rmse() -> None:
    assert rmse([1.0, 2.0, 3.0], [1.0, 4.0, 3.0]) == pytest.approx((4.0 / 3.0) ** 0.5)


def test_rmse_rejects_mismatched_lengths() -> None:
    with pytest.raises(ValueError, match="same length"):
        rmse([1.0], [1.0, 2.0])


def test_error_reduction() -> None:
    reduction_km, reduction_percent = error_reduction(10.0, 6.0)

    assert reduction_km == pytest.approx(4.0)
    assert reduction_percent == pytest.approx(40.0)

