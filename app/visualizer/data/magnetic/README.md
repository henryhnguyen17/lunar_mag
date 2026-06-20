# Magnetic Data Inputs

`lp_kaguya_clusters_demo.json` is a visualization-ready schema for magnetic anomaly clusters. It is seeded with well-known lunar magnetic anomaly regions, but it is **not yet a calibrated mission data product**.

The intended real-data path is:

1. Download Lunar Prospector MAG/ER and Kaguya/SELENE LMAG products or a published gridded lunar crustal magnetic field model derived from them.
2. Convert the map into this app's magnetic schema: cluster summaries, vector samples, or gridded `B_r/B_theta/B_phi` values.
3. Replace this demo file with a calibrated product and keep the `source_note` explicit.

The visualizer already treats this file as an external data layer so the rendered magnetic vectors/field lines can be replaced without changing orbit playback.
