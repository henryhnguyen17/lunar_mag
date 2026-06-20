# Lunar Magnetic Compression Event Detector Plan

## Goal

Build and validate an automated detector for short magnetic-field compression events around the Moon. The system should ingest lunar orbiter magnetometer time series, identify sub-10-second magnetic enhancements, classify likely event type, and evaluate results against synthetic truth and published benchmark events.

The project is based on Nakagawa et al. 2023, which reported sub-10-second magnetic enhancements measured by Kaguya/MAP-LMAG at roughly 100 km altitude. The end goal is a reproducible science pipeline that can search Kaguya-style data for more events and test whether those events are linked to lunar geometry, upstream solar-wind discontinuities, or crustal magnetic anomaly context.

## Core Research Question

Can short lunar magnetic compression events be detected automatically in lunar orbiter magnetometer data, and can they be classified using local magnetic signatures plus solar-wind and crustal-field context?

Secondary research question:

How much does event classification improve when local magnetometer features are combined with upstream ACE/WIND/OMNI solar-wind context and Lunar Prospector crustal magnetic anomaly context?

## Physical Context

The Moon has no strong present-day global dipole field, but it does have localized crustal magnetic anomalies. Solar wind interaction with the lunar surface and crustal fields can create magnetic perturbations near the Moon.

Nakagawa et al. 2023 found short-period magnetic enhancements with these key properties:

- Spacecraft: Kaguya/SELENE.
- Instrument: MAP-LMAG magnetometer.
- Altitude: about `90-110 km`.
- Sampling: `32 Hz` magnetic-field vectors.
- Duration: less than `10 s`.
- Approximate spatial scale: about `10-15 km` along the orbit.
- Enhancement ratio: roughly `1.5x-3.6x` over the preceding quiet field.
- Candidate event classes:
  - `limb_compression`
  - `discontinuity_compression`

The paper distinguishes two mechanisms:

- Limb compressions near the lunar terminator during relatively steady solar-wind magnetic field conditions.
- Hot-flow-anomaly-like compressions associated with interplanetary tangential discontinuities, sometimes detected on the nightside.

## Dataset Roles

| Dataset | Role In This Project | Notes |
| --- | --- | --- |
| Kaguya/SELENE MAP-LMAG | Primary high-rate magnetometer data for detecting short events. | Best match to Nakagawa et al. because events were found in Kaguya LMAG data. |
| Kaguya MAP-PACE | Local plasma context where available. | Useful for checking reflected ions and solar-wind conditions near the spacecraft. |
| ACE MAG/SWEPAM | Upstream solar-wind magnetic field and plasma context. | Used by the paper for solar-wind comparisons. |
| WIND MFI/SWE | Backup or complementary upstream solar-wind context. | Useful when ACE data are unavailable. |
| NASA OMNIWeb | Time-shifted solar-wind context near Earth/Moon. | Useful for standardized upstream context and discontinuity flags. |
| Lunar Prospector MAG/ER | Background crustal magnetic anomaly context. | Use to identify strong crustal anomaly regions, not as the primary short-event detector. |
| Published lunar crustal field models | Static magnetic anomaly prior. | Useful for asking whether events occur near known anomaly-connected regions. |

Initial source portals:

- NASA PDS Planetary Plasma Interactions node: https://pds-ppi.igpp.ucla.edu/
- NASA PDS Geosciences Orbital Data Explorer Moon portal: https://ode.rsl.wustl.edu/moon/
- JAXA DARTS SELENE/Kaguya archive: https://darts.isas.jaxa.jp/planet/pdap/selene/
- NASA OMNIWeb: https://omniweb.gsfc.nasa.gov/
- ACE Science Center: http://www.srl.caltech.edu/ACE/ASC/

## Project Architecture

```text
Kaguya LMAG / synthetic magnetometer time series
  -> preprocessing
  -> short enhancement detector
  -> event feature extraction
  -> event classification
  -> verification reports

Lunar Prospector / crustal field map
  -> anomaly context features

ACE / WIND / OMNI solar-wind data
  -> upstream discontinuity context

```

## Data Model

Use one common time-series record for magnetic data:

