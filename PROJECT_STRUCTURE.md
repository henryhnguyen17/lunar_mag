# Project Structure

```text
app/
  visualizer/              Browser app for playback and later 3D/magnetic views
    assets/
      bodies/              Center-body configs, textures, and models
      references/          Visual/design references such as NASA Eyes notes
    data/                  App-ready JSON artifacts

data/
  synthetic/
    nasa42/
      state_logs/          NASA 42-style state logs and generated fixtures

external/
  42/                      NASA 42 git submodule

reports/                   Integration notes and experiment reports
scripts/                   Data generation and conversion scripts
src/lunar_mag/             Python package for loaders, geometry, scoring, exports
tests/                     Pytest suite
```

The app should consume exported artifacts from `app/visualizer/data/` and should not duplicate simulation or localization logic. Python scripts convert simulator outputs and generated data into app-ready files.

