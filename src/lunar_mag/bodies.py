from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class BodyConfig:
    body_id: str
    display_name: str
    radius_km: float
    color: str
    map_longitude_min_deg: float
    map_longitude_max_deg: float
    map_latitude_min_deg: float
    map_latitude_max_deg: float


def load_body_config(path: Path) -> BodyConfig:
    payload = json.loads(path.read_text())
    return BodyConfig(
        body_id=str(payload["body_id"]),
        display_name=str(payload["display_name"]),
        radius_km=float(payload["radius_km"]),
        color=str(payload["color"]),
        map_longitude_min_deg=float(payload["map_bounds"]["longitude_min_deg"]),
        map_longitude_max_deg=float(payload["map_bounds"]["longitude_max_deg"]),
        map_latitude_min_deg=float(payload["map_bounds"]["latitude_min_deg"]),
        map_latitude_max_deg=float(payload["map_bounds"]["latitude_max_deg"]),
    )

