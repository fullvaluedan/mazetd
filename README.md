# Mazecore TD

A **vertical mobile maze-defense game** in the spirit of the Warcraft III
classics (Wintermaul, Gem TD, Maze TD): you get an open field, enemies always
take the shortest path, and your towers ARE the walls. A 20-level campaign
grows from a tiny teaching board to multi-spawn checkpoint runs, with an
Endless mode, a persistent fighting hero, and rewarded ads. Pure HTML5 Canvas
+ vanilla JavaScript — **no build step, no dependencies.**

## The game

- **Campaign** (20 authored portrait levels): each level adds a wrinkle — new
  tower unlocks, Gem-TD **checkpoint flags** (creeps must visit them in order,
  so one maze gets walked 3–5 times), flying waves, twin spawns, bosses.
  1–3 **stars** per level (lives kept) gate later levels and buy permanent
  hero upgrades on the map screen. **Endless** (100 procedural waves + high
  score + save/load) unlocks after level 10.
- **Maze-first economy**: 5g **Walls** (sell back 100% — juggling is free)
  form the labyrinth; a handful of real towers do the killing.
- **You CAN seal the maze** — but cut-off creeps swarm the cheapest wall and
  chew through it (every enemy shows its wall-damage stat). No refunds on
  rubble.
- **The hero fights on its own**: it guards its post, auto-engages anything
  in aggro range — wall-chewers first — chases on a leash, and returns home.
  Tap it, then the ground, to redeploy. It keeps its level between missions.

## How to run

You need to serve the folder over HTTP (ES modules can't run from `file://`).

```bash
bash start.sh        # macOS / Linux / Git Bash  (uses python3 or npx)
start.bat            # Windows
```

Then open **http://localhost:8000**.

No python or node? Any static file server works — e.g. the VS Code "Live
Server" extension, or `npx serve`.

## How to play

You don't follow a fixed track — **you build the track**. Enemies pathfind from
their spawn to a goal, treating your towers as walls, always taking the shortest
open route. Place towers to force them down a long, winding maze so they spend as
long as possible in range.

- **Build a long maze.** The longer the path, the more your towers fire.
- **You CAN wall enemies off — at your peril.** Sealing every route is allowed
  (the preview turns orange to warn you), but a sealed-out wave besieges your
  maze: creeps swarm the cheapest wall and chew through it. Destroyed towers
  pay no refund. Masters use this for *juggling* — open and close alternate
  doors to walk a wave back and forth through the kill zone.
- **Get anti-air before wave 15.** Flying enemies ignore your maze and fly
  straight to the goal — only air-capable towers (Archer, Frost, Arcane, Tesla)
  can hit them.
- **Play the armor matchups.** Every tower has a damage type, every enemy an
  armor type (shown in its tooltip and the wave preview):

  | damage \ armor | Unarmored | Light | Medium | Heavy | Fortified | Boss |
  |---|---|---|---|---|---|---|
  | **Pierce** (Archer) | 1.25× | **1.5×** | 1× | 0.75× | *0.6×* | 0.85× |
  | **Siege** (Cannon) | 1.25× | 0.75× | 1× | 1× | **1.5×** | 0.85× |
  | **Magic** (Frost/Arcane/Tesla) | 1× | 1.25× | 1× | **1.5×** | *0.5×* | 1× |
  | **Poison** (Venom) | 1× | 1× | **1.5×** | 0.75× | 1× | 1× |
  | **Chaos** (hero, Archmage, Airstrike) | 1× | 1× | 1× | 1× | 1× | 1× |

- **Drop a Beacon in the middle of your maze.** It doesn't attack — it grants
  +damage and +attack speed to every tower in its radius (strongest aura wins;
  same-type auras don't stack).
- **Use your hero.** Command it with right-click, fire its two abilities, keep it
  alive, level it up.
- **Survive all 100 waves to win.** Lose all 20 lives and it's over.

## Controls

The whole interface lives over the battlefield, Kingdom-Rush style:

- **Tap any open cell** → a radial ring of all 7 towers appears; tap one to
  build it. **Tap a tower** → upgrade / choose its L4 specialization / cycle
  targeting / sell.
- **Tap your hero** (or its portrait, bottom-left) to select it; while
  selected, every tap on open ground is a move order. The two buttons next to
  the portrait cast its abilities.
- **NEXT WAVE** (bottom-right) or the bouncing chevrons at the spawn mouths
  call the wave in early for bonus gold.
- The **top bar** holds gold/lives/wave, a 📺 FREE GOLD rewarded-ad button,
  speed, pause, the 🛒 Store (hero upgrades, tower boosts, consumables) and ⚙
  Settings (save/load, art, sound, auto-start, restart).
- Lose a run? The defeat screen offers a **once-per-run ad revive** (+5 ♥).

Desktop shortcuts still work:

| Key | Action |
|-----|--------|
| Right-click | Command the hero to move |
| `P` / `Space` / `1` `2` `3` | Path overlay / pause / game speed |
| `S` | Start the next wave |
| `Q` / `W` | Cast hero ability 1 / 2 (targeted ones then click a cell) |
| `M` | Select / deselect the hero |
| `Esc` | Close ring → cancel selection (one layer at a time) |

Phones play in landscape (a rotate prompt appears in portrait) and the game
installs to the home screen as a PWA. Victory is scored in stars: finish with
18+ lives for ★★★, 10+ for ★★.

## Where to tune the game

**Everything** lives in [`src/config.js`](src/config.js) — map size, economy,
wave scaling, every enemy and tower stat, hero stats, shop prices and the colour
palette. There are no magic numbers in the gameplay code. The key balance knobs
(tuned by the sim below) are `HP_EXP`, `DIFFICULTY`, `DAMAGE_SCALE`,
`UPGRADE.dmgMultPerLevel` and the bounty/start-gold values.

## Generated art (optional)

The repo plays fully with built-in shape graphics. To switch to the bright
cel-shaded anime sprite set (towers, enemies, heroes, 4-frame walk-cycle
sheets, title key art), generate it once with your own OpenAI key (see
[`tools/README.md`](tools/README.md)) — the game auto-loads anything in
`assets/` and falls back to shapes for whatever's missing. Walk sheets that
come out misaligned are dropped automatically in favour of procedural motion.
The **Art** toggle lives in Settings.

## Balance simulation

A headless balance sim plays a reference build through all 100 waves with no
browser:

```bash
node src/sim/autoplay.js            # competent "reference" build → clears wave 100
node src/sim/autoplay.js careless   # sloppy build → dies in the ~20s-30s
```

It's the instrument used in Phase 8 to tune the constants so a competent run
clears wave 100 with a low margin while a careless one dies in the teaching zone.

## Project layout

```
mazecore-td/
  index.html            page: canvas + HTML/CSS HUD
  start.sh / start.bat  dev server
  src/
    main.js             bootstraps the game + loop
    config.js           ALL tunable constants & data tables
    engine/             loop, grid, pathfinding, input, seeded rng
    game/               state, map, enemy, tower, projectile, hero, wave, economy, shop
    ui/                 hud, render, tooltips
    sim/                autoplay (headless balance simulation)
```

See `PROGRESS.md` for build status and `DECISIONS.md` for design choices made
along the way.
