# Mazecore TD

A maze tower-defense game in the spirit of the Warcraft III *Frozen Throne*
classics (Wintermaul, Green TD, Element TD, GemTD), with modern systems borrowed
from Bloons TD (tiered upgrade forks) and Kingdom Rush (a commandable hero with
abilities). Pure HTML5 Canvas + vanilla JavaScript — **no build step, no
dependencies.**

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

| Input | Action |
|-------|--------|
| Left-click | Select tower / place tower / target an ability or cell |
| Right-click | Command the hero to move |
| `P` | Toggle the enemy path overlay |
| `Space` | Pause / resume |
| `1` / `2` / `3` | Game speed 1× / 2× / 3× |
| `S` | Start the next wave (early-start = bonus gold) |
| `Q` / `W` | Cast hero ability 1 / 2 (targeted ones then click a cell) |
| `M` | Arm hero move, then click/tap a destination |
| `Esc` | Cancel current build/target action |

**On touch devices:** tap your hero (or the *Move* button), then tap where it
should go. The layout stacks vertically on phones, and you can add the game to
your home screen (PWA).

The HUD also has **Save** / **Load** buttons (save is allowed between waves;
your best wave reached is kept as a high score), an **Auto-start** toggle, and a
full tower shop, hero panel and consumables shop. Hover anything for a tooltip.

## Where to tune the game

**Everything** lives in [`src/config.js`](src/config.js) — map size, economy,
wave scaling, every enemy and tower stat, hero stats, shop prices and the colour
palette. There are no magic numbers in the gameplay code. The key balance knobs
(tuned by the sim below) are `HP_EXP`, `DIFFICULTY`, `DAMAGE_SCALE`,
`UPGRADE.dmgMultPerLevel` and the bounty/start-gold values.

## Generated art (optional)

The repo plays fully with built-in shape graphics. To switch to hand-painted
Warcraft-III-style sprites, generate them once with your own OpenAI key (see
[`tools/README.md`](tools/README.md)) — the game auto-loads anything in
`assets/` and falls back to shapes for whatever's missing. The HUD's **Art**
button toggles between sprites and shapes.

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
