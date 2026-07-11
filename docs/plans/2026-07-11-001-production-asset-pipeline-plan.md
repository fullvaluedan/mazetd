---
title: "Production Map, Tower, and Enemy Asset Pipeline"
date: 2026-07-11
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code-and-art
---

# Production Map, Tower, and Enemy Asset Pipeline

## Problem Frame

Mazecore has attractive individual candidate images but not a verified production asset system. Current generated art is largely 1024px single-sprite output, some animation sheets are missing or unsafe, and the new 1x1/2x2/3x3/3x4 gameplay geometry is not yet represented in the active manifest or renderer. The result cannot safely be judged as a coherent game screen.

This plan makes the art system grid-authoritative. Art is generated and approved in small families, normalized into explicit gameplay rectangles, registered in the manifest, proven in composed scenes, and exercised by automated contract tests plus browser QA.

## Scope And Decisions

- The source grid is 64px per cell. Runtime continues to render at `CONFIG.CELL` (32px) logical cells.
- Level 1 remains a 12x16 board. The frame is 1 cell wide. The portal is 3x3; the crystal is 3x4; their positions are data, never baked into one map PNG.
- Walls are 1x1 red-brick maze pieces. Every live non-wall tower is 2x2. Objective pads and frame use the same 1x1 stone tile.
- The board background is a low-detail tan dirt tile. It contains no scenery, path, pad, border, or baked grid line.
- All board-facing art uses strict orthographic top-down geometry: foundations, wall courses, pads, props, and shadows align horizontally/vertically to cell edges. Isometric diamonds, diagonal base edges, and 3/4 camera rotations are rejected because they conflict with the established maze grid.
- All active art must originate from an asset manifest entry. Staging candidates are never runtime assets.
- A static image, a source file, and a production-normalized image are distinct artifacts. Only normalized files can be registered as active.
- "Animation complete" means every animated entity has an explicit named state sheet, fixed frame count, alpha-safe frames, stable pivot, and a renderer state selector. It does not mean a procedural bob is substituted for missing authored frames.
- No asset is considered complete until automated geometry/file checks, a contact-sheet inspection, a composed in-game scene, and browser smoke QA all pass.

## Asset Delivery Matrix

### A. Map Foundation And Level 1

| ID | Runtime type | Exact source bounds | State(s) | Acceptance criteria |
| --- | --- | --- | --- | --- |
| `tile-floor-dirt` | repeatable 1x1 PNG | 64x64 | static | no seam, baked grid, object, border, or directional lighting |
| `tile-stone-pad` | repeatable 1x1 PNG | 64x64 | static | repeats horizontally/vertically; remains readable below objectives |
| `objective-portal` | transparent overlay | 192x192 | idle pulse, 4 frames | alpha remains inside 3x3; no baked foundation; mouth aligns to path cell |
| `objective-crystal` | transparent overlay | 192x256 | idle pulse, 4 frames | alpha remains inside 3x4; visibly fills its pad without escaping it |
| `tower-wall-redbrick` | connected 1x1 PNG | 64x64 | static | red brick reads distinctly on dirt; no level dot; supports horizontal/vertical stacks |
| `prop-rock-*` | transparent 1x1/2x1 props | 64x64 / 128x64 | static | only authored obstacle cells; no ambiguous collision extent |
| `prop-tree-*` | transparent 1x1/2x2 props | 64x64 / 128x128 | static | perimeter/blocked-cell only; no perspective scenery over build cells |
| `level-01-layout` | JSON/data plus composition proof | 12x16 cells | static | frame, pads, objective positions, starter walls, and authored obstacle cells agree with runtime level data |

### B. Tower Family

The live roster is Wall, Arrow, Cannon, Frost, Poison, Sniper, Lightning, Support, and Gold Mine. Wall is a static connected tile; the other eight have five upgrade silhouettes, all drawn inside a continuous 2x2 foundation.

