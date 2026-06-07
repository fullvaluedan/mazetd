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
- **You may not fully wall enemies off.** Every spawn must always keep a route to
  its goal; illegal placements are rejected (red highlight).
- **Get anti-air before wave 15.** Flying enemies ignore your maze and fly
  straight to the goal — only air-capable towers (Archer, Frost, Arcane, Tesla)
  can hit them.
- **Counter each enemy type:** swarm → splash (Cannon), tank → magic/poison
  (Arcane/Venom), flyer → anti-air, shield → Arcane, healer → burst/Disrupt.
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
| `Esc` | Cancel current build/target action |

## Where to tune the game

**Everything** lives in [`src/config.js`](src/config.js) — map size, economy,
wave scaling, every enemy and tower stat, hero stats, shop prices and the colour
palette. There are no magic numbers in the gameplay code.

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
