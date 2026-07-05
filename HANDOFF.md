# Handoff — Mazecore TD

Read this first if you're picking up this repo cold — as a collaborator, a
future session, or another agent. It's the "what is this, what state is it
in, where do I touch it" doc. For the specific plan to rebuild this as a
native Android app in Google AI Studio, see
[`HANDOFF-NATIVE-REBUILD.md`](HANDOFF-NATIVE-REBUILD.md) instead — that one
supersedes this repo as the shipping target. This doc is about the **web
build**, which stays the working reference (tagged `web-v1.0`).

## What this is

A vertical mobile maze tower-defense game — Wintermaul/Gem-TD/Kingdom-Rush
DNA — built as pure HTML5 Canvas + vanilla JavaScript. **No build step, no
npm dependencies, no framework.** ~6,700 lines of hand-written ES modules.

Core loop: enemies always take the shortest open path from spawn to goal;
your towers *are* the maze walls. A 20-level portrait campaign teaches the
mechanic (checkpoint flags force one maze to be walked 3–5 times), then an
Endless mode (100 procedural waves) tests it. A persistent hero fights
alongside the towers and levels up across runs. Star economy gates
progression and buys permanent upgrades.

Full mechanics/controls are in [`README.md`](README.md) — this doc won't
repeat them, only the parts a new maintainer needs that the README doesn't
cover.

## Current status

**Feature-complete and balanced.** Every phase in the original build plan is
done (see [`PROGRESS.md`](PROGRESS.md) for the phase-by-phase log):
scaffold → pathfinding → combat → towers/upgrades → waves/bosses/economy →
heroes → shop/HUD → art/mobile/store → the vertical campaign rebuild →
Kingdom-Rush UI + monetization → WC3 damage-matrix + siege mode → final
balance pass.

Verified state as of the last balance pass:
- Reference (competent maze) build clears wave 100 on 6/6 tested seeds, 3–9
  lives left — deliberately low margin.
- Careless (no-maze, just towers) build dies waves ~22–28 in the classic
  sim, or level 9 in the campaign sim — the teaching zone works as designed.
- All three heroes (Warrior/Mage/Ranger) can win a run.
- Full headless regression suite is green (see Testing below).
- Last live-browser verification: 2026-06-17 (per `HANDOFF-NATIVE-REBUILD.md`).

