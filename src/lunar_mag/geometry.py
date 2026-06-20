from __future__ import annotations

from math import asin, atan2, cos, degrees, radians, sin, sqrt

from lunar_mag.schemas import Nasa42StateRecord, OrbitSample


MOON_MEAN_RADIUS_KM = 1737.4


def vector_magnitude(x: float, y: float, z: float) -> float:
    return sqrt(x**2 + y**2 + z**2)


def normalize_longitude_deg(longitude_deg: float) -> float:
    normalized = (longitude_deg + 180.0) % 360.0 - 180.0
    if normalized == -180.0 and longitude_deg > 0:
        return 180.0
    return normalized


def cartesian_to_selenographic(
    x_km: float,
    y_km: float,
    z_km: float,
    radius_km: float = MOON_MEAN_RADIUS_KM,
) -> tuple[float, float, float]:
    radius_from_center_km = vector_magnitude(x_km, y_km, z_km)
    if radius_from_center_km <= 0:
        raise ValueError("position vector must be non-zero")

    latitude_deg = degrees(asin(z_km / radius_from_center_km))
    longitude_deg = normalize_longitude_deg(degrees(atan2(y_km, x_km)))
    altitude_km = radius_from_center_km - radius_km
    return latitude_deg, longitude_deg, altitude_km


def great_circle_distance_km(
    latitude_a_deg: float,
    longitude_a_deg: float,
    latitude_b_deg: float,
    longitude_b_deg: float,
    radius_km: float = MOON_MEAN_RADIUS_KM,
) -> float:
    lat_a = radians(latitude_a_deg)
    lat_b = radians(latitude_b_deg)
    delta_lat = radians(latitude_b_deg - latitude_a_deg)
    delta_lon = radians(longitude_b_deg - longitude_a_deg)

    haversine = (
        sin(delta_lat / 2.0) ** 2
        + cos(lat_a) * cos(lat_b) * sin(delta_lon / 2.0) ** 2
    )
    return 2.0 * radius_km * asin(min(1.0, sqrt(haversine)))


def state_record_to_orbit_sample(
    state: Nasa42StateRecord,
    orbit_id: str,
    radius_km: float = MOON_MEAN_RADIUS_KM,
) -> OrbitSample:
    latitude_deg, longitude_deg, altitude_km = cartesian_to_selenographic(
        state.position_x_km,
        state.position_y_km,
        state.position_z_km,
        radius_km=radius_km,
    )
    velocity_km_s = vector_magnitude(
        state.velocity_x_km_s,
        state.velocity_y_km_s,
        state.velocity_z_km_s,
    )
    return OrbitSample(
        timestamp_utc=state.timestamp_utc,
        latitude_deg=latitude_deg,
        longitude_deg=longitude_deg,
        altitude_km=altitude_km,
        velocity_km_s=velocity_km_s,
        orbit_id=orbit_id,
    )

