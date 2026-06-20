from __future__ import annotations


def bilinear_interpolate(
    x: float,
    y: float,
    x0: float,
    x1: float,
    y0: float,
    y1: float,
    q11: float,
    q21: float,
    q12: float,
    q22: float,
) -> float:
    if x1 == x0:
        raise ValueError("x0 and x1 must be different")
    if y1 == y0:
        raise ValueError("y0 and y1 must be different")
    if not min(x0, x1) <= x <= max(x0, x1):
        raise ValueError("x must be inside interpolation bounds")
    if not min(y0, y1) <= y <= max(y0, y1):
        raise ValueError("y must be inside interpolation bounds")

    x_fraction = (x - x0) / (x1 - x0)
    y_fraction = (y - y0) / (y1 - y0)

    lower = q11 * (1.0 - x_fraction) + q21 * x_fraction
    upper = q12 * (1.0 - x_fraction) + q22 * x_fraction
    return lower * (1.0 - y_fraction) + upper * y_fraction

