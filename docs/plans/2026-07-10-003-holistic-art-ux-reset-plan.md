---
title: "Holistic Art, UX, and Interaction Reset"
date: 2026-07-10
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
---

# Holistic Art, UX, and Interaction Reset

## Problem Frame

The game is functional, but it does not yet read as one authored product. UI feedback can move the playfield during active input, radial actions change position after state transitions, early-wave reward is mathematically present but not perceptually legible, and individual generated assets have been reviewed in isolation rather than as a cohesive battlefield, menu, map, and HUD system.

This plan resets the quality bar: preserve the game’s original crystal-kingdom / anime tower-defense identity, take hierarchy cues from premium mobile strategy games, and reject any change that improves a component while making the composed screen less coherent.

## Non-Negotiable Requirements

- No transient feedback may change battle-shell, board, radial, gate, goal, or selected-cell geometry.
- Selling a tower and calling an early wave must be non-blocking: use sound, gold/resource deltas, and anchored micro-feedback rather than screen-moving banners.
- A max-level tower keeps the same radial slots and spatial anchors; its upgrade slot remains present but disabled and clearly marked `MAX`, never removed or reflowed.
- The early-wave action must communicate a live reward and a visibly shrinking time window; its value and countdown use the same source of truth as the payout.
- Art decisions are approved as connected families at actual game scale, not as single attractive images.
- Existing assets are not regenerated or replaced without a contact sheet, composited scene proof, and explicit approval checkpoint.

## Code Review Findings To Address

1. `src/main.js` appends early-wave and batch-sell banners to `#notifications`, which lives in `#status-deck`. Adding/removing children can change deck height and move the board while input is active.
2. `src/ui/radial.js` deliberately changes `infoSlot`, target slot, and sell slot when `tower.canUpgrade()` becomes false. This reproduces the user-visible radial reorganization at max level.
3. `src/ui/wavebar.js` derives an early reward independently for presentation while `src/game/economy.js` owns payout. The formulas currently match, but a second calculation risks future drift and provides no timing-progress model.
4. `src/ui/ui.css` and `src/ui/styles/*.css` contain overlapping legacy and redesign rules. Their cascade is difficult to reason about, so local polish can create cross-screen regressions.
5. The current art process has no mandatory scene-level acceptance gate across menus, board frame, tiles, walls, towers, enemies, and HUD.

## UX Review Lens

Every implementation checkpoint must be reviewed against these player tasks:

- Start a campaign: choose a difficulty in one second, then understand where to play next.
- Build and manage: tap a tile/tower without the battlefield or radial target shifting.
- Decide whether to call early: see both current gold reward and how quickly it decays before committing.
- Read combat: identify gold, lives, current/next wave, gates, path, walls, enemies, and selected tower without competing panels.
- Complete a stage: understand score, save it, and compare the result without navigating a different visual language.

The reviewer records visual hierarchy, target stability, readability at 390x844 and 1440x900, asset-family cohesion, and interaction interruption. A screenshot alone is insufficient: each task is clicked/tapped and rechecked after every transient state.

## Art-System Direction

### Inspiration Matrix

Use premium tower-defense and mobile strategy games as a benchmark for clarity and craft, never as an asset source or layout to trace.

| Reference family | Borrow the principle | Mazecore translation | Do not copy |
| --- | --- | --- | --- |
| Clash Royale | Bold resource hierarchy, immediate card/action readability, confident color-coded states, satisfying pressed depth | Navy-and-gold framed HUD, teal crystal focus, red-brick defense, compact high-contrast command actions | Card art, characters, crowns, arena motifs, iconography, exact button layouts, fonts, or audio cues |
| Kingdom Rush | Battlefield-first composition, readable enemy/tower silhouettes, compact contextual tower management | Keep the board unobstructed; use stable radial tower actions and clear local range/target feedback | Its tower, hero, terrain, UI silhouettes, props, or fantasy motifs |
| Bloons TD | Fast information scanning, upgrade-state clarity, decisive next-wave control, distinct enemy roles | Fixed radial upgrade slots, explicit `MAX` state, a live early-wave meter, strong enemy role colors | Its monkey, balloon, track, upgrade-panel, or map language |
| Modern mobile TDs | One visual grammar across menu, map, battle, victory, and progression | Shared materials, outlines, lighting, bevels, type scale, and icon language across every Mazecore screen | Any single game's screen composition wholesale |

**Reference test:** a player may recognize Mazecore as premium and easy to read, but must never mistake a screenshot, asset, character, icon, or screen for another game.

### Style Contract