| Tower | Static images | Required animation sheets | Animation contract |
| --- | --- | --- | --- |
| Wall | 1 connected red-brick 1x1 tile | none | connected topology is renderer-owned, never stretched |
| Arrow | L1-L5 | attack 4 frames | draw, loose arrow, recoil, settle |
| Cannon | L1-L5 | attack 4 frames | wind-up, fire, recoil, smoke settle |
| Frost | L1-L5 | attack 4 frames | crystal charge, ice burst, recoil, settle |
| Poison | L1-L5 | attack 4 frames | bulb fill, spit, recoil, settle |
| Sniper | L1-L5 | attack 4 frames | aim, muzzle flash, recoil, settle |
| Lightning | L1-L5 | attack 4 frames | coil charge, strike, discharge, settle |
| Support | L1-L5 | aura loop 4 frames | banner/rune pulse that does not read as an attack |
| Gold Mine | L1-L5 | income loop 4 frames | coin/gear pulse that does not look like a projectile |

Tower source canvases are 128x128 (2x2 at 64px/cell). Each 4-frame sheet is a 2x2 atlas with 128x128 frame cells, therefore 256x256. Tier changes must alter silhouette and material hierarchy, not merely add trim. Every frame in a sheet uses the same camera, root point, foundation rectangle, and transparent padding.

### C. Enemy Family

| Enemy | Base source | Locomotion sheet | Reaction/death sheet | Required read |
| --- | --- | --- | --- | --- |
| Grunt | 64x64 | 4-frame walk | 4-frame defeat | stocky medium ground unit |
| Runner | 64x64 | 4-frame run | 4-frame defeat | small fast, yellow accent |
| Brute | 96x96 | 4-frame heavy walk | 4-frame defeat | large orange fortified unit |
| Spawnling | 48x48 | 4-frame skitter | 4-frame defeat | tiny swarm silhouette |
| Wisp | 64x64 | 4-frame hover | 4-frame dissipate | cyan flying unit |
| Mender | 64x64 | 4-frame walk | 4-frame defeat | green healer, readable support cue |
| Warden | 64x64 | 4-frame walk | 4-frame defeat | blue shield silhouette |
| Boss | 128x128 | 4-frame heavy walk | 4-frame defeat | unmistakable purple boss silhouette |

Enemy frame cells are the listed source bounds. Every state sheet is a 2x2 atlas and must be exactly twice the frame width and height. Flying movement is a hover cycle, not a ground walk. The renderer chooses `walk` while moving, `idle`/first walk frame while stopped, and `defeat` during death cleanup. Existing procedural squash may remain as secondary motion but cannot hide an absent state sheet.

## Implementation Units

### U1. Establish the manifest and validator contract

Files: `assets/manifest.json`, `tools/gen-assets.mjs`, new `tools/asset-qc.mjs`, `test/t13assets.mjs`, `test/t14asset-files.mjs`, `test/t16sprite-layout.mjs`, new `test/t19-production-assets.mjs`.

- Add a versioned object schema for tiles, props, objectives, static sprites, and state sheets: `src`, `kind`, `logical`, `footprint`, `pivot`, `frames`, `grid`, `state`, and `scaleMode` as appropriate.
- Define exactly one metadata helper for a 1x1 tile, 2x2 tower sprite, 3x3 portal, 3x4 crystal, and state atlas.
- Make `asset-qc.mjs` inspect PNG dimensions and alpha bounds without browser APIs. It must fail on missing files, wrong atlas dimensions, transparent-corner violations for tiles, full-bleed state frames, objective alpha overflow, incompatible manifest dimensions, and incomplete required state coverage.
- Preserve current assets while adding new active IDs. Never overwrite an approved asset in place; use a versioned sibling until scene approval promotes it.

Verification:

- A deliberately malformed fixture proves every geometry failure path is detected.
- `node tools/asset-qc.mjs --all` exits zero only with all active manifest items valid.
- Asset tests verify every live tower/enemy and each required state, not a sampled subset.

