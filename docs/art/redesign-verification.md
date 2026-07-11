# Premium Redesign Verification

Date: 2026-07-10

## Acceptance Standard

A checkpoint passes only after the original issue is observed, the correction is exercised in the browser, nearby behavior is checked, and the automated contract remains green. An interrupted or timed-out browser batch is not counted as evidence.

## Verified Geometry

- The responsive battle shell passed the required geometry checks at 1280x720, 1440x900, 1024x1366, 430x932, 390x844, 844x390, and 932x430 during U2. Status, board, and command regions remained contained with no page scroll.
- Title, difficulty, and campaign map were checked at desktop, 390x844 portrait, and 844x390 compact landscape. The current campaign node remained visible and selection emphasis stayed inside its fixed badge.
- Settings, Store, Resume, Maze result, and leaderboard were measured at 390x844 with no page scroll. Settings and Victory were also inspected at 1280x720.
- Maze score entry was focused at 390x844 and at a 390x500 keyboard-height simulation. The name input and Save action remained visible and inside the viewport.

## Verified Interactions

- The empty-cell and tower radial center buttons retained their center anchor and closed the ring when clicked.
- The radial center target is permanently 44x44px; nine build actions remained inside the mobile world overlay.
- Tower hover does not show tower statistics. The explicit Info action opens the card inside the reserved command region without changing board dimensions.
- Settings initially focuses Close, inerts the battle shell, traps focus, closes with Escape, restores the prior focus target, and unlocks the shell.
- Campaign nodes and radial controls use fixed outer transforms; pressed feedback is confined to the inner control face.
- The compact difficulty proof state at 390x844 renders exactly three vertical choices: `EXPERT`, `NORMAL`, and `EASY`.
- Fully affordable batch builds remain silent; only a partial batch keeps an explanatory warning.
- The primary wave action visibly changes from `CALL EARLY +10g BONUS` as the build timer elapses. `t11economy` verifies the configured cap and decay values independently of presentation.
- Campaign Victory renders a deterministic score breakdown. Browser proof used 100 remaining gold and 8 lives, displayed `900` total, saved `QA Defender`, and then showed rank 1 with the same score on the local stage board.
- At 1440x900 the reserved status rail rendered `UP NEXT WAVE 1 / 10 enemies · Grunt`; it is deliberately hidden on compact layouts, where the wave chip and command action retain the clearer hierarchy.

## Verified Battlefield

- The ground is a flat 896x1344 dirt texture with no perspective scenery under build cells.
- Obsolete repeated border and path tile families were removed from the manifest and disk.
- The live route is a moving `[8, 40]` dash cadence with no path-tile rendering.
- The fitted stone frame uses a continuous opaque mortar bed and clean explicit corners.
- Spawn, crystal goal, notifications, and boss health remain unobstructed by shell chrome.
- A frozen first-frame 4x4 wall block plus a two-cell arm rendered flush. Removing scale animation from connected walls eliminated the reproduced join gaps.
- Arrow, Cannon, Frost, and Poison towers rendered directly beside the wall without crossing cell bounds.
- The eight live towers, cannon levels 1-5, and eight enemy roles were inspected together at game scale. Their silhouettes were distinct and their crops remained stable.

## Automated Evidence

- `npm test`: 24/24 suites passed after campaign leaderboard integration (2026-07-10, 139.8 seconds).
- `t10viewport`: board transforms, camera, pan, zoom, touch gestures, and chevrons.
- `t12render`: frame/path contract, culling, cache invalidation, and determinism.
- `t12mechanics`: tower mechanics remained unchanged.
- `t12resume`: campaign/endless save and resume behavior remained intact.
- `t13assets`, `t14asset-files`, `t16sprite-layout`: generator/manifest agreement, complete runtime files, metadata, icon symbols, wall topology, and logical pivots.
- `t15ui-contract`: named proof states, coordinate spaces, stable radial behavior, local icons, reserved notifications/boss status, and focus containment.
- `t17campaign-leaderboard`: pure score calculation, per-stage isolation, deterministic ordering, metadata persistence, Maze-board isolation, name preference, and 20-entry trimming.

## Cleanup

- Rejected green-field and obsolete diagonal tile-sheet candidates were removed from `assets/staging/`.
- Obsolete `assets/tiles/border.png` and `assets/tiles/path.png` files were removed.
- The active preview server owns `serve.err`; it remains a runtime artifact and is not part of the redesign contract.