- **World:** bright, top-down anime diorama; simple silhouette-first shapes; warm dirt, moss, red brick, stone, teal crystal, and restrained magical cyan.
- **Materials:** red brick is the wall family; warm stone is the frame/castle family; grass/dirt are flat grid-supporting surfaces, never perspective scenery beneath cells.
- **Line and light:** consistent dark olive/navy contour, upper-left light, compact drop shadow, no photoreal texture noise, no independent glossy treatments.
- **UI:** deep navy interiors, warm dark-gold/stone edges, cream type, cyan selection, gold action, red danger. One bevel recipe and one pressed-face behavior.
- **Prohibited:** copied Clash Royale assets/layouts, text baked into generated art, diagonal seams, tile-specific lighting conflicts, and standalone assets that do not tile or composite cleanly.
- **Benchmark composition:** the board is the hero; resource state is scannable in one glance; the next-wave decision is visually dominant but never blocks the route; contextual tower actions are local, fixed, and secondary to combat.

### Grid-Owned Map Art Contract

Map art must never define gameplay cell size. The engine’s grid remains authoritative; every terrain/objective image is rendered against that grid.

- `floor-dirt-1x1`: one clean, edge-safe dirt tile repeated beneath every playable cell. It contains no baked grid, frame, pad, path, object, or lighting gradient.
- `stone-pad-1x1`: one warm-stone tile used only to assemble objective pads and the outer frame. Every pad/frame tile is the same source size as a floor cell.
- `portal`: one transparent art image with no foundation or tiles. The renderer places it inside a `3x3` grid rectangle over nine `stone-pad-1x1` cells.
- `crystal`: one transparent art image with no foundation or tiles. The renderer places it inside a `3x4` grid rectangle over twelve `stone-pad-1x1` cells.
- The portal/crystal silhouette, glow, and shadow are clipped to their assigned rectangle; pads are visible because they are grid cells, not decoration baked into the objective asset.
- Source art is authored at `64px per grid cell` for clarity, then rendered at the game’s `32px` logical cell size. Thus portal source bounds are `192x192`, crystal source bounds are `192x256`, and all collision/render rectangles can be checked exactly.
- A deterministic seeded variation layer may later select from a small set of edge-compatible dirt/stone variants. It cannot change cell bounds, objective footprint, or collision.

### Family Approval Batches

1. Board foundation: dirt field, grid treatment, continuous frame, red-brick wall topology, spawn/goal/camp props.
2. Combat family: all towers at levels 1-5, attack frames, all enemy roles, projectiles/effects.
3. Navigation family: title, map, stage nodes, icons, difficulty, score/leaderboard.
4. UI family: HUD panels, buttons, cards, sheets, radial actions, state colors, typography.

For each batch: generate a labeled contact sheet, build a representative scene composition, inspect at 1x mobile and desktop, approve/reject the complete family, then wire only approved assets into the manifest. Keep rejected candidates in staging, never active runtime paths.

## Implementation Units

### U0. Design and approve footprint-driven maze rules before wiring

Files: `docs/art/scene-approval-matrix.md`, `docs/art/ART-BIBLE.md`, new `docs/art/footprint-maze-design.md`, new `docs/art/contact-sheets/footprint-board-concepts/`.

- Treat tower size as gameplay truth, not sprite scale: Wall `1x1`; every non-wall tower, including Arrow, Ice, Cannon, Poison, Sniper, Lightning, Support, and Gold, uses `2x2`.
- Portal and crystal are special non-buildable edge objectives on `3x3` pads; their route mouth stays at the existing spawn/goal cell so objective presentation does not change path semantics.
- Each campaign stage starts with a small player-owned `1x1` red-brick wall pattern. Walls cost `1G` to build and refund `1G` on takedown, including starter brick.
- Create top-down board concepts with these exact footprints shown against the live grid, including a narrow corridor, a turn, a 2x2 cannon corner, and a failed/sealed-route example.
- Decide footprint anchor convention before code: use the selected cell as the top-left cell, keep footprints axis-aligned, and do not add rotation in this phase.
- Establish shared visual rules: every 2x2 structure uses one continuous foundation, centered pivot, readable roof/barrel/crystal silhouette, and no gaps or repeated micro-tile seams across occupied cells.
- Add authored environmental props to concept boards: tree clusters, rock formations, ruins, water edges, bridge pieces, and mushrooms/flowers only at the level perimeter or as intentionally blocked cells. They must support route readability and never create perspective scenery underneath build cells.
- Approval gate: review the full board at 1x mobile and desktop scale before producing any final tower assets or changing runtime occupancy.

### U0c. Produce a truly modular map foundation kit

Files: new `assets/staging/map-kit/`, `docs/art/ART-BIBLE.md`, `docs/art/scene-approval-matrix.md`, later `assets/tiles/` and `src/ui/render.js` after approval.

