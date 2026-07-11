---
title: "ui polish: remaining maze-mode fixes"
type: polish
date: 2026-07-08
status: draft
origin: user playtest feedback 2026-07-08
branch: feat/maze-mode
---

# Maze Mode UI Polish Remaining Fixes

## Summary

The core fantasy HUD direction is in place. This pass is about the remaining presentation seams: a cleaner title/map identity, a non-campfire exit marker, and a battle frame that reads like a carved game board instead of a ring of loose tiles.

## What Is Already Done

- The info card is already simplified and browser-checked.
- Stage-select highlight and the empty-tile X anchor bugs are already fixed and verified.
- The top HUD no longer hides readable board labels.
- The current flat dirt board direction is already in place.
- The stackable wall art exists and is wired in.

## Implementation Units

### U1. Title and map identity use the crystal emblem

- Add the crystal/castle emblem to the title and stage-select surfaces so the app has a strong icon instead of a plain text-only header.
- Keep the current text logo readable, but make the emblem the visual anchor.
- Reuse the existing generated art where possible before introducing new art.
- Files: `src/ui/screens.js`, `src/ui/ui.css`, `assets/manifest.json` if a new art hook is needed.
- Verification: the title screen and level-select screen show the new emblem cleanly at the current browser size and do not clip it.

### U2. Replace the campfire exit marker

- Swap the campfire-looking goal marker for a crystal or castle-style map marker.
- Keep it centered in the exit cell and visually distinct from the spawn marker.
- If the generated asset does not land cleanly, keep a small procedural fallback so the game never regresses to a campfire.
- Files: `src/ui/render.js`, `tools/gen-assets.mjs`, `assets/manifest.json`.
- Verification: the goal marker no longer reads as a campfire in battle, stays centered, and still reads clearly against the board.

### U3. Redesign the outer battle frame

- Replace the tiled outer border treatment with a single premium frame language.
- Keep the board readable without visible stepping or diagonal tile seams at the edge.
- Preserve playability: the frame must not crowd the map, gates, or bottom tray.
- Files: `src/ui/render.js`, `src/ui/ui.css`, and any generated frame/background asset touched by the new treatment.
- Verification: the battle view looks flush on all four edges, with a clean frame line and no broken corner joins.

### U4. Keep the title and stage-select family consistent

- Match the title, stage select, and battle UI colors, shadows, and panel shapes.
- Remove any remaining web-shell feeling from the home flow.
- Make the frame and buttons feel like one family across screens.
- Files: `src/ui/screens.js`, `src/ui/ui.css`.
- Verification: title and stage-select screens feel like the same game family as battle, not a separate menu shell.

### U5. Browser proof after each checkpoint

- Confirm each change in the live browser before moving to the next one.
- Use the existing test suite for render safety plus browser screenshots for the art changes.
- Files: `test/t12render.mjs`, `test/t13assets.mjs`, `test/t14asset-files.mjs`, plus focused browser checks.
- Verification: the relevant tests pass, the browser view matches the intended look, and no new clipping or alignment regressions appear.

## Verification Contract

1. Make one checkpoint-sized change at a time.
2. Run the narrowest relevant automated checks.
3. Refresh the local game with a cache-busting query string.
4. Inspect the live browser at the current desktop size.
5. Only move forward once the checkpoint is visually and functionally complete.

## Definition of Done

- The title and stage-select screens have a crystal/castle identity treatment.
- The battle exit marker is no longer a campfire.
- The board frame looks like a designed frame, not a tiled border.
- The existing info card, anchor, and HUD fixes stay intact.
- The browser checks show a cleaner, more intentional Clash Royale-style presentation.
