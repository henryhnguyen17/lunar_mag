# Lunar Magnetic Orbiter Simulator Plan

## Project Goal

Build an interactive lunar-orbiter simulator that visualizes orbit playback, lunar magnetic anomaly clusters, and simulated magnetometer readings. The long-term research goal is to test whether magnetic anomaly sequence matching can act as a supplemental navigation aid for a low lunar orbiter.

This is not meant to replace normal orbit determination. The useful question is narrower:

> Can a lunar orbiter reduce position uncertainty when it flies over distinctive crustal magnetic anomaly regions?

## Current Direction

The project has shifted from a backend-first prototype into an **app-first simulator**:

- The visualizer is a main deliverable, not just a debug plot.
- The first user workflow starts in an **Orbit Generation** tab.
- The app can generate a Lunar Prospector-like lunar orbit in the browser.
- The app plays back the orbit across synchronized tabs.
- The app visualizes magnetic clusters, magnetic vectors, and field-line-style structures.
- NASA 42 remains the intended external dynamics source, but the current browser generator is a useful stand-in until a real 42 case is wired in.

## Current Status

### Implemented

- `app/visualizer/index.html`
  - Tabbed browser app.
  - Orbit Generation tab.
  - Playback tab.
  - 3D Orbit tab.
  - Ground Track map tab.
  - Magnetic Map tab.
  - Plots tab.

- `app/visualizer/app.js`
  - Browser-side Lunar Prospector-like orbit generator.
  - Playback, pause, reset, speed, and timeline scrubber.
  - Smooth playback with `requestAnimationFrame`.
  - Interpolated current spacecraft state.
  - Adjustable 3D view via mouse/trackpad dragging.
  - Lunar rotation-axis and equator reference indicators.
  - Magnetic cluster layer loading.
  - Simulated magnetic vector sampling.
  - 3D magnetic field-line-style loops.
  - Magnetic vector and magnitude plots.

- `app/visualizer/data/magnetic/lp_kaguya_clusters_demo.json`
  - Demo magnetic cluster data layer.
  - Seeded with known lunar magnetic anomaly regions.
  - Uses a schema designed to be replaced by calibrated Lunar Prospector/Kaguya-derived data.

- `scripts/generate_sample_orbit.py`
  - Generates a NASA 42-compatible state-log fixture.
  - Defaults to a Lunar Prospector-like nominal polar mapping orbit.

- `src/lunar_mag/`
  - NASA 42-style state-log loader.
  - Body config loader.
  - Geometry utilities.
  - Magnetic magnitude utility.
  - Interpolation and scoring utilities.
  - Visualizer JSON export.

- Tests
  - `python3 -m pytest` currently passes.

## Important Caveat

The current magnetic layer is **not yet calibrated mission data**.

It is a visualization-ready demo layer that is structured so it can later be replaced by:

- Lunar Prospector MAG/ER data.
- Kaguya/SELENE LMAG data.
- A published gridded lunar crustal magnetic-field model derived from those missions.

Until real ingestion is done, magnetic values should be treated as simulated/demo values, not scientific measurements.

## Architecture

```text
Orbit source
  -> browser Keplerian generator now
  -> NASA 42 state logs later

Orbit samples
  -> timestamp
  -> latitude, longitude, altitude
  -> speed

Magnetic layer
  -> demo cluster schema now
  -> LP/Kaguya gridded magnetic product later

Magnetometer model
  -> sample magnetic vector at spacecraft location
  -> show R/N/E vector and |B|
  -> later add noise, bias, and sensor-frame transforms

Visualizer app
  -> Orbit Generation
  -> Playback
  -> 3D Orbit
  -> Ground Track
  -> Magnetic Map
  -> Plots

Future navigation layer
  -> candidate trajectory generation
  -> magnetic sequence matching
  -> localization correction estimate
  -> validation metrics
```

## Current App Workflow

1. Open the visualizer.
2. Start on **Orbit Generation**.
3. Adjust orbit sliders:
   - perilune altitude
   - apolune altitude
   - inclination
   - RAAN
   - argument of perilune
   - mean anomaly
   - duration
   - time step
4. Press **Generate Orbit**.
5. The app switches to **Playback**.
6. Inspect:
   - spacecraft state
   - magnetic vector
   - nearest magnetic cluster
7. Use the other tabs:
   - **3D Orbit:** draggable Moon-centered view with magnetic field-line-style clusters.
   - **Map:** ground track with cluster overlay.
   - **Magnetic Map:** cluster map and current magnetic vector.
   - **Plots:** altitude, speed, and magnetic-field time series.

## Data Sources