**Known gaps, not yet done** (nobody's blocked on these, just not built):
- No service worker — needs the dev server running, no full offline play.
- Generated art assets are ~33MB at 1024px source, downscaled at runtime but
  not pre-shrunk on disk; heavy if this ever ships as a web bundle.
- No real-device touch testing — mobile controls were verified headless +
  by code audit, not finger-tested on hardware.
- `scratch/` (the entire test suite) is gitignored — see Testing below, this
  is a deliberate but real gap.
- No meta-progression between runs beyond stars/hero level (see
  `MOBILE_REVIEW.md` §2 for the prioritized "next" list — daily seed,
  achievements, difficulty selector).

## How to run it

```bash
bash start.sh   # or start.bat on Windows — needs a static server, ES modules can't run from file://
```
Open `http://localhost:8000`. Any static file server works if you don't
have python/node.

## How to test it

Testing is **headless Node scripts** in the tracked `test/` directory — each
imports the real game modules directly (no mocks, no DOM unless a fake one is
needed), runs assertions, and prints a single `*_OK` or `*_FAIL` line.

```bash
npm test                      # the whole suite (13 suites; ~40s, gates last)
node test/t10validate.mjs     # classic-map balance gate (6 seeds, all heroes)
node test/campaign-sim.mjs    # campaign balance gate (reference clears 20, careless dies early)
node test/t11levels.mjs       # checkpoint routing, multi-spawn/goal, wave composer
node test/t11economy.mjs      # refund rates, air/ground targeting, upgrade cost curve
node test/t11profile.mjs      # star economy, level-unlock gating, hero persistence
```

`npm test` (via `test/run.mjs`) runs every suite sequentially and fails on
any nonzero exit or `*_FAIL` line. Run it after any change to `src/game/*`
or `src/config.js`. The `scratch/` directory stays gitignored for local
throwaway scripts (old t0-t9 debug scripts still live there).

There's also a headless balance simulator, separate from the test scripts:
```bash
node src/sim/autoplay.js            # competent build, should clear wave 100
node src/sim/autoplay.js careless   # sloppy build, should die ~w22-28
```

## Where things live

```
mazecore-td/
  index.html            page shell: canvas + HTML/CSS HUD overlay
  start.sh / start.bat  dev server launcher
  src/
    main.js              boot, game loop wiring, save/load actions
    config.js            EVERY tunable constant/data table (397 lines) — towers,
                          enemies, armor/damage matrix, heroes, waves, economy, ads
    engine/              loop (fixed 60Hz timestep), grid (dynamic per-level size),
                          pathfinding (BFS distance fields + A*), input, seeded rng
    game/
      state.js            world state, BFS routing, siege/breach fields
      levels.js            20 campaign levels + Endless + tower unlock schedule (260 lines)
      enemy.js             enemy stage machine (checkpoint-chain progression)
      tower.js              targeting/candidates, upgrade cost curve
      hero.js               guard-post auto-engage AI
      wave.js               wave composition (waveInfo vs per-level levelWaveInfo)
      economy.js, shop.js, projectile.js, damage.js, map.js, save.js
    services/
      profile.js            star economy + persistent hero + localStorage (v1 schema)
      ads.js, sfx.js
    ui/                    topbar, screens, sheets, viewport (letterboxing), radial
                            (build rings), hud, render, infocard, herobar, wavebar,
                            hints, sprites, ui.css
    sim/autoplay.js        headless balance simulator (competent vs careless)
  assets/                 generated sprite art (gitignored regenerable except manifest.json)
  tools/gen-assets.mjs    OpenAI image-gen pipeline for the art (see tools/README.md)
  test/                   tracked headless test suites + run.mjs (npm test)
  scratch/                gitignored local throwaway scripts
  handoff/                levels.json + balance.json — portable data exports for
                          the native rebuild (see HANDOFF-NATIVE-REBUILD.md)
```

**`src/config.js` is the single source of truth for every number in the
game.** No magic numbers live in gameplay code — if you're changing balance,
this is the only file you should need to touch, and `src/sim/autoplay.js` /
`scratch/t10validate.mjs` / `scratch/campaign-sim.mjs` are how you verify a
change didn't break the win/lose gates.

## Design decisions worth knowing before you change anything

The full log is [`DECISIONS.md`](DECISIONS.md) (232 lines, phase-by-phase).
The ones most likely to bite a new contributor:

- **Pathfinding is BFS distance fields per goal, not per-enemy A\*.** Every
  enemy follows the gradient downhill. This is what makes building/selling a
  tower instantly reroute every enemy on the board — don't "optimize" this
  into per-enemy pathing without understanding why it was chosen (cost:
  BFS field recompute; A\* is still used for the hero's move-to-cell and the
  path overlay only).
- **Checkpoints are the depth engine for small screens.** A level's route is
  a waypoint chain; enemies track a `stage` index and get one BFS field per
  stage. This is how one small maze gets walked 3–5 times without needing a
  bigger board. Sealing a *middle* stage is detected and sieged correctly —
  see the "Sealing a MIDDLE stage" test in `scratch/t11levels.mjs`.
- **Walls sell at 100%, towers at 70%** (`CONFIG.WALL_REFUND` vs
  `CONFIG.SELL_REFUND`). Juggling — closing one wall to force a wave through
  a different kill zone — is a core intended technique, not an exploit. Sieged
  towers pay no refund when destroyed; that asymmetry is deliberate (sealing
  the maze is legal but risky).
- **Damage-type × armor-type is a full matrix**
  (`CONFIG.DAMAGE_VS_ARMOR[damageType][armorType]`, 0.5×–1.5×), not flat
  armor subtraction. Every UI badge derives from this table via
  `game/damage.js`'s `matchup()`/`strongWeak()` — don't hardcode a second
  copy of the matchup logic anywhere.
- **Balance is razor-thin on purpose.** `HP_EXP` (per-wave HP growth) was
  dropped hard during tuning (1.10 → 1.05) because maze damage has a hard
  throughput ceiling — past a certain per-enemy HP, no amount of total DPS
  saves you, because damage only applies while an enemy is in range. If you
  raise enemy HP or reduce maze length assumptions, re-run
  `src/sim/autoplay.js` before assuming it's fine.
- **Sprites are a pure overlay, never a dependency.** `ui/sprites.js` loads
  whatever `assets/manifest.json` lists; every draw call has a shape
  fallback. The game is fully playable with zero generated assets. Don't
  make any code path *require* an image.
- **The reference/careless double-gate is the actual quality bar for
  balance changes.** A change is only "done" when the competent-mazer sim
  still clears the run (floor: mechanic is beatable) AND the careless
  ignore-the-mechanic build still dies partway through (ceiling: skipping
  the mechanic has a real cost). Both sims exist for exactly this check —
  run both after any `config.js` or `levels.js` edit.

## Deferred hardening (from the last code review)

A full multi-agent code review (correctness/maintainability/testing/
performance) ran against the campaign-rebuild commits. Confirmed bugs were
fixed immediately (wave-count desync on campaign levels, a viewport
letterbox bug on Endless load, stale doc comments, a dead import) and three
new test suites were added (`t11profile`, `t11economy`, and an extension to
`t11levels`) to close coverage gaps — all committed. Items that needed
design work rather than a quick fix were deferred, and still apply if this
web build keeps being maintained (they're moot if development fully moves
to the native rebuild):

- Offscreen static-map canvas cache (perf — the maze background redraws
  every frame when it only changes on build/sell).
- Unify the two wave pipelines (`waveInfo` for classic, `levelWaveInfo` for
  campaign) — currently parallel implementations that happen to agree.
- Lift remaining campaign-specific magic numbers out of gameplay code into
  `config.js`.

## If you're here to ship this as a mobile app

Don't start from this repo's code. Read
[`HANDOFF-NATIVE-REBUILD.md`](HANDOFF-NATIVE-REBUILD.md) — it explains why
(Google AI Studio's Android builder generates native Kotlin/Compose only,
no WebView/HTML import), gives the full game-design spec so the rebuild
doesn't need to reverse-engineer this codebase, and links the portable data
exports (`handoff/levels.json`, `handoff/balance.json`) so the 20 levels and
every stat table can be loaded rather than re-authored by hand. This web
build stays live at tag `web-v1.0` as the reference implementation to check
the rebuild's behavior against.
