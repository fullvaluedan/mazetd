# Decisions / Assumptions Log

Choices made where the spec left room. Kept the game shippable; avoided
gold-plating.

## Phase 0 — Scaffold
- **Layout:** spawns on the left/top edges (S1 top-left, S2 left-middle, S3
  bottom-left) and goals on the right/bottom (G1 right-middle, G2 bottom-right).
  The spec's example put a spawn at "right-middle" next to a "center-right" goal,
  which would barely cross the map; my layout makes enemies traverse the full
  28-wide board, which gives much better mazing. Positions live in
  `CONFIG.SPAWNS` / `CONFIG.GOALS`.
- **HUD width:** fixed 320px right panel; canvas is fixed 896×576 and centered in
  the remaining space (scales down to fit small screens via CSS `max-width`).
- **Loop:** classic accumulator fixed-timestep at 60Hz. `gameSpeed` multiplies
  sim-time owed per frame (so 3× runs up to 3× the ticks per frame).
  `MAX_STEPS_PER_FRAME = 8` prevents a catch-up spiral after the tab is
  backgrounded.
- **Config front-loaded:** all data tables (enemies, towers, heroes, shop, waves)
  were written in Phase 0 even though they're used later, to avoid churning the
  config file every phase. Behaviour is still added phase by phase.

## Planned mechanics (decided up front, implemented in later phases)
- **Pathfinding:** enemy routing uses a per-goal BFS **distance field** (uniform
  cost = shortest path on a 4-connected grid) rather than per-enemy A*. Enemies
  follow the gradient downhill to the goal. This auto-reroutes every enemy the
  instant a tower is built or sold, and is far cheaper than recomputing A* per
  enemy. A* is still provided in `pathfinding.js` for the hero's move-to-cell
  command and for drawing the path overlay; BFS reachability backs the
  "can I build here?" legality check.
- **Build legality:** a placement is legal if the cell is an empty buildable
  interior cell, no enemy currently occupies it, and — with the cell temporarily
  blocked — every spawn can still reach every goal. (Classic Wintermaul "no full
  block" rule; we do NOT let enemies destroy towers.)
- **Re-route safety:** you cannot build on a cell an enemy currently stands in,
  so an enemy's current cell is always valid after a rebuild; only its *next*
  step is re-derived from the refreshed distance field.
