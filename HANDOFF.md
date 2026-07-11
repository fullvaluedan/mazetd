# Mazecore TD Handoff

## Checkpoint

- Branch: `handoff/grid-art-pipeline-20260711`
- Scope: maze footprint conversion, modular Level 1 map kit, UI/difficulty/leaderboard work already present in the worktree, asset contracts and QC tooling.
- This checkpoint intentionally preserves staging assets and design evidence. Do not delete staging candidates until their approved replacement is live and verified.

## User Direction That Must Be Preserved

1. The game should feel like a premium original anime maze tower-defense game, taking only high-level craft cues from popular mobile strategy games. Do not copy their art, layouts, characters, or icons.
2. Maze geometry is authoritative:
   - Red brick wall: 1x1, build 1G, sell/refund 1G.
   - Every live non-wall tower: 2x2.
   - Portal: 3x3.
   - Crystal: 3x4.
3. The map is composed from atomic runtime assets, never a flattened generated board.
4. **Do not use diagonal/isometric/3/4 battlefield art.** Every foundation, wall, pad, environmental prop, and shadow must be strict orthographic top-down with edges parallel to the square grid.
5. Provide proactive progress updates. Each asset checkpoint needs: what was generated, accepted/rejected decision, exact geometry/QC evidence, composition result, and next action.
6. Do not claim a fix/art asset is complete without focused verification and regression check evidence.

## What Is Implemented And Verified

### Modular Level 1 map

Active map assets:

- `assets/tiles/floor-dirt-v1.png`: 64x64 1x1 floor tile.
- `assets/tiles/stone-pad-v1.png`: 64x64 1x1 frame/objective pad tile.
- `assets/objectives/portal-v1.png`: 192x192 transparent 3x3 overlay.
- `assets/objectives/crystal-v1.png`: 192x256 transparent 3x4 overlay.
- `assets/towers/wall-redbrick-v1.png`: 64x64 red-brick 1x1 candidate.

Relevant implementation:

- `src/game/state.js`: `objectiveRect()` is the shared 3x3 portal/3x4 crystal geometry helper used by build validation.
- `src/game/levels.js`: Level 1 entry is top-left (`2,0`), crystal exit is lower-right (`9,15`).
- `src/ui/render.js`: renders dirt/stone by runtime grid cell; clips portal/crystal to their objective rectangles; no flattened board asset.
- `tools/gen-assets.mjs`: manifest entries include tile/objective/wall metadata.
- `tools/asset-qc.mjs`: dependency-free PNG dimensions/alpha-bound validation.
- `test/t19-production-assets.mjs`, `test/t19-map-kit.mjs`: map manifest and pixel-QC contracts.

Verified commands/results:

```text
node tools/asset-qc.mjs --all       ASSET_QC_OK
node test/t19-production-assets.mjs PRODUCTION_ASSETS_OK
node test/t19-map-kit.mjs           MAP_KIT_QC_OK
node test/t18footprints.mjs         FOOTPRINT_OK
node test/t12render.mjs             RENDER_OK
node test/t11levels.mjs             LEVELS_OK
node test/t10save.mjs               SAVE_OK
git diff --check                    passed
```

Browser smoke was performed at `http://localhost:8000/?level=l1`: portal remained inside its 3x3 pad, crystal remained inside its 3x4 pad, floor tiles were square rather than vertically stretched, and the frame was continuous.

### Tower direction work

Rejected assets:

- `assets/staging/tower-family/tower-roster-2x2-concept-v1.png`: rejected because it uses diagonal/isometric foundations.
- The first two Arrow concept attempts were rejected because they read as gates/cards instead of a compact battlefield turret.

Accepted only as a geometry candidate, not runtime art:

- `assets/staging/tower-family/arrow/arrow-lv1-2x2-game-v1.png`.
- Exact canvas: 128x128 (2x2 at 64px per source cell).
- Alpha bounds: `x=10..117`, `y=8..120`.
- Composition proof: `assets/staging/tower-family/arrow/arrow-lv1-map-proof-v1.png`.
- It is strict top-down, square to the grid, and visually fits 2x2 next to walls/objective pads. It still needs explicit user approval before promotion to `assets/towers/` and manifest/runtime use.

The current Cannon raw concept was generated but is not yet copied/promoted or QC’d. Treat it as unapproved.

## Known Test State

`npm test` was run. After fixing the aura fixture and discrete difficulty-ordering assertion, the remaining failure is:

```text
campaign-sim.mjs
reference strategy loses very early across the campaign after the pre-existing 2x2 footprint conversion
```

This is a real campaign-map/balance integration task. The user explicitly said to defer balance fine-tuning while visual production continues. Do not hide, weaken, or delete this gate. Document each run and return to map/cost/strategy rebalance before calling the project fully green.

## Next Session Sequence

1. Read `docs/plans/2026-07-11-001-production-asset-pipeline-plan.md`, `docs/art/asset-qc-report.md`, and this handoff.
2. Show the Arrow map proof and request/record approval. Do not promote if rejected.
3. If approved, create Arrow L1-L5 plus a four-frame 2x2 attack sheet using the same strict top-down square contract. Normalize every output to 128x128 static / 256x256 sheet, then run alpha, padding, contact-sheet, and in-map checks.
4. Repeat by tower role: Cannon, Frost, Poison, Sniper, Lightning, Support (aura loop), Gold Mine (income loop). Wall stays 1x1 and static/connected.
5. Then produce all enemy families. Each enemy needs static fallback, four-frame locomotion (hover for Wisp), and four-frame defeat cycle. Extend renderer selection only after state sheets pass QC.
6. After every family, run focused tests, browser composition checks at mobile and desktop, and report accepted/rejected evidence. Do not push unapproved art into active runtime paths.
7. Later, repair campaign simulation with actual 2x2-aware level/balance changes and run full `npm test` before declaring the branch complete.

## Operational Notes

- The workspace is intentionally a large dirty checkpoint; do not reset/revert unrelated files.
- `tmux` commands hang in this Windows environment. Do not leave a hanging tmux process; use ordinary shell commands and keep the user updated instead.
- Use `apply_patch` for source/docs/test edits.
- Image generation output normally lives under `C:\Users\danom\.codex\generated_images\...`; copy selected sources into `assets/staging/`, remove chroma with the installed helper, normalize with exact pixel dimensions, and only then consider promotion.
- Keep `assets/staging/` out of `assets/manifest.json`. Runtime assets must never point at staging paths.
