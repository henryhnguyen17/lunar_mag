# NASA 42 Integration Notes

## Purpose

NASA 42 is the planned spacecraft dynamics source for this project. The Python package does not embed 42. Instead, it reads exported 42 state logs and builds the lunar magnetic navigation experiment around those states.

## Expected State Log Columns

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

## Current Assumption

The loader assumes position is already Moon-centered and in a Moon-fixed frame before converting to selenographic latitude, longitude, and altitude. If 42 exports inertial states, we will need a frame transformation step before map sampling.

## Sample File

`data/synthetic/nasa42/state_logs/sample_lunar_orbit_state.csv` is a small fixture for validating the parser and coordinate conversion path.
