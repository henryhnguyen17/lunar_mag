# Lunar Magnetic Map-Matching Navigation Plan

## Project Goal

Build a lunar orbiter navigation-aid simulator that uses **NASA 42** for spacecraft dynamics and a custom Python layer for lunar magnetic anomaly sensing and map matching.

The project tests whether a low lunar orbiter can reduce position uncertainty by comparing a sequence of magnetometer readings against a known lunar magnetic anomaly map.

This is not meant to replace normal navigation. It is a supplemental navigation method that could help when an orbiter passes over distinctive lunar crustal magnetic anomalies.

## Core Question

Can magnetic anomaly sequence matching improve localization for a low lunar orbiter with an already approximate orbit estimate?

Supporting questions:

- How much does position error improve after magnetic map matching?
- Which lunar regions produce useful magnetic fingerprints?
- How sensitive is the method to altitude, magnetometer noise, sensor bias, and map resolution?
- How much better is sequence matching than using a single magnetic-field reading?

## High-Level Architecture

```text
NASA 42
  -> spacecraft time, position, velocity, attitude

Python magnetic sensor layer
  -> read NASA 42 state logs
  -> sample lunar magnetic anomaly map
  -> simulate magnetometer readings
  -> add noise and bias

Python map-matching layer
  -> generate candidate orbit offsets
  -> compare measured vs predicted magnetic sequences
  -> estimate best position correction
  -> report localization improvement
```

NASA 42 handles spacecraft dynamics. Our code handles magnetic maps, magnetometer simulation, and localization.

## Why NASA 42

NASA 42 is a spacecraft dynamics simulator written mainly in C. It can model spacecraft orbit and attitude dynamics and output time-stepped state information.

Using 42 lets us avoid building an orbital dynamics simulator from scratch. We only need to add the magnetic navigation experiment around its outputs.

42 provides:

- spacecraft position over time
- spacecraft velocity over time
- attitude/frame information where available
- configurable spacecraft dynamics cases

Our Python code provides:

- lunar magnetic anomaly map loading or generation
- magnetic-field interpolation at spacecraft location
- synthetic magnetometer measurements
- noise and bias models
- map-matching localization
- performance evaluation

## Scientific Basis

Earth has analogs for this idea:

- Compasses use magnetic direction for heading.
- Aircraft, drones, and submarines can use magnetic anomaly maps as GPS-denied navigation aids.
- Satellites often use magnetometers for attitude determination, though Earth orbit has stronger navigation infrastructure.

The Moon is different:

- It has no strong present-day global dipole field.
- It has localized crustal magnetic anomalies.
- There is no deployed lunar GPS-like system.
- Lunar Prospector and Kaguya measured magnetic fields from orbital altitudes relevant to low lunar orbiters.

The idea is to use anomaly patterns as a map fingerprint.

## Key Principle

A single magnetic reading is usually ambiguous:

```text
|B| = 4.2 nT
```

Many lunar locations could have the same magnetic magnitude.

A sequence is more useful:

```text
3.1 nT -> 3.8 nT -> 6.2 nT -> 5.0 nT -> 2.9 nT
```

That shape may identify a specific path over a distinctive anomaly region.

## Data Sources

| Dataset | Project Role |
| --- | --- |
| Lunar Prospector MAG/ER | Primary source for lunar crustal magnetic anomaly context. |
| Kaguya/SELENE LMAG | Independent magnetic-field data for validation or alternate map products. |
| Published lunar crustal magnetic-field models | Best first real map input if gridded products are easier than raw mission data. |
| Apollo surface magnetometers | Local surface constraints, not global orbital navigation maps. |
| LRO LOLA topography | Optional later context for terrain/elevation, not needed for the first build. |

Source portals:

- NASA PDS Planetary Plasma Interactions node: https://pds-ppi.igpp.ucla.edu/
- NASA PDS ODE Moon portal: https://ode.rsl.wustl.edu/moon/
- JAXA DARTS SELENE/Kaguya archive: https://darts.isas.jaxa.jp/planet/pdap/selene/
- NASA NSSDCA: https://nssdc.gsfc.nasa.gov/

## Altitude Scope

Start with orbital altitudes close to existing magnetic datasets:

- Lunar Prospector primary mission: about `100 km`.
- Lunar Prospector lower phases: tens of kilometers.
- Kaguya/SELENE LMAG: commonly about `100 km`, with lower phases depending on mission period.
- Published magnetic maps may use reference altitudes such as `30 km` or `100 km`.

The first simulator should avoid surface-field extrapolation. It should evaluate magnetic matching at or near the map product's stated reference altitude.

## Data Model

### NASA 42 State Record

- `timestamp_utc`
- `position_x_km`
- `position_y_km`
- `position_z_km`
- `velocity_x_km_s`
- `velocity_y_km_s`
- `velocity_z_km_s`
- `attitude_q0`
- `attitude_q1`
- `attitude_q2`
- `attitude_q3`
- `source_simulator`

### Orbit Sample Record

- `timestamp_utc`
- `latitude_deg`
- `longitude_deg`
- `altitude_km`
- `velocity_km_s`
- `orbit_id`

### Magnetic Map Record

- `latitude_deg`
- `longitude_deg`
- `altitude_km`
- `b_x_nt`
- `b_y_nt`
- `b_z_nt`
- `b_total_nt`
- `source_id`
- `reference_frame`

### Magnetometer Sample Record

