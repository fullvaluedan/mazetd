# Mazecore TD Handoff

## Current Checkpoint

- Worktree: `D:\Claude\mazecore-td`
- Branch: `handoff/grid-art-pipeline-20260711`
- Do not touch the separate Pusoy Now checkout or its untracked files.
- Preserve the dirty worktree and all staging/rejection evidence. Never reset or
  discard existing changes.

## Non-Negotiable Rules

1. Runtime Level 1 is modular: atomic floor/pad/objective/tower assets only;
   never flatten a board into one image.
2. Strict orthographic top-down art only. No diagonal, isometric, or 3/4
   foundations, walls, pads, props, shadows, or battlefield effects.
3. Footprints: walls 1x1; all non-wall towers 2x2; portal 3x3; crystal 3x4.
4. Non-wall tower assets must fill their exact 128x128 source rectangle so
   adjacent 2x2 towers meet flush; renderer draws the occupied rectangle with
   no inset.
5. Do not promote art without explicit approval, source alpha/dimension QC,
   focused tests, and map-scale composition proof.
6. Continue autonomously between approval checkpoints. Batch future L1 design
   options for review; after approval, generate L2-L5 in one family request.
7. Give proactive updates: generated asset, acceptance decision, QC evidence,
   composition result, next action.
8. `campaign-sim.mjs` is a known real balance failure. Keep its gate intact;
   do not weaken, remove, or hide it.

## Implemented And Active

### Map kit

- Modular Level 1 map, runtime tiles, contained 3x3 portal and 3x4 crystal,
  and 1x1 red-brick wall are active and QC'd.
- Key contracts: `src/game/state.js`, `src/game/levels.js`,
  `src/ui/render.js`, `tools/gen-assets.mjs`, `tools/asset-qc.mjs`.

### Approved runtime tower art

| Family | Active static tiers | Active animation |
| --- | --- | --- |
| Arrow | L1-L5 `v2` | attack atlas `v2` |
| Cannon | L1-L5 (`v2`, with L2/L4 `v3`) | renderer-owned glow/shake/smoke; no image atlas approved |
| Frost | L1-L5 `v2` | none yet |
| Poison | L1-L5 `v3` | attack atlas `v3` |
| Sniper | L1-L5 `v4` | attack atlas `v3` |
| Lightning | L1-L5 `v2` | none yet |

Sniper static tier rotation was user-directed: prior L2 -> L1, L3 -> L2,
L4 -> L3, L5 -> L4, and larger prior L1 -> L5.

### Approved staging art not yet promoted

- Support L1 design direction: gold beacon, teal crystal/aura, cardinal pylons.
- Support L2-L5 source batch generated and approved; normalized staging L2-L5
  exists, but L1 must be normalized, map-proven, then family promoted.
- Gold Mine L1 design direction: timber mine, ore hopper, metal braces.
- Gold Mine L2-L5 source batch generated and approved; normalized staging
  L2-L5 exists, but L1 must be normalized, map-proven, then family promoted.
- Lightning attack-sheet source was generated and user-approved, but it is not
  yet normalized, QC'd, or promoted. Raw source:
  `C:\Users\danom\.codex\generated_images\019f4f23-ea59-78d3-be75-a36fc5cbab16\exec-1fb61b31-6cb6-47e9-a9dd-0a2cf7f7b7a4.png`.

### Required remaining tower work

1. Normalize, frame-QC, and promote approved Lightning attack atlas.
2. Generate Frost attack atlas; obtain approval; normalize/QC/promote.
3. Generate Cannon attack candidate only if needed. User previously approved
   renderer-owned glow/shake/smoke over an unapproved replacement image, so do
   not replace Cannon static art without fresh approval.
4. Normalize Support/Gold Mine L1 from the approved combined board, build
   family/map proofs, promote static L1-L5, then generate and approve their
   aura/income loops.

## Remaining Pipeline

1. Finish all approved tower animations and Support/Gold Mine promotion.
2. Produce enemy families: static fallback, four-frame locomotion (hover for
   Wisp), and four-frame defeat cycle. Extend renderer state selection only
   after each approved sheet passes source QC and map proof.
3. Run mobile and desktop browser composition checks for each promoted family.
4. Run full `npm test`; retain and report the campaign-sim failure until real
   2x2-aware balance/level repair is performed.
5. Review and commit intentional changes only after pipeline evidence is
   complete. Preserve untracked `serve.err`.

## Verification State

Most recent focused checks after Lightning static promotion:

```text
node tools/asset-qc.mjs --all       ASSET_QC_OK
node test/t19-production-assets.mjs PRODUCTION_ASSETS_OK
node test/t12render.mjs             RENDER_OK
node test/t12mechanics.mjs          MECHANICS_OK
git diff --check                    passed
```

Focused approved-family tests currently include:

- `test/t19-arrow-staging.mjs`
- `test/t19-poison-staging.mjs`
- `test/t19-sniper-staging.mjs`

## Reference Documents

- `docs/plans/2026-07-11-001-production-asset-pipeline-plan.md`
- `docs/plans/2026-07-12-002-remaining-production-asset-pipeline-plan.md`
- `docs/art/asset-qc-report.md`

## Operational Notes

- Use `apply_patch` for source/doc/test edits.
- Generated sources may contain preview checkerboards; crop the measured
  foundation and normalize before staging. Runtime paths must never reference
  `assets/staging/`.
- `tmux.exe` is available but sessions terminate after their command completes;
  capture logs immediately if background validation is used.
