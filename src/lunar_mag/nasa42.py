from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path

from lunar_mag.geometry import state_record_to_orbit_sample
from lunar_mag.schemas import Nasa42StateRecord, OrbitSample


def load_state_log(path: Path) -> list[Nasa42StateRecord]:
    records: list[Nasa42StateRecord] = []
    with path.open(newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            records.append(
                Nasa42StateRecord(
                    timestamp_utc=datetime.fromisoformat(row["timestamp_utc"]),
                    position_x_km=float(row["position_x_km"]),
                    position_y_km=float(row["position_y_km"]),
                    position_z_km=float(row["position_z_km"]),
                    velocity_x_km_s=float(row["velocity_x_km_s"]),
                    velocity_y_km_s=float(row["velocity_y_km_s"]),
                    velocity_z_km_s=float(row["velocity_z_km_s"]),
                    attitude_q0=_optional_float(row.get("attitude_q0")),
                    attitude_q1=_optional_float(row.get("attitude_q1")),
                    attitude_q2=_optional_float(row.get("attitude_q2")),
                    attitude_q3=_optional_float(row.get("attitude_q3")),
                    source_simulator=row.get("source_simulator") or "NASA 42",
                )
            )
    return records


def load_orbit_samples_from_state_log(path: Path, orbit_id: str) -> list[OrbitSample]:
    return [
        state_record_to_orbit_sample(state, orbit_id=orbit_id)
        for state in load_state_log(path)
    ]


def _optional_float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    return float(value)