- Generate and inspect only these first four pieces: `floor-dirt-1x1`, `stone-pad-1x1`, transparent `portal-3x3`, transparent `crystal-3x4`.
- Reject any asset with baked tile lines, foundation slabs, frame pieces, scenery, or shadow outside its assigned image bounds.
- Compose a proof board programmatically from repeated 1x1 tiles plus separately scaled portal/crystal images; do not use a flattened generated map as runtime art.
- Verify pixel geometry before visual approval: the same source cell size, portal exactly 3x3 cells, crystal exactly 3x4 cells, and no art crossing the assigned rectangle.

### U0a. Introduce true multi-cell occupancy and atomic path legality

Files: `src/config.js`, `src/game/state.js`, `src/game/tower.js`, `src/game/shop.js`, `src/game/save.js`, `src/game/levels.js`, `test/t10siege.mjs`, `test/t10save.mjs`, `test/t11economy.mjs`, new `test/t18-footprints.mjs`.

- Add `footprint: { w, h }` to every tower definition: walls are `1x1`, all live non-wall towers are `2x2`, and missing legacy metadata defaults to `1x1` for old saves. Reserve the portal/crystal `3x3` objective pads from building without treating them as path-blocking terrain.
- Add one shared footprint-cell helper. It validates bounds, terrain, occupied cells, checkpoints, enemies, and all placement rules for the complete rectangle.
- Store a reference to the same tower entity in every covered `towerGrid` cell; keep one tower record with a top-left anchor plus center point for range, targeting, rendering, and UI.
- Replace single-cell `canBuildAt` / `wouldSealAt` checks with atomic footprint variants. A placement either reserves the entire shape and path-tests the entire shape, or changes nothing.
- Update sell, batch actions, save/load, aura distance, siege cost, and removal so any covered cell resolves to the same owning tower once, without double gold/refund/events.
- Preserve old saves by treating missing footprint metadata as `1x1`; version new saves only after migration tests pass.

### U0b. Adapt interaction, maps, balance, and rendering to footprints

Files: `src/engine/input.js`, `src/ui/radial.js`, `src/ui/multiselect.js`, `src/ui/render.js`, `src/ui/infocard.js`, `src/ui/sprites.js`, `src/game/levels.js`, `src/sim/autoplay.js`, `test/t10viewport.mjs`, `test/t12batch.mjs`, `test/t12render.mjs`, `test/campaign-sim.mjs`, new `test/t18-footprint-ui.mjs`.

- Show the full placement rectangle before build: valid, blocked, and route-sealing states color all covered cells. Anchor radial actions and info to the footprint center.
- Ensure selecting, selling, upgrading, marquee selection, and hover work from any occupied cell and never duplicate a multi-cell tower.
- Render one scaled/pivoted tower asset across its full footprint with range from its center; wall rendering remains dedicated `1x1` connected topology.
- Audit every authored level for viable corridors and build real estate. Resize/redraw maps where 2x2 structures would otherwise make the puzzle impossible or trivial; reserve environmental obstacles as authored level features, not random decoration.
- Rebalance costs, ranges, damage, and unlock cadence after map changes; larger towers must trade footprint and price for meaningful payoff.
- Extend deterministic simulation strategies to place only legal footprints and re-baseline reference/careless/no-upgrade gates.

### U1. Stabilize transient gameplay feedback

Files: `src/main.js`, `index.html`, `src/ui/styles/battle.css`, `src/ui/ui.css`, `test/t15ui-contract.mjs`, new `test/t18-feedback-geometry.mjs`, `test/ui-harness.html`.

- Split feedback into layout-free board toasts and world-anchored resource floaters.
- Remove normal early-call and successful batch-sell banners. Early-call uses the wave-control reward state plus a brief local gold pulse; sell uses the existing refund/gold change plus an anchored floater.
- Keep blocking warnings (invalid sell, partial batch, flying/boss/siege) in a fixed-position, pointer-events-none overlay that cannot alter shell dimensions.
- Add geometry tests that mount/remove every feedback type while a radial is open and assert unchanged board, radial-center, and selected-cell coordinates.

### U2. Lock radial action geometry

Files: `src/ui/radial.js`, `src/ui/styles/battle.css`, `src/ui/ui.css`, `test/t11economy.mjs`, `test/t15ui-contract.mjs`, new `test/t18-radial-stability.mjs`.

- Define permanent role slots for upgrade, info, targeting, and sell independent of upgrade availability.
- At max level, render a disabled `MAX` upgrade item in the upgrade slot; preserve all other positions and center anchor.
- Verify normal, fork, max-level, wall, disabled/insufficient-gold, hover, active, and keyboard-focus states at fixed coordinates.

### U3. Make early-wave incentive legible

