# Production Asset QC Report

## Level 1 Map Kit, 2026-07-11

| Asset | Active path | Pixel bounds | Footprint | Pixel QC | Runtime scene |
| --- | --- | --- | --- | --- | --- |
| Dirt floor | `assets/tiles/floor-dirt-v1.png` | 64x64 | 1x1 | opaque edge pixels | verified repeated on Level 1 |
| Stone pad/frame | `assets/tiles/stone-pad-v1.png` | 64x64 | 1x1 | opaque edge pixels | verified as frame and objective pad |
| Portal | `assets/objectives/portal-v1.png` | 192x192 | 3x3 | alpha inside canvas | clipped to upper-left entry pad |
| Crystal | `assets/objectives/crystal-v1.png` | 192x256 | 3x4 | alpha inside canvas | clipped to lower-right objective pad |
| Red brick wall | `assets/towers/wall-redbrick-v1.png` | 64x64 | 1x1 | opaque edge pixels | visually distinct from dirt and stone |

## Evidence

- `node tools/asset-qc.mjs --all`: `ASSET_QC_OK`
- `node test/t19-production-assets.mjs`: `PRODUCTION_ASSETS_OK`
- `node test/t19-map-kit.mjs`: `MAP_KIT_QC_OK`
- Focused Level 1 browser smoke: no console errors; portal remains within 3x3, crystal remains within 3x4, tile source is not vertically stretched.

## Outstanding Gate

- Full-suite result is recorded after the current Level 1 corner-route rebalance check. Tower and enemy production assets must not be promoted until this map gate is approved.
