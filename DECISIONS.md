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

## Phase 8 — Balance, save & juice
- **Balance was retuned via the autoplay sim** (BUILD_PROMPT §5 says the starting
  numbers are placeholders for Phase 8). Final constants vs the prompt's starters:
  `HP_EXP 1.10 → 1.05`, `DIFFICULTY 1.0 → 0.65`, new `DAMAGE_SCALE = 3`,
  `UPGRADE.dmgMultPerLevel 1.6 → 2.0`, `START_GOLD 260 → 800`,
  `BOUNTY_BASE/PER_WAVE 2/0.45 → 3/1.6`, `WAVECLEAR_PER_WAVE 4 → 12`,
  `SWARM_PACK 8–12 → 4–7`, `COUNT_PER_WAVE 0.6 → 0.55`.
- **Why HP_EXP had to drop so far:** a maze deals damage to each enemy only while
  it's in a tower's range, so there's a *throughput ceiling* — past some per-enemy
  HP, enemies survive the whole traversal no matter the total DPS. At HP_EXP 1.10
  (×13,780 by wave 100) even a 145-tower all-L4 build died ~wave 37. 1.05 (×131 by
  w100) sits inside what an upgraded maze can chew.
- **Upgrades carry the curve (dmgMultPerLevel 2.0):** L1 towers stay weak (so a
  no-upgrade "careless" build falls behind), while L4 towers get strong enough to
  clear 100 — widening the competent-vs-careless gap deliberately.
- **START_GOLD 800** lets a real maze go up immediately; without it the early game
  leaned on ranged-hero AoE as a crutch and the melee Warrior run collapsed by
  wave 8. Careless is unaffected (its strategy self-caps at ~20 unupgraded towers).
- **Verified balance:** reference build clears wave 100 on 6/6 tested seeds with
  3–9 lives left (low margin; lives hold ~16 until the wave-100 double-boss), all
  three heroes win, and the careless build dies waves ~22–28 (teaching zone).
- **The reference maze is a serpentine of border-anchored walls.** An early bug
  left the top/bottom rows as open highways so the path never lengthened (stuck at
  33); anchoring each wall to one border fixed it (path → ~115).
- **Save is between-waves only** so we never serialise live enemies/projectiles —
  the snapshot stores seed + economy + hero progression + every tower, and load
  rebuilds the identical map from the seed. High score = best wave reached.
- **Juice (screen shake + death particles) is cosmetic-only.** Particles use
  `Math.random` but are never read by game logic, so sim determinism (and thus
  reproducible balance) is preserved; the particle list is capped so headless
  runs (which don't drain it) stay bounded.

## Post-launch — Art, mobile & store pass
- **Sprites are an overlay, not a dependency.** `ui/sprites.js` loads whatever
  `assets/manifest.json` lists; every draw call falls back to the original shape
  when an image is missing/disabled. Assets stay gitignored & regenerable; the
  HUD "Art" button toggles live. Sprites are downscaled once to 128px offscreen
  canvases at load (they're 1024px source, drawn at ~32px — big mobile perf win).
- **Touch hero control:** tap the hero (20px hit circle), the hero-panel Move
  button, or `M` to arm move mode; the next tap is the destination. Right-click
  still works on desktop. Chosen over drag (conflicts with future pan/zoom) and
  over auto-follow (removes the WC3 "command your hero" feel).
- **Tower Boosts** apply at the combat layer (like Frenzy) rather than baking
  into per-tower stats, so they're save-friendly, retroactive to existing
  towers, and can't compound with upgrade math; the selected-tower ring shows
  the boosted range via `effectiveRange`.
- **Preview-tool gotcha:** the Claude preview reads `.claude/launch.json` from
  the *primary working dir* (OneDrive Claude folder), not the repo — a stale
  `opencut-classic` placeholder there was why the preview kept failing on port
  3100. Added a `mazecore` config there pointing at this repo's `serve.cjs`.

## Post-launch — WC3 matrix, Beacon aura & siege mode
- **Damage×armor matrix replaces flat armor.** Every hit is scaled by
  `DAMAGE_VS_ARMOR[damageType][armorType]` (0.5–1.5) in `takeDamage`; the old
  flat-armor subtraction is gone. Magic keeps its shield bypass as a second
  identity. Poison DoT is matrix-scaled once at application (contagion copies
  the already-scaled dps to neighbours — accepted approximation). `damage.js`
  exposes `matchup()`/`strongWeak()` so all UI badges derive from the table.
- **Tuning the matrix vs the careless band:** post-matrix the careless build
  died at w20 on two seeds. Root cause was the wave-20 BOSS: flat armor 8 had
  cost a cannon only ~15% damage, while `boss: 0.75` cost 25% — so pierce/siege
  vs boss went to 0.85 (matching the old effective value) and pierce vs
  fortified softened 0.5→0.6. Final careless band w20–28 (seed 1's map just
  builds a geometrically weak careless maze); reference 6/6 wins at 3–9 lives.
- **Beacon stacking is per-stat MAX, never sum** — two Command auras give the
  strongest one only, but Command + Haste combine (different stats). Kills
  beacon-farm degeneracy. Buffs are cached per tower (`recomputeAuras`) on
  build/sell/upgrade/load, not scanned per shot, and re-copied onto the stats
  object every `refreshStats()` (stats replacement was the #1 staleness risk).
  Aura radius deliberately ignores the shop range boost so the cache stays
  valid and coverage reads honestly.
- **Siege mode: sealing is allowed, punished in-fiction.** The legality check
  didn't disappear — `wouldSealAt()` now powers an orange preview warning and
  keeps the SIM's reference build seal-free. Besieged creeps follow a weighted
  Dijkstra field where a tower cell costs 200 (an open detour is always
  preferred until none exists), so the wave converges on the cheapest wall.
  Creeps never enter a tower cell; they stop adjacent and chew (wave-scaled
  dps, bosses ×4). Tower HP scales with invested gold and upgrades repair to
  full — deliberate: a maxed wall is a real fortification. No refund on
  destruction, so sealing is a calculated gamble, not free juggling insurance.
- **Juggling stays a first-class technique:** `reroute()` clears `siegeTarget`
  before re-pathing, so selling any wall snaps the whole wave back into
  walking the same tick.

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