Files: `src/game/economy.js`, `src/ui/wavebar.js`, `src/ui/styles/battle.css`, `test/t11economy.mjs`, new `test/t18-early-wave-ui.mjs`.

- Export one read-only early-reward state helper from economy: cap, remaining gold, elapsed, and normalized remaining-window fraction.
- Use that helper for both payout and WaveBar presentation; eliminate duplicate arithmetic.
- Show `CALL EARLY`, `+Ng`, and a simple shrinking meter/ring. Update only at the whole-gold/visual threshold and never create a banner.
- Test exact reward/elapsed boundary values, monotonic visual fraction, reward zero behavior, and payout equality with the displayed value.

### U4. Conduct a component and cascade code review

Files: `src/ui/ui.css`, `src/ui/styles/tokens.css`, `src/ui/styles/primitives.css`, `src/ui/styles/battle.css`, `src/ui/styles/screens.css`, `src/ui/styles/sheets.css`, `src/ui/*.js`, `test/t15ui-contract.mjs`.

- Inventory duplicate selectors, conflicting transforms, hard-coded colors/radii/shadows, and legacy emoji/glyph paths.
- Consolidate each component’s base, state, and responsive rules into one owner stylesheet while retaining only intentional compatibility overrides.
- Add source-level contracts for stable bounds, minimum targets, reduced motion, modal focus, no layout-bearing notifications, and no unapproved bare glyphs.
- Perform a code review after each consolidation batch; findings are ranked by gameplay interruption, visual regression risk, and maintainability.

### U5. Run a whole-screen art and UX review before regeneration

Files: `docs/art/ART-BIBLE.md`, `docs/art/visual-direction.md`, new `docs/art/scene-approval-matrix.md`, new `docs/art/contact-sheets/`, `assets/staging/`, `test/ui-harness.html`.

- Create a scene approval matrix for title, map, empty battle, tower radial, info card, active wave, victory, leaderboard, and settings at mobile/desktop.
- Produce contact sheets and composited scenes from the active art, score each family against the style contract, and identify only systemic gaps.
- Do not generate replacements until the matrix identifies the exact family, silhouette, palette, scale, tiling, and in-scene reference needed.
- Require explicit approval after each asset family; preserve approved work and reject substitutions that are not reviewed in-context.

### U6. Rebuild the visual system family-by-family

Files: approved entries in `assets/manifest.json`, `assets/misc/`, `assets/tiles/`, `assets/towers/`, `assets/enemies/`, `assets/ui/`, `src/ui/sprites.js`, `src/ui/render.js`, `tools/gen-assets.mjs`, `test/t13assets.mjs`, `test/t14asset-files.mjs`, `test/t16sprite-layout.mjs`.

- Wire only approved batches from U5, preserving stable pivots, cell bounds, wall topology, and level/attack naming contracts.
- Test image existence, dimensions, transparent padding, pivots, connected-wall seams, gameplay-scale crops, and atlas/manifest agreement.
- Inspect a full representative board with all tower tiers, enemies, effects, frame, and HUD simultaneously before accepting a batch.

### U7. Final UX acceptance and optimization pass

Files: `docs/art/redesign-verification.md`, `test/run.mjs`, relevant implementation files.

- Run task-based browser QA at 390x844, 844x390, 1024x1366, and 1440x900.
- Verify no geometry shifts through sell, early call, wave start, partial batch, max upgrade, modal open/close, and stage victory.
- Measure render/update behavior for notification churn, DOM updates, sprite loads, and resize paths; remove avoidable per-frame DOM writes and layout reads.
- Run the full suite plus a focused manual UX checklist. Only mark the redesign complete when all functional, visual, asset-family, and interaction checks pass.

## Sequencing

1. U0 first: approve footprint rules and whole-board composition before coding or generating tower families.
2. U1-U3 next: remove gameplay-interrupting regressions before broad visual work.
3. U0a-U0b: implement and rebalance true footprints before finalizing board/tower assets.
4. U4 next: establish one reliable component/cascade system.
5. U5 is the approval gate for all art work; U6 proceeds one approved family at a time.
6. U7 validates the composed game, not isolated widgets.

## Definition of Done

- Selling or calling early never moves the screen, board, selected cell, or radial action.
- Maxed-tower radial actions remain in fixed positions and the disabled upgrade slot reads `MAX`.
- Early-wave value visibly decays and exactly matches payout.
- Every active visual belongs to an approved family and passes whole-screen composition review.
- Walls occupy `1x1`; all live non-wall towers occupy `2x2`, consistently in pathing, input, saves, rendering, balance, and authored maps. Every level uses environment props intentionally without compromising playable-grid clarity.
- CSS ownership is clear, interaction states are stable, and all responsive/task-based/browser/full-suite checks pass.
