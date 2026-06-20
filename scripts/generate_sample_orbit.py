from __future__ import annotations

import argparse
import csv
import sys
from datetime import datetime, timedelta
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from lunar_mag.bodies import load_body_config
from lunar_mag.geometry import MOON_MEAN_RADIUS_KM
from lunar_mag.nasa42 import load_orbit_samples_from_state_log
from lunar_mag.visualizer import write_orbit_payload


MOON_MU_KM3_S2 = 4902.800066
MOON_SIDEREAL_PERIOD_S = 27.321661 * 24.0 * 60.0 * 60.0
LUNAR_PROSPECTOR_PERILUNE_ALTITUDE_KM = 99.45
LUNAR_PROSPECTOR_APOLUNE_ALTITUDE_KM = 101.2
LUNAR_PROSPECTOR_INCLINATION_DEG = 90.55


def solve_eccentric_anomaly(mean_anomaly_rad: float, eccentricity: float) -> float:
    eccentric_anomaly_rad = mean_anomaly_rad
    for _ in range(12):
        residual = (
            eccentric_anomaly_rad
            - eccentricity * sin(eccentric_anomaly_rad)
            - mean_anomaly_rad
        )
        derivative = 1.0 - eccentricity * cos(eccentric_anomaly_rad)
        eccentric_anomaly_rad -= residual / derivative
    return eccentric_anomaly_rad


def rotate_orbital_to_inertial(
    x_km: float,
    y_km: float,
    z_km: float,
    raan_rad: float,
    inclination_rad: float,
    argument_of_perilune_rad: float,
) -> tuple[float, float, float]:
    cos_raan = cos(raan_rad)
    sin_raan = sin(raan_rad)
    cos_inc = cos(inclination_rad)
    sin_inc = sin(inclination_rad)
    cos_arg = cos(argument_of_perilune_rad)
    sin_arg = sin(argument_of_perilune_rad)

    return (
        (cos_raan * cos_arg - sin_raan * sin_arg * cos_inc) * x_km
        + (-cos_raan * sin_arg - sin_raan * cos_arg * cos_inc) * y_km
        + (sin_raan * sin_inc) * z_km,
        (sin_raan * cos_arg + cos_raan * sin_arg * cos_inc) * x_km
        + (-sin_raan * sin_arg + cos_raan * cos_arg * cos_inc) * y_km
        + (-cos_raan * sin_inc) * z_km,
        (sin_arg * sin_inc) * x_km
        + (cos_arg * sin_inc) * y_km
        + (cos_inc) * z_km,
    )


def rotate_inertial_to_moon_fixed(
    x_km: float,
    y_km: float,
    z_km: float,
    elapsed_s: float,
) -> tuple[float, float, float]:
    moon_rotation_rad = 2.0 * 3.141592653589793 * elapsed_s / MOON_SIDEREAL_PERIOD_S
    cos_rotation = cos(moon_rotation_rad)
    sin_rotation = sin(moon_rotation_rad)
    return (
        cos_rotation * x_km + sin_rotation * y_km,
        -sin_rotation * x_km + cos_rotation * y_km,
        z_km,
    )