### U2. Promote and integrate the approved modular Level 1 map kit

Files: `assets/tiles/`, `assets/objectives/`, `assets/props/`, `assets/manifest.json`, `src/game/levels.js`, `src/game/state.js`, `src/ui/render.js`, `src/ui/sprites.js`, `docs/art/contact-sheets/level-01/`, new `test/t19-map-kit.mjs`.

- Promote only the internally and visually approved dirt tile, stone tile, portal, and corrected crystal assets from `assets/staging/map-kit/` into versioned runtime paths after the map family checkpoint.
- Render tiles by cell repetition, frame/pads from tile coordinates, and objectives as clipped transparent overlays. Remove any fallback that draws a tile path below the enemy route.
- Make portal/crystal position and footprint level data. Reserve the exact footprint in build validation; update the current 3x3 crystal reservation to 3x4.
- Add a small authored `props` field to level data. Render only props whose footprint matches an obstacle/perimeter declaration.
- Generate a deterministic contact sheet and 12x16 Level 1 composition from the active manifest. The composition is QA evidence, never a runtime bitmap.

Verification:

- 12x16 proof is 768x1024; every cell is a 64px source-cell multiple.
- Portal rectangle is exactly 192x192, crystal is exactly 192x256; sampled alpha bounds are inside those rectangles.
- Browser screenshots at 390x844 and 1440x900 show a continuous frame, non-stretched floor, clear objective pads, and no objective overlap.
- Footprint, save/load, level, render, and campaign tests are green after the objective footprint update.

### U3. Re-author and integrate the complete 2x2 tower family

Files: `assets/towers/`, `assets/sheets/`, `assets/manifest.json`, `src/ui/sprites.js`, `src/ui/render.js`, `tools/gen-assets.mjs`, `docs/art/contact-sheets/towers/`, `test/t16sprite-layout.mjs`, new `test/t19-tower-assets.mjs`.

- Generate towers by family, not isolated requests: five static 128x128 tiers plus one 256x256 action sheet for each tower role. Use a shared 2x2 stone/wood foundation silhouette but distinct role materials and silhouettes.
- Start the family with one Arrow L1 geometry proof. It must show a square 2x2 foundation with edges parallel to the canvas and a true overhead camera. Reject the whole family direction if any base reads as an isometric diamond.
- Promote the 1x1 wall only after horizontal, vertical, T-junction, and tower-adjacency scene proofs show no gaps, dots, or texture discontinuity.
- Update manifest pivots to the center of the 2x2 grid. Draw from the same full-footprint rectangle used by occupancy and selection, never independently scaled pixel art.
- Extend `sprites.js` with named state-sheet candidates, so attack/aura/income cycles can choose the proper asset without pretending every cycle is an attack.
- Add only renderer state selection needed by real gameplay: firing, aura active, and income tick. Do not create gameplay timing dependencies on art loading.

Verification:

- Contact sheet has nine coherent tower columns and five tiers for every non-wall tower.
- Each static tier has 128x128 bounds, safe alpha padding, and an invariant anchor; each sheet has 256x256 bounds and four readable non-identical frames.
- Full scene places all tower types beside walls and objective pads without cell overlap, jitter, or clipping at mobile and desktop scales.
- Tests prove a tower selected from any of its four cells renders one sprite, one radial center, one health bar, and one action cycle.

### U4. Re-author and integrate the complete enemy family and state cycles

Files: `assets/enemies/`, `assets/sheets/`, `assets/manifest.json`, `src/ui/sprites.js`, `src/ui/render.js`, `src/game/enemy.js`, `tools/gen-assets.mjs`, `docs/art/contact-sheets/enemies/`, new `test/t19-enemy-assets.mjs`.

