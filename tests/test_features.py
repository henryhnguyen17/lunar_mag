from __future__ import annotations

import pytest

from lunar_mag.features import magnetic_magnitude


def test_magnetic_magnitude_uses_vector_norm() -> None:
    assert magnetic_magnitude(3.0, 4.0, 12.0) == pytest.approx(13.0)
