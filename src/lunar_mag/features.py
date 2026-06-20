from __future__ import annotations

from math import sqrt


def magnetic_magnitude(b_x_nt: float, b_y_nt: float, b_z_nt: float) -> float:
    return sqrt(b_x_nt**2 + b_y_nt**2 + b_z_nt**2)
