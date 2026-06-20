from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from lunar_mag.bodies import BodyConfig
from lunar_mag.schemas import OrbitSample


def orbit_samples_to_payload(
    samples: Iterable[OrbitSample],
    body: BodyConfig | None = None,
) -> dict[str, object]:
    rows = [
        {
            "timestamp_utc": sample.timestamp_utc.isoformat(),
            "latitude_deg": sample.latitude_deg,
            "longitude_deg": sample.longitude_deg,
            "altitude_km": sample.altitude_km,
            "velocity_km_s": sample.velocity_km_s,
            "orbit_id": sample.orbit_id,
        }
        for sample in samples
    ]
    if not rows:
        raise ValueError("at least one orbit sample is required")

    payload: dict[str, object] = {
        "schema": "lunar_mag.visualizer.orbit.v1",
        "sample_count": len(rows),
        "orbit_id": rows[0]["orbit_id"],
        "samples": rows,
    }
    if body is not None:
        payload["center_body"] = {
            "body_id": body.body_id,
            "display_name": body.display_name,
            "radius_km": body.radius_km,
            "color": body.color,
            "map_bounds": {
                "longitude_min_deg": body.map_longitude_min_deg,
                "longitude_max_deg": body.map_longitude_max_deg,
                "latitude_min_deg": body.map_latitude_min_deg,
                "latitude_max_deg": body.map_latitude_max_deg,
            },
        }
    return payload


def write_orbit_payload(
    samples: Iterable[OrbitSample],
    path: Path,
    body: BodyConfig | None = None,
) -> None:
    payload = orbit_samples_to_payload(samples, body=body)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n")