| Dataset | Role |
| --- | --- |
| Lunar Prospector MAG/ER | Primary mission source for lunar crustal magnetic anomalies. |
| Kaguya/SELENE LMAG | Independent magnetic-field data for validation or alternate map products. |
| Published lunar crustal magnetic-field models | Best near-term real map input if already gridded and altitude-normalized. |
| NASA 42 | Intended high-fidelity orbit/attitude dynamics source. |
| LRO LOLA | Optional future terrain/topography context. |

Useful portals:

- NASA PDS Planetary Plasma Interactions Node: https://pds-ppi.igpp.ucla.edu/
- NASA PDS ODE Moon portal: https://ode.rsl.wustl.edu/moon/
- JAXA DARTS SELENE/Kaguya archive: https://darts.isas.jaxa.jp/planet/pdap/selene/
- NASA NSSDCA: https://nssdc.gsfc.nasa.gov/

## Orbit Model

### Current

The app currently uses a browser-side two-body Keplerian lunar orbit generator. Defaults are Lunar Prospector-like:

- near-circular low lunar orbit
- roughly 100 km altitude
- near-polar inclination

This is good enough for app development and magnetic visualization.

### Next

Replace or supplement the browser generator with actual NASA 42 output:

```text
NASA 42 run
  -> state/history log
  -> Python parser
  -> visualizer orbit JSON
  -> app playback
```

The browser generator should remain as a fast scenario tool, but real validation should use NASA 42 or real mission trajectories.

## Magnetic Model

### Current Demo Model

The current magnetic layer treats each anomaly cluster as a Gaussian-like localized source:

```text
B_cluster ~= strength_nt * exp(-distance_deg^2 / (2 * sigma_deg^2))
```

The app derives a simple local vector:

- radial component from signed anomaly strength
- north/east components from the local gradient
- altitude falloff from reference altitude

This is visually useful and good for prototype behavior, but it is not yet a physically rigorous crustal-field model.

### Future Real Model

Real ingestion should support one or both of:

- gridded field components at reference altitude:
  - `B_r`
  - `B_theta` or north/south equivalent
  - `B_phi` or east/west equivalent
  - `|B|`
- cluster summaries extracted from a gridded product:
  - location
  - strength
  - spatial scale
  - polarity
  - source dataset
  - reference altitude

## Data Schemas

### Orbit Sample

- `timestamp_utc`
- `latitude_deg`
- `longitude_deg`
- `altitude_km`
- `velocity_km_s`
- `orbit_id`

### Magnetic Cluster

- `id`
- `name`
- `latitude_deg`
- `longitude_deg`
- `strength_nt`
- `sigma_deg`
- `polarity`
- `source_hint`

### Future Magnetic Grid Cell

- `latitude_deg`
- `longitude_deg`
- `altitude_km`
- `b_radial_nt`
- `b_north_nt`
- `b_east_nt`
- `b_total_nt`
- `source_id`
- `reference_frame`
- `processing_notes`

### Future Magnetometer Sample

- `timestamp_utc`
- `latitude_deg`
- `longitude_deg`
- `altitude_km`
- `b_radial_nt`
- `b_north_nt`
- `b_east_nt`
- `b_total_nt`
- `sensor_noise_nt`
- `sensor_bias_nt`
- `source_map_id`

### Future Localization Result

- `window_id`
- `prior_error_km`
- `posterior_error_km`
- `error_reduction_km`
- `error_reduction_percent`
- `match_score`
- `window_duration_s`
- `altitude_km`
- `region_label`

## Navigation Concept

A single magnetic reading is usually ambiguous:

```text
|B| = 4.2 nT
```

Many lunar locations can have similar field strength.

A sequence is more useful:

```text
3.1 nT -> 3.8 nT -> 6.2 nT -> 5.0 nT -> 2.9 nT
```

The intended localization method:

1. Start with an approximate orbit estimate.
2. Sample the magnetic map along the estimated path.
3. Compare the measured sequence against candidate paths nearby.
4. Pick the candidate path with the lowest mismatch.
5. Report whether position uncertainty improved.

Initial score:

```text
RMSE = sqrt(mean((B_measured - B_predicted)^2))
```

Start with `|B|`; later test vector matching with radial/north/east components.

## Updated Milestones

### Milestone 1: App Foundation

Status: **Mostly complete**

Completed:

- Tabbed visualizer.
- Playback controls.
- Smooth animation.
- Timeline scrubber.
- Orbit Generation tab.
- Ground-track map.
- Plots tab.
- 3D orbit view.
- Draggable 3D view.
- Moon rotation-axis/equator reference.

Remaining:

