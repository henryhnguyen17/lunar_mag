from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path

from lunar_mag.schemas import BenchmarkEvent


DEFAULT_BENCHMARK_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "benchmarks"
    / "nakagawa_2023_events.csv"
)


def load_nakagawa_2023_events(
    path: Path = DEFAULT_BENCHMARK_PATH,
) -> list[BenchmarkEvent]:
    events: list[BenchmarkEvent] = []
    with path.open(newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            events.append(
                BenchmarkEvent(
                    event_id=int(row["event_id"]),
                    timestamp_utc=datetime.fromisoformat(row["timestamp_utc"]),
                    duration_s=float(row["duration_s"]),
                    b_peak_nt=float(row["b_peak_nt"]),
                    b_pre_nt=float(row["b_pre_nt"]),
                    altitude_km=float(row["altitude_km"]),
                    interplanetary_discontinuity=(
                        row["interplanetary_discontinuity"].lower() == "true"
                    ),
                )
            )
    return events

