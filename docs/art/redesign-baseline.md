# Premium Redesign Baseline

Captured 2026-07-10 on `feat/maze-mode` at `265ce0a33bb2f96d862fd1caea5ebb1533cf053b`.

This document is the ownership boundary for the premium redesign. Existing work is retained unless a later unit explicitly replaces it and records proof. User-approved screenshots and asset checkpoints remain the visual authority.

## Recovery

- Tracked binary diff: `scratch/redesign-recovery/2026-07-10-u11-tracked.patch`
- Non-runtime untracked archive: `scratch/redesign-recovery/2026-07-10-u11-untracked.zip`
- Snapshot size: 102 dirty paths, comprising 36 modified tracked paths and 66 untracked paths.
- `serve.err`, `serve.log`, `assets-gen.log`, and transient files under `scratch/` are disposable runtime evidence. They are not product assets and are excluded from the untracked archive.

Do not delete or rewrite an unclassified path. If rules overlap, the first matching category below owns the path.

## Worktree Inventory

### Redesign-Owned Work

These paths implement or verify the active redesign plan:

- `docs/plans/2026-07-10-001-mazecore-premium-game-redesign-plan.md`
- `docs/art/redesign-baseline.md`
- `src/sim/autoplay.js`
- `test/campaign-sim.mjs`
- `test/t10validate.mjs`

The simulation changes only expose the already-shipped difficulty mode to deterministic test runners. They do not change live balance values.

### Retained Gameplay and Difficulty Work

These prior changes are authoritative current behavior and must not be altered merely to support visual work:

- `src/config.js`
- `src/game/economy.js`
- `src/game/save.js`
- `src/game/state.js`
- `src/game/tower.js`
- `src/services/difficulty.js`
- `test/t10save.mjs`
- `test/t11economy.mjs`
- `test/t12resume.mjs`

### Retained UI and Rendering Work

These are prior implementation changes to preserve, inspect, and either incorporate or explicitly supersede with checkpoint proof:

- `index.html`
- `src/engine/input.js`
- `src/main.js`
- every modified tracked file under `src/ui/`
- `test/run.mjs`
- `test/t10viewport.mjs`
- `test/t12render.mjs`
- `test/t13assets.mjs`
- `test/t14asset-files.mjs`
- `tools/README.md`
- `tools/gen-assets.mjs`

At capture time, the modified UI files are `hints.js`, `hud.js`, `infocard.js`, `radial.js`, `render.js`, `screens.js`, `sprites.js`, `ui.css`, `viewport.js`, and `wavebar.js`.

### Retained Art Direction

These prior documents remain source material and approval history:

- `docs/art/ART-BIBLE.md`
- `docs/art/ART-PIPELINE-BRIEF.md`
- `docs/art/UI-REDESIGN-CHECKLIST.md`
- `docs/art/visual-direction.md`
- `docs/plans/2026-07-08-001-ui-polish-remaining-fixes-plan.md`

### Current Production Asset Changes

These modified tracked paths are currently wired and cannot be removed until a replacement passes source, transparency, and live-scale review:

- `assets/manifest.json`
- `assets/misc/background.png`
- `assets/misc/title.png`
- `assets/misc/worldmap.png`
- `assets/towers/cannon.png`
- `assets/towers/wall.png`

### Generated Candidates

Every untracked runtime image under the following patterns is a generated candidate, not automatically approved production art:

- `assets/sheets/tower-*-attack.png` (6 attack sheets)
- `assets/towers/*-lv1.png` through `assets/towers/*-lv5.png` (35 upgrade sprites)
- `assets/towers/arrow.png`, `gold.png`, `lightning.png`, `poison.png`, `sniper.png`, and `support.png`
- `assets/towers/cannonL.png`, `frostL.png`, and `wall-stackable.png`
- `assets/tiles/border.png` and `assets/tiles/path.png`
- `assets/staging/battlefield-background-candidate.png`
- `assets/staging/flush-tilesheet-candidate.png`

No candidate may be promoted or deleted without an approval or rejection record in this document.

### Disposable Runtime Artifacts