- `timestamp_utc`
- `spacecraft`
- `latitude_deg`
- `longitude_deg`
- `altitude_km`
- `x_sse_km`
- `y_sse_km`
- `z_sse_km`
- `b_x_nt`
- `b_y_nt`
- `b_z_nt`
- `b_total_nt`
- `sample_rate_hz`
- `source_id`

Use one event record for detections:

- `event_id`
- `start_time_utc`
- `peak_time_utc`
- `end_time_utc`
- `duration_s`
- `altitude_km`
- `b_pre_nt`
- `b_peak_nt`
- `enhancement_ratio`
- `delta_direction_deg`
- `estimated_scale_km`
- `terminator_distance_km`
- `dayside_nightside`
- `upstream_discontinuity_flag`
- `near_crustal_anomaly_flag`
- `predicted_class`
- `confidence`

## Event Detection Method

Start with deterministic signal processing before trying machine learning.

1. Load magnetic-field vector time series.
2. Compute `|B|` from vector components.
3. Estimate a rolling quiet baseline before each candidate window.
4. Detect candidate enhancements where:
   - `duration_s < 10`
   - `delta_B_nt > threshold`
   - `B_peak / B_pre > ratio_threshold`
   - the preceding window is relatively quiet
5. Reject candidates embedded inside larger magnetic disturbances unless explicitly running a permissive search.
6. Estimate event properties:
   - start, peak, end
   - duration
   - amplitude ratio
   - direction change
   - orbit-distance scale
7. Save detections to an event catalog.

Initial thresholds should reproduce the paper's visual search criteria:

- Short period: `<10 s`.
- Magnetic enhancement: `delta |B| > 1.9 nT`.
- Preceded by a magnetically quiet period.

## Event Classification

Begin with a rules-based classifier:

| Class | Main Evidence |
| --- | --- |
| `limb_compression` | Short enhancement, near terminator, steady upstream solar-wind field, magnetic field flares away from Moon if vector geometry supports it. |
| `discontinuity_compression` | Short enhancement near an upstream interplanetary magnetic discontinuity, especially tangential discontinuity candidates. |
| `crustal_anomaly_crossing` | Enhancement aligns with strong static crustal anomaly and lacks transient upstream context. |
| `solar_wind_noise` | Similar fluctuation appears upstream or lacks lunar geometry consistency. |
| `unknown` | Detection passes signal criteria but lacks enough context for classification. |

After the rules baseline works, train a small classifier only if there are enough labeled or synthetic examples.

Potential features:

- `duration_s`
- `delta_B_nt`
- `enhancement_ratio`
- `delta_direction_deg`
- rolling pre-event variance
- local-time geometry
- dayside/nightside flag
- distance to terminator
- upstream magnetic discontinuity score
- distance to strong crustal anomaly region
- altitude

## Synthetic Data Generator

Build a generator before using real Kaguya data so the detector has known truth labels.

The generator should create:

- Kaguya-like orbit samples at roughly `100 km` altitude.
- Quiet solar-wind magnetic background.
- Instrument noise and slow baseline drift.
- Larger low-frequency magnetic disturbances.
- Injected short enhancements with Nakagawa-like durations and amplitudes.
- Optional upstream discontinuity events.
- Optional crustal anomaly crossings.

The generator should support event classes:

- `limb_compression`
- `discontinuity_compression`
- `crustal_anomaly_crossing`
- `solar_wind_noise`

## Nakagawa Benchmark Events

Encode the six published events as benchmark targets:

| Event | Date/Time UTC | Duration s | B Peak nT | B Pre nT | Altitude km | Discontinuity |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | 2008-01-01 13:29:20.0442 | 6.969 | 4.9 | 3.0 | 108 | no |
| 2 | 2008-03-10 09:26:45.0810 | 2.250 | 6.6 | 4.5 | 91 | no |
| 3 | 2008-06-08 05:43:06.0615 | 9.969 | 8.5 | 3.7 | 92 | yes |
| 4 | 2008-08-05 03:28:35.3177 | 9.281 | 3.4 | 0.9 | 90 | yes |
| 5 | 2008-11-27 04:26:28.0460 | 3.469 | 6.0 | 3.3 | 110 | yes |
| 6 | 2008-12-21 23:50:28.0383 | 9.969 | 5.8 | 3.6 | 101 | yes |

