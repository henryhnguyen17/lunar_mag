from __future__ import annotations

from pathlib import Path

import pytest

from lunar_mag.bodies import load_body_config


def test_load_moon_body_config() -> None:
    body = load_body_config(Path("app/visualizer/assets/bodies/moon/body.json"))

    assert body.body_id == "moon"
    assert body.display_name == "Moon"
    assert body.radius_km == pytest.approx(1737.4)
    assert body.map_longitude_min_deg == pytest.approx(-180.0)
    assert body.map_longitude_max_deg == pytest.approx(180.0)
