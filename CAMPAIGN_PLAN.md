# Campaign Plan — "Maze TD" portrait rebuild

User-approved direction (2026-06-11): portrait mobile game; ~20-level campaign
+ Endless unlock; Gem-TD checkpoint flags; 5g Wall block with cheap/weak
towers (maze-first economy); persistent hero with star-bought upgrades; hero
must visibly fight; UI restyled to match the bright anime art; first maps tiny
and simple (1 spawn → 1 exit), growing with the campaign.

Research base: Gem TD checkpoints (creeps visit flags in order, shortest path
between each — one maze walked 3–5×), Wintermaul economics (mass cheap walls +
few killer towers), Maze Game TD (blocked creeps attack; 50 levels).

## Phases (commit each)

### C1 — Dynamic grid + checkpoint routing + level definitions
- `engine/grid.js`: COLS/ROWS become mutable `let` exports + `setGridSize(c,r)`
  (ES live bindings keep every importer correct). World px = cols×32 per level.
- `ui/viewport.js`: world size becomes a constructor/`setWorld(w,h)` input.
- `game/levels.js` (NEW): LEVELS array. Per level: id, name, cols, rows,
  spawns, exit, checkpoints[] (unbuildable flag cells, visited in order),
  obstacles (authored, not random), startGold, lives, waves (compact params →
  expanded by makeWaves), towersAllowed, starThresholds. Level 1 = 9×12,
  1 spawn top → 1 exit bottom, 8 waves, wall+archer only. ~20 levels growing
  to 13×22, checkpoints from level 4, second spawn ~level 12, flyers ~level 8.
  Endless = tall 13×24 map reusing the procedural 1–100 wave system.
- Routing rework (`state.js`/`enemy.js`): per-enemy `stage` index over the
  level's waypoint chain [spawn→cp1→…→exit]. One BFS field per stage target;
  reaching a checkpoint cell advances the stage; leak only at the exit. Path
  overlay concatenates stages. `wouldSealAt` checks every consecutive pair.
  Siege/breach fields work per stage (cut-off creeps attack as today).
- Sim/tests keep defaulting to the classic 28×18 so all t8/t9/t10 gates
  still pass unchanged (setGridSize default).

### C2 — Wall block + maze-first economy
- TOWERS.wall: cost 5, no attack (`wall: true`), 2× tower HP, 100% sell refund
  (config WALL_REFUND; towers keep 70%) so juggling is cheap. Build ring slot.
- Tower costs ~halved (archer 35 / cannon 55 / frost 45 / venom 60 / arcane 70
  / tesla 100 / beacon 75) and DAMAGE_SCALE reduced — the maze does the work.
- Enemies get per-type `atk` (shown on info card): siege dps = scaled atk
  (replaces SIEGE.dpsBase+perWave formula); bosses ×4 stays.
- New `scratch/campaign-sim.mjs`: generic reference mazer for rectangular maps
  (serpentine inside the buildable region using walls + sparse towers,
  checkpoint-aware) + careless variant. Gate: every campaign level clearable
  by reference with low margin; level 1 beatable with walls+archers only.

### C3 — Hero presence (auto-engage combat)
- Guard-post AI: hero auto-attacks enemies within AGGRO (~3.5 cells) of its
  post (last commanded spot, default near exit), chases with a leash (~5),
  returns home; prioritizes enemies chewing walls in range. Tap repositions.
- Enemy↔hero combat made mutual + visible: swing lunge animation, slash arc
  effect, hit sparks, damage floaters both ways (contact dps already exists).
- Persistent hero: profile stores hero level/XP across levels; star-bought
  permanent upgrades (reuse HERO_UPGRADES shape, priced in stars on the map
  screen). In-level gold shop keeps consumables + tower boosts (per-run).

### C4 — Campaign shell + profile
- `services/profile.js` (NEW, localStorage `mazecore_profile_v1`): stars per
  level, hero {id,level,xp}, starUpgrades, endless unlock, settings.
- Level-select screen (vertical scrolling path of nodes with stars, locked
  states, hero panel + star-upgrade shop). Title → Map → Level → Victory
  (stars, star wallet) → Map. Tower unlock schedule tied to levels beaten
  (wall+archer → cannon L3 → frost L5 → beacon L7 → venom L9 → arcane L11 →
  tesla L13); locked build-ring slots show "Unlocks at level N".
- Endless unlocked after level 10; uses existing save/load + high score.
  Rewarded ads unchanged (FREE GOLD + revive) + optional "double stars" slot.

### C5 — Portrait reflow + UI restyle
- Portrait-first: tall worlds letterbox naturally; rotate guard flips to
  prompt PORTRAIT on coarse-pointer landscape; PWA manifest orientation →
  portrait. Top bar slims (chips wrap); hero dock + NEXT WAVE share a bottom
  thumb-zone bar; radial rings/sheets already touch-native.
- ui.css restyle to match the meadow art: warm cream/wood panels, rounded
  candy buttons (green/gold/sky), dark text on light chrome, soft drop
  shadows; sheets/screens brightened. Title/map screens reuse key art.

### C6 — Balance pass + docs + final sweep
- campaign-sim across all levels; classic gates (t10validate etc.) still
  green; README/PROGRESS/DECISIONS; full live playthrough of levels 1–3 and
  an Endless spot-check in the preview.

## Key invariants
- No deps, no build step; engine/game/sim stay DOM-free; all tunables in
  config.js or levels.js; never commit .env / assets/.
- Old 28×18 map remains the SIM's regression world; the game's Endless is a
  new tall map.
- Sheets/animation/SFX/ads layers untouched by the routing rework.