Use these events in two ways:

- Synthetic reproduction: inject events with matching duration, amplitude, altitude, and class label.
- Real-data validation: when Kaguya LMAG data are loaded, check whether the detector recovers these timestamps.

## Verification Plan

Verification should happen in layers.

1. Synthetic truth tests:
   - Inject known events.
   - Measure precision, recall, F1, timing error, duration error, and amplitude-ratio error.
2. Paper reproduction tests:
   - Confirm the detector finds the six Nakagawa benchmark events in synthetic data.
   - Later confirm it finds them in real Kaguya LMAG intervals.
3. Negative controls:
   - Run on quiet intervals before and after events.
   - Require low false positive rate.
4. Ablation tests:
   - Classify with magnetometer-only features.
   - Classify again with upstream ACE/WIND/OMNI context.
   - Report how much solar-wind context improves classification.
5. Physical sanity checks:
   - Duration should be less than `10 s`.
   - Spatial scale should be about `10-15 km` for Kaguya-like orbital speed.
   - Limb-compression candidates should be near the terminator.
   - Discontinuity-compression candidates should align with upstream magnetic discontinuities.
   - Events that also appear in upstream data should not be labeled as lunar-generated without caution.

## Implementation Milestones

### Milestone 1: Project Skeleton

- Create Python package layout.
- Add data schemas for time-series samples and event detections.
- Encode the six Nakagawa benchmark events.
- Add a small test suite for event feature calculations.

### Milestone 2: Synthetic Generator

- Generate Kaguya-like magnetometer time series.
- Inject benchmark-like events.
- Export synthetic datasets and truth labels.
- Plot event-centered magnetic-field windows for debugging.

### Milestone 3: Detector

- Implement rolling-baseline enhancement detection.
- Estimate event start, peak, end, duration, amplitude, and scale.
- Evaluate synthetic precision and recall.

### Milestone 4: Classifier

- Add rule-based classification.
- Add geometry features: terminator proximity, dayside/nightside, altitude.
- Add optional upstream discontinuity context.
- Run ablation tests with and without solar-wind context.

### Milestone 5: Real Data Validation

- Load Kaguya LMAG data for the six benchmark intervals.
- Load upstream ACE/WIND/OMNI context for the same intervals.
- Run the detector on real intervals.
- Compare recovered events to Nakagawa et al. timing and parameters.

### Milestone 6: Crustal Anomaly Context

- Load Lunar Prospector MAG/ER or a published crustal magnetic-field map.
- Add features for distance to strong anomaly regions.
- Test whether detected events cluster near known crustal anomaly contexts.

### Milestone 7: Broader Event Search

- Run the detector across longer Kaguya LMAG intervals.
- Build a candidate event catalog beyond the six published benchmark events.
- Summarize occurrence patterns by lunar geometry, solar-wind context, and crustal anomaly proximity.

## Outputs

- `data/benchmarks/nakagawa_2023_events.csv`
- `data/synthetic/*.parquet`
- `data/processed/event_catalog.parquet`
- `reports/synthetic_detection_metrics.md`
- `reports/nakagawa_reproduction_report.md`
- `reports/event_occurrence_summary.md`
- `figures/event_windows/*.png`

## Risks And Constraints

- Real Kaguya LMAG data access and format conversion may take time.
- Upstream solar-wind propagation from ACE/WIND to the Moon introduces timing uncertainty.
- Six published events are useful benchmarks but too few for a robust machine-learning classifier.
- Visual-inspection criteria from the paper may not map perfectly to an automated detector.
- Lunar Prospector is valuable for crustal-field context, but Kaguya LMAG is the better source for sub-10-second event detection.
- Automated detection may find many ambiguous candidates that require careful physical filtering.

## Recommended First Build

Start by implementing the synthetic benchmark system:

1. Encode the six Nakagawa events.
2. Generate 32 Hz Kaguya-like magnetometer windows around each event.
3. Inject short magnetic enhancements with matching amplitude and duration.
4. Build the first rolling-baseline detector.
5. Report whether the detector recovers all six synthetic benchmark events with low timing, duration, and amplitude error.

This creates a testable event-detection foundation before dealing with real archive formats.
