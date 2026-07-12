# Mazecore TD Handoff

## Current Checkpoint

- Worktree: `D:\Claude\mazecore-td`
- Branch: `handoff/grid-art-pipeline-20260711`
- Latest pushed commit: `74a6dec feat(assets): complete production art pipeline`
- Remote: `origin/handoff/grid-art-pipeline-20260711`
- Local open-field work is intentionally uncommitted: approved floor/portal
  promotion, Level 1 prop data, objective pulses, and the map proof. Preserve
  it together with the pre-existing untracked `serve.err`; do not stage,
  remove, or modify `serve.err`.
- Never touch `D:\Claude\pusoy-now` or its untracked files.

## Non-Negotiable Rules

1. Keep Level 1 modular: tiles, pads, objectives, props, and sprites are
   atomic assets. Never flatten a board into a runtime bitmap.
2. All battlefield art is strict orthographic top-down and square to the grid.
   No diagonal, isometric, 3/4 foundations, props, effects, or shadows.
3. Footprints: wall 1x1; non-wall tower 2x2; portal 2x2; crystal 2x2.
4. Non-wall tower assets occupy the exact 128x128 source rectangle and render
   flush with adjacent 2x2 towers.
5. Never promote new art without explicit approval, alpha/dimension QC,
   focused tests, and map-scale proof.
6. Treat an approval as a checkpoint, not a stop signal. Continue the next
   non-approval task automatically and provide proactive checkpoint updates.
7. Preserve all source, generated, staging, and rejection evidence.
8. `campaign-sim.mjs` is a real, deferred balance failure. Never weaken,
   remove, hide, skip, or modify that gate during asset work.

## Completed Runtime Art

### Map and towers

- Modular Level 1 map kit, portal, crystal, wall, and 2x2 tower system are
  active.
- Level 1 now uses the approved `floor-openfield-v2` 1x1 field tile, warm
  `stone-openfield-v3` tiles, and individual `portal-openfield-v3` /
  `crystal-openfield-v3` 2x2 objective layers. Its six top-down rocks/trees
  are level data, decorative only, and cannot affect pathing.
- Portal and crystal have renderer-owned orthographic pulse cycles. Their
  motion is cosmetic and remains independent from gameplay timing.
- Portal energy has a renderer-owned spin loop. The crystal glows while intact
  and emits a cosmetic shard burst when a leak reaches it. Crystal routing is
  a multi-source 2x2 destination: enemies can enter any crystal cell from any
  reachable direction, while all four cells stay unbuildable.
- Arrow, Cannon, Frost, Poison, Sniper, Lightning, Support, and Gold Mine
  static families are active.
- Approved runtime loops: Arrow, Frost, Poison, Sniper, Lightning, Support
  aura, and Gold Mine income.
- Cannon intentionally remains renderer-owned glow/shake/smoke; do not replace
  it with image attack art without fresh user approval.

### Enemies

- Grunt (`normal`), Runner (`fast`), Brute (`tank`), Spawnling (`swarm`),
  Wisp (`flyer`), Mender (`healer`), Warden (`shield`), and Boss all now have
  versioned runtime static, walk/hover, and defeat paths.
- The renderer selects named enemy state sheets with static fallback.
- Defeat frames render from a cosmetic queue and do not delay death, bounty,
  pathing, or wave cleanup.
- Flying enemies have no ground shadow; Wisp uses hover art.

## Evidence Status

Already complete:

- `node tools/asset-qc.mjs --all` -> `ASSET_QC_OK`
- `node test/t19-production-assets.mjs` -> `PRODUCTION_ASSETS_OK` through the
  Wisp entries checked at the latest full-suite run.
- `node test/t12render.mjs` -> `RENDER_OK`
- `node test/t12mechanics.mjs` -> `MECHANICS_OK`
- `node test/t14asset-files.mjs` -> `ASSET_FILES_OK`
- `git diff --check` passed before commit.
- Open-field follow-up: `node test/t19-open-field-level.mjs`,
  `node tools/asset-qc.mjs --all`, `node test/t19-production-assets.mjs`,
  `node test/t19-map-kit.mjs`, `node test/t12render.mjs`,
  `node test/t12mechanics.mjs`, and `git diff --check` pass. The current
  proof is `assets/staging/map-kit/open-field/level-01-open-field-map-proof-v1.png`
  at exactly 768x1024 (12x16 64px cells).
- The selected portal/crystal style is now normalized as independent square
  `2x2` object layers over renderer-owned four-tile pads. Preserve the larger
  staging source and prior objective versions as approval evidence.
- Full `npm test` passed 38/39 suites; only plain `campaign-sim.mjs` failed.
  `campaign-sim.mjs --careless` and `--noupgrade` passed.

Follow-up evidence work completed 2026-07-12:

1. `test/t19-mender-staging.mjs`, `test/t19-warden-staging.mjs`, and
   `test/t19-boss-staging.mjs` added and registered in `test/run.mjs`; all
   pass. Map-scale proofs generated for all three families under
   `assets/staging/enemy-family/<family>/<family>-map-proof-v1.png`.
2. `test/t19-production-assets.mjs` now asserts Mender/Warden (32x32 logical)
   and Boss (64x64 logical) static + walk + defeat contracts.
   `tools/gen-assets.mjs` declares dedicated `BOSS_ENEMY_META` /
   `BOSS_SHEET_META` (64x64 logical) instead of the standard 32px metadata,
   and now derives every manifest `version` from the promoted file's `-vN`
   suffix so a manifest regeneration can never roll versions back.
3. Browser composition checks passed at `390x844` and `1440x900` with the
   full 8-type roster: Wisp hovers with no ground shadow, Brute/Boss scale
   reads correctly, Boss name + HP bar render, and a live defeat check
   confirmed lethal damage removes the enemy logically the same tick while
   the cosmetic defeat queue animates it (no delayed cleanup).
4. `docs/art/asset-qc-report.md` extended with Spawnling, Wisp, Mender,
   Warden, and Boss sections.

Known runtime observation (pre-existing at the checkpoint, NOT changed): the
browser console logs `dropped misaligned sheet` for all seven promoted tower
action/aura/income atlases. `sliceSheet` in `src/ui/sprites.js` rejects
full-bleed frames, while the tower-sheet QC contract requires exactly
full-edge frames — so those loops currently fall back to procedural motion at
runtime. Resolving this needs a decision (relax the slicer for tower sheets vs
re-cutting the sheets) and fresh approval; do not silently change either side.

## Required Final Gate

```text
node tools/asset-qc.mjs --all
node test/t19-production-assets.mjs
node test/t19-<family>-staging.mjs
node test/t12render.mjs
node test/t12mechanics.mjs
node test/t14asset-files.mjs
npm test
git diff --check
```

Report the known plain `campaign-sim.mjs` failure separately; do not "fix" it
as part of this asset branch.

## Key Files

- `assets/manifest.json`
- `tools/gen-assets.mjs`
- `tools/asset-qc.mjs`
- `src/ui/sprites.js`
- `src/ui/render.js`
- `src/game/enemy.js`
- `src/game/state.js`
- `docs/art/asset-qc-report.md`
- `docs/plans/2026-07-11-001-production-asset-pipeline-plan.md`
- `docs/plans/2026-07-12-002-remaining-production-asset-pipeline-plan.md`