- Improve visual polish.
- Add optional export/download of generated orbit JSON.
- Decide whether to keep SVG 3D or migrate to Three.js.

### Milestone 2: Orbit Source Integration

Status: **Partially complete**

Completed:

- NASA 42-compatible CSV fixture.
- Python parser for NASA 42-style state logs.
- Lunar Prospector-like generated baseline.

Remaining:

- Run an actual NASA 42 lunar orbit case.
- Export real 42 state/history logs.
- Feed those logs into the existing parser.
- Add UI selector for generated orbit vs NASA 42 orbit file.

### Milestone 3: Magnetic Visualization

Status: **Prototype complete**

Completed:

- Magnetic cluster JSON schema.
- Demo LP/Kaguya-style cluster layer.
- Magnetic stats in Playback.
- Magnetic Map tab.
- Magnetic cluster overlays on map.
- 3D field-line-style cluster rendering.
- Magnetic magnitude and vector-component plots.

Remaining:

- Add toggles:
  - show/hide clusters
  - show/hide 3D field lines
  - show/hide vector arrows
  - select magnitude vs component plots
- Add clearer legend and scale bar.
- Add cluster hover/click details.

### Milestone 4: Real LP/Kaguya Data Ingestion

Status: **Not started**

Tasks:

- Locate practical Lunar Prospector MAG/ER and Kaguya LMAG products.
- Prefer a published gridded crustal-field model if available.
- Document:
  - coordinate frame
  - altitude/reference radius
  - units
  - filtering/processing assumptions
  - data gaps
- Convert to app schema.
- Replace or supplement `lp_kaguya_clusters_demo.json`.
- Keep demo/synthetic layers explicitly labeled.

### Milestone 5: Magnetometer Sensor Simulation

Status: **Early prototype**

Current:

- The app computes a modeled magnetic vector at current spacecraft location.

Next:

- Add sensor noise.
- Add sensor bias.
- Add sampling cadence controls.
- Add vector-frame assumptions:
  - lunar radial/north/east
  - spacecraft body frame
  - sensor frame
- Export magnetometer sequence files.

### Milestone 6: Magnetic Navigation Algorithm

Status: **Not started**

Tasks:

- Create an intentionally offset prior trajectory.
- Generate nearby candidate trajectories.
- Sample magnetic sequences along each candidate.
- Compare candidate sequence vs measured sequence.
- Estimate best correction.
- Show prior vs corrected path in visualizer.
- Report error reduction.

### Milestone 7: Validation Experiments

Status: **Not started**

Experiments:

- strong anomaly region
- weak-field control region
- high-gradient pass
- low-gradient pass
- single-reading matching
- sequence matching
- altitude sensitivity
- noise sensitivity
- bias sensitivity
- map-resolution sensitivity

Metrics:

- prior error
- posterior error
- error reduction
- false-match rate
- failure rate
- match-score confidence

## Expected Outputs

Current:

- `app/visualizer/`
- `app/visualizer/index.html`
- `app/visualizer/app.js`
- `app/visualizer/styles.css`
- `app/visualizer/data/sample_orbit.json`
- `app/visualizer/data/magnetic/lp_kaguya_clusters_demo.json`
- `scripts/generate_sample_orbit.py`
- `data/synthetic/nasa42/state_logs/sample_lunar_orbit_state.csv`
- `reports/42_integration_notes.md`

Future:

- `data/processed/magnetic_maps/`
- `data/processed/magnetometer_sequences/`
- `data/processed/localization_results/`
- `reports/real_map_ingestion_notes.md`
- `reports/navigation_performance.md`
- `figures/magnetic_sequence_match.png`
- `figures/localization_error_reduction.png`

## Risks And Constraints

- The current magnetic layer is a demo, not calibrated data.
- Real LP/Kaguya products may use different frames, altitudes, filters, and cadences.
- Extrapolating anomaly fields between altitudes can introduce large errors.
- Magnetic navigation will only help over distinctive gradients.
- Weak or repetitive regions may produce false matches.
- Sensor bias can distort sequence matching.
- Attitude uncertainty matters if using vector components instead of magnitude.
- NASA 42 frame conventions must be handled carefully.

## Recommended Next Steps

1. Add UI toggles and legends for magnetic clusters/field lines.
2. Add generated orbit export/download from the browser.
3. Run a real NASA 42 lunar orbit case and feed its log into the visualizer.
4. Find a practical gridded lunar magnetic-field product derived from Lunar Prospector/Kaguya.
5. Write a converter from that product into the app magnetic schema.
6. Add noise/bias controls for the magnetometer sequence.
7. Implement the first simple sequence-matching localizer.