- `serve.err`
- ignored `serve.log`
- ignored `assets-gen.log`
- ignored probes, screenshots, and recovery material under `scratch/`

Disposable means safe to exclude from the final product diff after its evidence value expires. It does not authorize deleting user-owned source or art.

## Test Baseline

The first full run passed 17 of 21 gates. The failures were `t10validate.mjs` and the default, careless, and no-upgrade campaign simulation gates.

Git history at `d93a30e` records that competent-bot losses were intentional pending a later balance rebaseline. The current approved difficulty contract is:

- Expert: current baseline gold and tower strength.
- Normal: 40% more gold and 20% stronger player towers.
- Easy: 100% more gold and 50% stronger player towers.

The failing tests still required universal reference wins and did not accept a difficulty mode. They were stale expectations, not evidence that live balance should change. The runners now accept difficulty explicitly and validate durable outcomes:

- Aggregate reference performance rises from Expert to Normal to Easy, and Easy does not regress any sampled seed against Expert.
- Authored campaign performance is monotonic on all 20 levels, with Easy strictly improving 17.
- A reference maze outperforms careless play on 19 of 20 Easy levels and never performs worse.
- No-upgrade play wins zero authored levels; upgrades improve total campaign progress by at least 20% and are non-regressive on at least 75% of levels.
- The authored campaign runner permits up to 1,200 simulated seconds for very long late-game paths. The observed maximum is about 697 seconds on `l20/easy`, with no forced wave clear.

No production economy, tower, enemy, pathfinding, save, or progression value was changed during rebaseline.

## Visual Evidence Index

Existing ignored screenshots are retained under `scratch/` as pre-redesign evidence:

- Title and identity: `diff-title.png`, `title-emblem-check.png`, `title-emblem-check-2.png`
- Difficulty: `diff-menu.png`, `diff-menu-final.png`, `diff-menu-final-2.png`
- Campaign map: `diff-map.png`, `diff-map-final.png`, `map-emblem-check.png`
- Battle/frame/markers: `battle-frame-check.png`, `battle-marker-check.png`, `border-contact.png`
- Tower info and wall candidates: `info-card-preview.png`, `wall-stackable-preview.png`
- Deferred hero surface: `hero-select-check.png`

U1 will add deterministic viewport/state naming and capture the required full baseline matrix. These existing images are evidence, not proof that every required viewport already passes.

## Cleanup and Approval Rules

1. Preserve retained work until the owning redesign unit has reproduced its issue and proved a replacement.
2. Never promote a generated candidate because it exists in a runtime path; use the three-view asset approval rule.
3. Never change gameplay balance to make a visual checkpoint or stale simulation expectation pass.
4. Record approved, revised, or rejected asset families here with the exact evidence bundle.
5. Remove superseded styles and rejected candidates only during an owned cleanup checkpoint after regression checks.

## Approval Log

No new premium-redesign asset family has been approved from this baseline. Earlier user approvals remain valid only for the exact assets/screens shown in their checkpoint evidence.

### U1 Proof Harness - 2026-07-10

- `node test/t15ui-contract.mjs` passes all coordinate-space, named-state, stable-selector, storage-isolation, and accessible-dismiss checks.
- Browser proof drove `title`, `difficulty`, `map`, `battle-empty`, `radial-empty`, `radial-tower`, `info`, `settings`, `victory`, and `defeat` to an explicit ready signal using the real app APIs.
- Visible component checks passed for all ten states. The radial anchor itself is intentionally zero-sized; its visible center control is the interaction proof target.
- Fresh current screenshot: `scratch/redesign-baseline-direct-title.png`.
- Existing issue screenshots listed above remain the 1280x720/title-map-battle comparison evidence. The in-app browser's screenshot command timed out whenever a viewport override or nested harness frame was active, so no file is labeled as a new 1280x720 capture without proof.
- Required future viewport matrix: 1280x720, 1440x900, 1024x1366, 430x932, 390x844, 844x390 coarse-pointer, and 932x430 coarse-pointer. U2 owns numeric geometry and breakpoint-edge evidence for this matrix.
