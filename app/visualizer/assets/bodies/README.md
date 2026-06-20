# Visualizer Bodies

NASA Eyes reference: https://science.nasa.gov/eyes/
NASA 3D Resources: https://science.nasa.gov/3d-resources/

Use NASA Eyes as the visual benchmark for how astronomical bodies and spacecraft should feel in the app: real-time 3D, selectable bodies, clear playback controls, and data overlays.

Use NASA 3D Resources as the preferred source for actual body and spacecraft model/texture assets. NASA describes that hub as containing free-to-download/use 3D models, 3D printable models, and textures, with NASA Images and Media Usage Guidelines applying.

Each astronomical centerpiece gets its own folder:

```text
app/visualizer/assets/bodies/
  moon/
    body.json
    textures/
    models/
    sources.md
```

`body.json` defines display metadata such as radius, map bounds, and default color. Future bodies can use the same structure:

```text
app/visualizer/assets/bodies/mars/body.json
app/visualizer/assets/bodies/earth/body.json
app/visualizer/assets/bodies/asteroid_eros/body.json
```

The visualizer reads body metadata from the orbit payload first. Later it can load richer texture/model assets from these folders.