def moon_fixed_velocity(
    position_fixed_km: tuple[float, float, float],
    velocity_rotated_km_s: tuple[float, float, float],
) -> tuple[float, float, float]:
    moon_rotation_rate_rad_s = 2.0 * 3.141592653589793 / MOON_SIDEREAL_PERIOD_S
    x_km, y_km, _ = position_fixed_km
    velocity_x_km_s, velocity_y_km_s, velocity_z_km_s = velocity_rotated_km_s
    return (
        velocity_x_km_s + moon_rotation_rate_rad_s * y_km,
        velocity_y_km_s - moon_rotation_rate_rad_s * x_km,
        velocity_z_km_s,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a NASA 42-like realistic low lunar orbit fixture."
    )
    parser.add_argument(
        "--state-log",
        type=Path,
        default=Path("data/synthetic/nasa42/state_logs/sample_lunar_orbit_state.csv"),
    )
    parser.add_argument(
        "--visualizer-json",
        type=Path,
        default=Path("app/visualizer/data/sample_orbit.json"),
    )
    parser.add_argument(
        "--body-config",
        type=Path,
        default=Path("app/visualizer/assets/bodies/moon/body.json"),
    )
    parser.add_argument(
        "--perilune-altitude-km",
        type=float,
        default=LUNAR_PROSPECTOR_PERILUNE_ALTITUDE_KM,
    )
    parser.add_argument(
        "--apolune-altitude-km",
        type=float,
        default=LUNAR_PROSPECTOR_APOLUNE_ALTITUDE_KM,
    )
    parser.add_argument(
        "--inclination-deg",
        type=float,
        default=LUNAR_PROSPECTOR_INCLINATION_DEG,
    )
    parser.add_argument("--raan-deg", type=float, default=35.0)
    parser.add_argument("--argument-of-perilune-deg", type=float, default=270.0)
    parser.add_argument("--mean-anomaly-deg", type=float, default=0.0)
    parser.add_argument("--step-s", type=float, default=5.0)
    parser.add_argument("--duration-s", type=float, default=7200.0)
    args = parser.parse_args()

    args.state_log.parent.mkdir(parents=True, exist_ok=True)
    perilune_radius_km = MOON_MEAN_RADIUS_KM + args.perilune_altitude_km
    apolune_radius_km = MOON_MEAN_RADIUS_KM + args.apolune_altitude_km
    semi_major_axis_km = (perilune_radius_km + apolune_radius_km) / 2.0
    eccentricity = (
        apolune_radius_km - perilune_radius_km
    ) / (apolune_radius_km + perilune_radius_km)
    semi_latus_rectum_km = semi_major_axis_km * (1.0 - eccentricity**2)
    mean_motion_rad_s = sqrt(MOON_MU_KM3_S2 / semi_major_axis_km**3)
    mean_anomaly_start_rad = radians(args.mean_anomaly_deg)
    inclination_rad = radians(args.inclination_deg)
    raan_rad = radians(args.raan_deg)
    argument_of_perilune_rad = radians(args.argument_of_perilune_deg)
    start_time = datetime.fromisoformat("2026-01-01T00:00:00")

    with args.state_log.open("w", newline="") as file:
        writer = csv.writer(file, lineterminator="\n")
        writer.writerow(
            [
                "timestamp_utc",
                "position_x_km",
                "position_y_km",
                "position_z_km",
                "velocity_x_km_s",
                "velocity_y_km_s",
                "velocity_z_km_s",
                "attitude_q0",
                "attitude_q1",
                "attitude_q2",
                "attitude_q3",
                "source_simulator",
            ]
        )
        sample_count = int(args.duration_s / args.step_s) + 1
        for index in range(sample_count):
            elapsed_s = index * args.step_s
            timestamp = start_time + timedelta(seconds=elapsed_s)
            mean_anomaly_rad = mean_anomaly_start_rad + mean_motion_rad_s * elapsed_s
            eccentric_anomaly_rad = solve_eccentric_anomaly(
                mean_anomaly_rad, eccentricity
            )
            true_anomaly_rad = 2.0 * atan2(
                sqrt(1.0 + eccentricity) * sin(eccentric_anomaly_rad / 2.0),
                sqrt(1.0 - eccentricity) * cos(eccentric_anomaly_rad / 2.0),
            )
            radius_km = semi_latus_rectum_km / (
                1.0 + eccentricity * cos(true_anomaly_rad)
            )
            orbital_speed_factor = sqrt(MOON_MU_KM3_S2 / semi_latus_rectum_km)

            orbital_position = (
                radius_km * cos(true_anomaly_rad),
                radius_km * sin(true_anomaly_rad),
                0.0,
            )
            orbital_velocity = (
                -orbital_speed_factor * sin(true_anomaly_rad),
                orbital_speed_factor * (eccentricity + cos(true_anomaly_rad)),
                0.0,
            )
            inertial_position = rotate_orbital_to_inertial(
                *orbital_position,
                raan_rad=raan_rad,
                inclination_rad=inclination_rad,
                argument_of_perilune_rad=argument_of_perilune_rad,
            )
            inertial_velocity = rotate_orbital_to_inertial(
                *orbital_velocity,
                raan_rad=raan_rad,
                inclination_rad=inclination_rad,
                argument_of_perilune_rad=argument_of_perilune_rad,
            )
            fixed_position = rotate_inertial_to_moon_fixed(
                *inertial_position,
                elapsed_s=elapsed_s,
            )
            rotated_velocity = rotate_inertial_to_moon_fixed(
                *inertial_velocity,
                elapsed_s=elapsed_s,
            )
            fixed_velocity = moon_fixed_velocity(fixed_position, rotated_velocity)

            position_x_km, position_y_km, position_z_km = fixed_position
            velocity_x_km_s, velocity_y_km_s, velocity_z_km_s = fixed_velocity

            writer.writerow(
                [
                    timestamp.isoformat(),
                    f"{position_x_km:.6f}",
                    f"{position_y_km:.6f}",
                    f"{position_z_km:.6f}",
                    f"{velocity_x_km_s:.9f}",
                    f"{velocity_y_km_s:.9f}",
                    f"{velocity_z_km_s:.9f}",
                    "1.0",
                    "0.0",
                    "0.0",
                    "0.0",
                    "NASA 42-compatible Lunar Prospector baseline",
                ]
            )

    samples = load_orbit_samples_from_state_log(
        args.state_log, orbit_id="lunar-prospector-baseline"
    )
    body = load_body_config(args.body_config)
    write_orbit_payload(samples, args.visualizer_json, body=body)


if __name__ == "__main__":
    main()
