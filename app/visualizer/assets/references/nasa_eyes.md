# Visualizer References

## NASA Eyes

- Official page: https://science.nasa.gov/eyes/
- Use as the primary visual reference for real-time 3D solar-system body and spacecraft presentation.
- Relevant ideas:
  - selectable astronomical centerpieces
  - spacecraft shown in context around a body
  - time playback for past, present, and future states
  - clean scientific overlays instead of decorative-only visuals
  - web-based interactive 3D experience

## Asset Policy

NASA Eyes is a reference for interaction and presentation quality. For downloadable assets, use NASA 3D Resources: https://science.nasa.gov/3d-resources/

NASA 3D Resources describes itself as a repository of 3D models, 3D printable models, and textures. NASA states on that page that the assets are free to download and use, mirrored on GitHub, and subject to NASA Images and Media Usage Guidelines.

Use NASA 3D Resources as the preferred source for Moon/body/spacecraft assets. Keep attribution and source metadata in each body or spacecraft asset folder. For now, store our own body metadata under `app/visualizer/assets/bodies/` and use generated placeholder geometry until an asset is downloaded and integrated.

Current app status: the 3D Orbit tab uses generated sphere/projection geometry. It is NASA Eyes-inspired, but it does not bundle or copy NASA Eyes model assets.