- `timestamp_utc`
- `latitude_deg`
- `longitude_deg`
- `altitude_km`
- `b_x_nt`
- `b_y_nt`
- `b_z_nt`
- `b_total_nt`
- `sensor_noise_nt`
- `sensor_bias_nt`

### Localization Result Record

- `window_id`
- `prior_error_km`
- `posterior_error_km`
- `error_reduction_km`
- `error_reduction_percent`
- `match_score`
- `window_duration_s`
- `altitude_km`
- `region_label`

## Map-Matching Method

Start with a simple deterministic method.

1. Use NASA 42 to generate the true spacecraft trajectory.
2. Sample the magnetic map along that trajectory.
3. Add simulated magnetometer noise and bias.
4. Create an uncertain prior trajectory by offsetting the true trajectory.
5. Generate candidate trajectories near the prior.
6. Sample the magnetic map along each candidate trajectory.
7. Compare measured and predicted magnetic sequences.
8. Pick the candidate with the lowest mismatch.
9. Compare prior position error against posterior position error.

Initial scoring method:

```text
RMSE = sqrt(mean((B_measured - B_predicted)^2))
```

Start with `b_total_nt`. Later, test vector matching with `b_x_nt`, `b_y_nt`, and `b_z_nt`.

## Validation Strategy

The project should measure navigation value, not just generate plots.

Primary metrics:

- prior position error in kilometers
- posterior position error in kilometers
- error reduction in kilometers
- error reduction percent
- false-match rate
- failure rate
- sensitivity to noise, bias, altitude, map resolution, and window length

Validation cases:

- strong anomaly region
- weak-field negative-control region
- high-gradient orbit segment
- low-gradient orbit segment
- single-reading matching
- sequence matching

Expected result:

Magnetic matching should help only in regions with distinctive magnetic gradients. It should fail or provide little value in weak, smooth, or repetitive magnetic regions.

## Implementation Milestones

### Milestone 1: Reorient Codebase

- Rename or refactor existing event-detector code as needed.
- Add schemas for NASA 42 state records, magnetic maps, orbit samples, magnetometer samples, and localization results.
- Add math utilities for distance, coordinate conversion, interpolation, and RMSE.
- Add tests for the new utilities.

### Milestone 2: NASA 42 Trajectory Export

- Install or link NASA 42 outside this Python package.
- Configure a simple low lunar orbit case.
- Export a state log with time, position, velocity, and attitude.
- Write a Python loader for the 42 state log.
- Convert 42 Cartesian states to latitude, longitude, altitude, and speed.

### Milestone 3: Synthetic Magnetic Map

- Generate a 2D lunar magnetic anomaly map with localized Gaussian anomaly clusters.
- Support map queries by latitude and longitude.
- Add bilinear interpolation.
- Export the synthetic map for repeatable tests.
- Add tests for known interpolation cases.

### Milestone 4: Magnetometer Simulator

- Sample the synthetic magnetic map along the NASA 42 trajectory.
- Generate simulated magnetometer readings.
- Add configurable noise and bias.
- Export simulated measurement sequences.

### Milestone 5: Map-Matching Localizer

- Generate candidate orbit offsets around an uncertain prior trajectory.
- Compare predicted magnetic sequences against measured sequences.
- Estimate the best position correction.
- Report prior error, posterior error, and match score.

### Milestone 6: Performance Experiments

- Sweep altitude, noise, bias, map resolution, and sequence length.
- Compare single-reading matching against sequence matching.
- Identify where magnetic navigation helps and where it fails.
- Produce a performance report.

### Milestone 7: Real Magnetic Map Ingestion

- Load a Lunar Prospector-derived or published lunar crustal magnetic-field model.
- Normalize coordinates, units, altitude metadata, and reference frame.
- Replace the synthetic map with the real map.
- Re-run localization experiments over real anomaly regions.

### Milestone 8: Cross-Mission Validation

- Use Kaguya LMAG or held-out Lunar Prospector tracks as measurement sequences where feasible.
- Compare those measurements against the reference map.
- Document performance, limitations, and failure cases.

## Expected Outputs

- `data/synthetic/42_state_logs/`
- `data/synthetic/magnetic_map.parquet`
- `data/synthetic/orbit_tracks_from_42.parquet`
- `data/synthetic/magnetometer_sequences.parquet`
- `data/processed/localization_results.parquet`
- `reports/42_integration_notes.md`
- `reports/navigation_performance.md`
- `reports/real_map_ingestion_notes.md`
- `figures/magnetic_map.png`
- `figures/localization_error_reduction.png`

## Risks And Constraints

- Magnetic map matching will not work everywhere.
- Weak or smooth magnetic regions may be ambiguous.
- A single reading is usually not enough for position estimation.
- Sensor bias can hide or distort magnetic fingerprints.
- Attitude uncertainty can degrade vector-field matching.
- NASA 42 coordinate frames must be handled carefully.
- Real magnetic map products may use different altitudes, reference frames, and processing assumptions.
- Upward or downward continuation between map altitudes can introduce uncertainty.

## Recommended First Build

Build a NASA 42 plus synthetic magnetic map proof of concept.

1. Configure a simple low lunar orbit in NASA 42.
2. Export a time-position-velocity state log.
3. Generate a synthetic lunar magnetic anomaly map.
4. Sample the synthetic map along the 42 trajectory.
5. Add magnetometer noise and bias.
6. Offset the trajectory to create an uncertain prior.
7. Use sequence matching to recover the best orbit segment.
8. Report whether posterior error is lower than prior error.

This proves the navigation-aid concept before introducing real lunar magnetic datasets.