- Generate one locked visual identity sheet per enemy before producing state sheets. Keep role colors, silhouette sizes, and top-down facing consistent across all state frames.
- Add `walk` and `defeat` sheet entries for all eight live enemies, including the Wisp hover/dissipate pair. Use the correct per-type frame geometry instead of forcing all enemy art into a 32px assumption.
- Add a minimal render-only death-state clock so a killed enemy can complete a short defeat cycle before removal. Keep logical death, bounty, pathing, and cleanup timing unchanged.
- Normalize each atlas with a shared alpha-bounds/pivot pass. Reject any sheet whose frames drift, pulse, or violate safe boundaries.

Verification:

- All eight live enemies have a static fallback, locomotion state, and defeat state in the manifest.
- Each walk cycle loops in stable position with no frame-to-frame scale jump; Wisp never receives a ground shadow.
- Screenshot/video-capture QA exercises spawning, moving, hit/death, boss scale, flyer movement, and a packed wave at mobile scale.
- Simulation and all gameplay tests pass with art enabled and with failed image loads, confirming sprites remain cosmetic.

### U5. Run family and whole-game quality gates

Files: `docs/art/asset-qc-report.md`, `docs/art/redesign-verification.md`, `test/run.mjs`, relevant active assets and tests.

- Produce contact sheets for map, towers, and enemies from runtime files, not staging sources.
- Review every family against the art bible: top-down consistency, outline/light direction, palette separation, silhouette hierarchy, transparency, seam behavior, and mobile readability.
- Run browser task QA: start L1, inspect portal/crystal corners, build/sell wall, place every tower, trigger each tower state, spawn each enemy, call early, complete a stage, and inspect the score UI.
- Treat a failed visual gate as a rejected asset, not a code workaround. Correct the source, normalize it again, re-run checks, and recompose the scene.

Verification:

- `node tools/asset-qc.mjs --all`, focused asset tests, `npm test`, and browser smoke tests all pass.
- The QC report lists each active asset, source dimensions, normalized dimensions, state coverage, alpha-bound result, contact sheet, and scene result.
- No runtime manifest entry points to `assets/staging/`.

## Sequencing And Approval Gates

1. U1 creates the contract and verifier before promotion.
2. U2 completes and approves the map kit and Level 1 composition. This is the first user checkpoint.
3. U3 completes one tower family contact sheet plus a full-board placement scene, then receives user approval before promotion.
4. U4 completes one enemy family contact sheet plus movement/death proof, then receives user approval before promotion.
5. U5 is the final composed-game gate. A family cannot be considered shipped merely because its files exist.

## Risks And Controls

- Image generators cannot reliably honor multi-frame geometry. Control: generate source sheets only, normalize to exact atlas sizes, and reject failed frames programmatically.
- A seamless-looking tile can develop seams under repetition. Control: test a 12x16 repeated composition, not one tile in isolation.
- 2x2 tower art can appear to occupy more cells than its gameplay footprint. Control: composited board with visible grid during approval and strict 128x128 source bounds.
- Large shiny objective art can hide adjacent build cells. Control: alpha-bound maximums plus screenshot review at the actual logical 32px grid scale.
- Asset loading must never affect simulation timing. Control: retain procedural fallbacks and run simulations with and without loaded sprite images.
- Existing worktree is dirty. Control: stage/commit only files changed for each completed unit; preserve unrelated work.

## Definition Of Done

- Level 1 is assembled from approved active 1x1 tiles and exact objective overlays, never a flattened generated map.
- The active manifest contains the entire live map, tower, and enemy matrix with exact dimensions and complete state coverage.
- Walls stack cleanly in all directions; every non-wall tower reads as exactly 2x2; portal and crystal stay within 3x3 and 3x4 respectively.
- Every live tower has its tier set and required action/loop sheet. Every live enemy has static, locomotion, and defeat cycles.
- All assets have passed file/geometry/alpha QC, contact-sheet review, in-game scene review, browser task QA, and the full automated suite.
