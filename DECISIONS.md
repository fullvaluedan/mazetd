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

## Phase 3–4 — Towers, combat & upgrades
- **Full combat built in Phase 3:** rather than ship a single archer in Phase 3
  and rewrite the firing code in Phase 4, the type-aware pipeline (splash, chain,
  slow, poison, hitscan, anti-air) was written once in Phase 3 and all six towers
  enabled. Phase 4 then added/verified the L1→L4 upgrade tree, the L3 fork and
  the targeting-mode UI. Cleaner and avoids churn.
- **Branch mods are multipliers on the L3 stats** (e.g. Marksman "+120% dmg" =
  L3 damage × 2.2). Computed in `getTowerStats`.
- **Homing projectiles** stand in for "lead the target": shots re-aim at the
  target's live position each tick, so moving enemies are hit reliably without a
  separate lead-prediction calc. Frost & Tesla are hitscan (instant beam/chain).
- **Shatter (Frost L4B)** applies a debuff (`+50% from all sources`) for the slow
  duration; it affects *subsequent* hits, and Frost keeps its base slow so frozen
  targets are both slowed and amplified.
- **Disrupt (Arcane L4B)** strips the shield pool to 0 and sets `disrupted` on the
  target, which stops a Mender's healing aura.
- **Contagion (Venom L4B)** marks the victim; on death its strongest poison stack
  is copied to enemies within 1.6 cells.
- **Build stays armed** after a successful placement so several towers can be
  dropped quickly; Esc cancels.

## Phase 5 — Waves, bosses & economy
- **Deterministic, preview-consistent composition:** `waveInfo(w)` is seeded by
  `SEED+w` and is the single source of the type set, so the HUD's next-wave
  preview always matches what actually spawns. `buildWave` uses a *separate* rng
  for placement/timing so the type list can't drift from the preview.
- **Routing variety from wave 40:** before 40 all spawns are used with
  nearest-goal routing; from 40 a random 2–3 spawns are chosen with random goal
  assignments, so attacks come from varying directions.
- **Boss ability kit escalates by tier (waveNum/10):** heal (all) → +swarmling
  spawns (T2) → +speed burst (T3) → +slow-immunity window (T4). Handled in
  `updateBosses` to avoid an enemy↔wave import cycle.
- **Build timer / early-start:** an 18s build timer ticks down between waves; the
  early-start bonus = `floor(remaining)` gold and is shown live on the Start
  button. Auto-start (off by default) chains waves when the timer expires.
- **Balance is deferred to Phase 8:** with default constants even a 127-tower L4
  "max build" only reaches ~wave 37. The wave system is correct; tuning
  DIFFICULTY/HP/damage so a *competent* run clears 100 with low margin is exactly
  Phase 8's job (per BUILD_PROMPT §10).

## Phase 6 — Heroes
- **Hero doesn't block enemy movement.** It pathfinds like an enemy and crowds
  the front line, but enemies walk past its cell rather than colliding. This
  avoids the hero accidentally "walling" a route (which would break the maze
  legality invariant) and keeps pathing simple. The Kingdom-Rush "hold the line"
  feel comes from **contact damage** instead: ground enemies within
  `HERO_CONTACT_RADIUS` chip the hero each tick (bosses ×6), so parking a fragile
  Mage in a swarm gets it killed while a Warrior can tank a chokepoint.
- **Ability power scales with hero level** implicitly: every ability's damage is
  `hero.damage × mult`, and `hero.damage` grows per level — so no separate
  ability-scaling tables are needed.
- **Targeted abilities** (Meteor, Frost Nova, Volley) arm a reticle; the next
  left-click on the canvas casts at that cell. Self/around-hero abilities
  (Whirlwind, Taunt, Hawk-Eye) fire immediately. Q/W are hotkeys.
- **Level-up fully heals**; respawn time = `8 + level + shop bonus`, respawning
  at the base cell next to G1.

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
